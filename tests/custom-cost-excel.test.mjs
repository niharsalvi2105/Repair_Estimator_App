import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import {
  CUSTOM_COST_EXCEL_HEADERS,
  MAX_CUSTOM_COST_EXCEL_BYTES,
  customCostExcelTemplate,
  readCustomCostExcel,
} from '../src/data/customCostExcel.ts'

const equipment = ['00001234', 'UNIT-7']
const packageId = 'custom-package'

async function workbookBytes(sheets) {
  const workbook = new ExcelJS.Workbook()
  for (const { name, headers, rows = [], configure } of sheets) {
    const sheet = workbook.addWorksheet(name)
    sheet.addRow(headers)
    rows.forEach((row) => sheet.addRow(row))
    configure?.(sheet, workbook)
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer()).buffer
}

const laborBook = (rows, configure) => workbookBytes([{
  name: 'Labor', headers: CUSTOM_COST_EXCEL_HEADERS.labor, rows, configure,
}])
const materialBook = (rows, configure) => workbookBytes([{
  name: 'Materials', headers: CUSTOM_COST_EXCEL_HEADERS.material, rows, configure,
}])

test('labor template starts with a blank import sheet and parser ignores illustrative instructions', async () => {
  const template = await customCostExcelTemplate('labor', equipment)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(template)
  assert.equal(workbook.worksheets[0].name, 'Labor')
  assert.deepEqual(workbook.worksheets[0].getRow(1).values.slice(1), [...CUSTOM_COST_EXCEL_HEADERS.labor])
  assert.equal(workbook.worksheets[0].getCell('A2').value, null)
  assert.equal(workbook.worksheets[1].name, 'Instructions')
  assert.match(String(workbook.worksheets[1].getCell('A10').value), /not imported/i)

  workbook.worksheets[0].addRow(['00001234', 2, 0, 1.5, 0, 0, 0])
  const parsed = await readCustomCostExcel(
    new Uint8Array(await workbook.xlsx.writeBuffer()).buffer, 'labor', 'en', packageId, equipment, 10,
  )
  assert.deepEqual(parsed.map(({ packageId: pkg, equipmentNumber, role, time, hours }) =>
    ({ packageId: pkg, equipmentNumber, role, time, hours })), [
    { packageId, equipmentNumber: '00001234', role: 126110000, time: 126110000, hours: 2 },
    { packageId, equipmentNumber: '00001234', role: 126110001, time: 126110000, hours: 1.5 },
  ])
  assert.ok(parsed.every((line) => /^[0-9a-f-]{36}$/i.test(line.id)))
})

test('labor expands each positive role and shift without merging duplicate equipment rows', async () => {
  const bytes = await laborBook([
    ['UNIT-7', 0, 3.25, 1, 0, 0, 2],
    ['UNIT-7', 1, 0, 0, 0, 0, 0],
  ])
  const lines = await readCustomCostExcel(bytes, 'labor', 'en', packageId, equipment, 5)
  assert.deepEqual(lines.map(({ role, time, hours }) => ({ role, time, hours })), [
    { role: 126110000, time: 126110001, hours: 3.25 },
    { role: 126110001, time: 126110000, hours: 1 },
    { role: 126110002, time: 126110001, hours: 2 },
    { role: 126110000, time: 126110000, hours: 1 },
  ])
  assert.deepEqual(lines.map((line) => line.equipmentNumber), Array(4).fill('UNIT-7'))
})

test('labor validates expanded line budgets, equipment text, and numeric identifier formatting', async () => {
  await assert.rejects(async () => readCustomCostExcel(
    await laborBook([['UNIT-7', 1, 1, 1, 0, 0, 0]]), 'labor', 'en', packageId, equipment, 2,
  ), /line limit/)
  await assert.rejects(async () => readCustomCostExcel(
    await laborBook([['UNKNOWN', 1, 0, 0, 0, 0, 0]]), 'labor', 'en', packageId, equipment, 10,
  ), /not in the selected package/)
  await assert.rejects(async () => readCustomCostExcel(
    await laborBook([[' 00001234 ', 1, 0, 0, 0, 0, 0]]), 'labor', 'en', packageId, equipment, 10,
  ), /no whitespace/)
  const formatted = await laborBook([[1234, 2, 0, 0, 0, 0, 0]], (sheet) => { sheet.getCell('A2').numFmt = '00000000' })
  assert.equal((await readCustomCostExcel(formatted, 'labor', 'en', packageId, equipment, 10))[0].equipmentNumber, '00001234')
})

test('material template roundtrips manual rows and leaves KONE pricing to catalog resolution', async () => {
  const template = await customCostExcelTemplate('material', equipment)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(template)
  assert.equal(workbook.worksheets[0].name, 'Materials')
  assert.deepEqual(workbook.worksheets[0].getRow(1).values.slice(1), [...CUSTOM_COST_EXCEL_HEADERS.material])
  assert.equal(workbook.worksheets[0].getCell('A2').value, null)
  assert.equal(workbook.worksheets[1].getCell('A12').value, 'EXAMPLE-ONLY-001')
  workbook.worksheets[0].addRow(['00001234', 'Pump', 'Acme', 'Non-KONE', 'PN-01', 2, 12.35])
  workbook.worksheets[0].addRow(['UNIT-7', '', '', 'kOnE', '00042', 1, 0])
  const lines = await readCustomCostExcel(
    new Uint8Array(await workbook.xlsx.writeBuffer()).buffer, 'material', 'en', packageId, equipment, 2,
  )
  assert.deepEqual(lines.map((line) => ({
    packageId: line.packageId, equipmentNumber: line.equipmentNumber, description: line.description,
    vendor: line.vendor, part: line.part, quantity: line.quantity, unitCost: line.unitCost,
    partType: line.partType, pricingSource: line.pricingSource, catalogPartId: line.catalogPartId,
    refreshPart: line.refreshPart,
  })), [
    { packageId, equipmentNumber: '00001234', description: 'Pump', vendor: 'Acme', part: 'PN-01',
      quantity: 2, unitCost: 12.35, partType: 'non-kone', pricingSource: 'manual', catalogPartId: undefined, refreshPart: undefined },
    { packageId, equipmentNumber: 'UNIT-7', description: '', vendor: '', part: '00042',
      quantity: 1, unitCost: 0, partType: 'kone', pricingSource: undefined, catalogPartId: undefined, refreshPart: undefined },
  ])
})

test('materials require correct manufacturer, complete manual details and safe numeric values', async () => {
  const badRows = [
    ['UNIT-7', 'Description', 'Vendor', 'Other', 'P-1', 1, 2],
    ['UNIT-7', 'Description', 'Vendor', 'Non-KONE', '', 1, 2],
    ['UNIT-7', '', 'Vendor', 'Non-KONE', 'P-1', 1, 2],
    ['UNIT-7', 'Description', 'Vendor', 'Non-KONE', 'P-1', 1.5, 2],
    ['UNIT-7', 'Description', 'Vendor', 'Non-KONE', 'P-1', 100001, 2],
    ['UNIT-7', 'Description', 'Vendor', 'Non-KONE', 'P-1', 1, 0],
    ['UNIT-7', 'Description', 'Vendor', 'Non-KONE', 'P-1', 1, '0'],
    ['UNIT-7', 'Description', 'Vendor', 'Non-KONE', 'P-1', 1, 2.345],
    ['UNIT-7', 'Description', 'Vendor', 'Non-KONE', 'P-1', 1, 1.000000001],
    ['UNIT-7', '', '', 'KONE', 'P-1', 1, 0.01],
    ['UNIT-7', '', '', 'KONE', 'P-1', 0, 0],
  ]
  for (const row of badRows) {
    await assert.rejects(
      async () => readCustomCostExcel(await materialBook([row]), 'material', 'en', packageId, equipment, 10),
      /Row 2/,
    )
  }
  const optionalVendor = await readCustomCostExcel(
    await materialBook([['UNIT-7', 'Description', '', 'Non-KONE', 'P-1', 1, 2]]),
    'material', 'en', packageId, equipment, 1)
  assert.equal(optionalVendor[0].vendor, '')
  const formattedPart = await readCustomCostExcel(
    await materialBook([['UNIT-7', 'Description', '', 'Non-KONE', 42, 1, 1.15]],
      sheet => { sheet.getCell('E2').numFmt = '000000' }),
    'material', 'en', packageId, equipment, 1)
  assert.equal(formattedPart[0].part, '000042')
  assert.equal(formattedPart[0].unitCost, 1.15)
})

test('rejects duplicate, missing and unexpected headers and extra data worksheets', async () => {
  await assert.rejects(async () => readCustomCostExcel(
    await workbookBytes([{ name: 'Labor', headers: ['Equipment Number', ...CUSTOM_COST_EXCEL_HEADERS.labor.slice(1), 'Mystery'] }]),
    'labor', 'en', packageId, equipment, 10,
  ), /Unexpected column/)
  await assert.rejects(async () => readCustomCostExcel(
    await workbookBytes([{ name: 'Labor', headers: ['Equipment Number', ...CUSTOM_COST_EXCEL_HEADERS.labor.slice(1, 5), 'Mechanic ST'] }]),
    'labor', 'en', packageId, equipment, 10,
  ), /Duplicate column/)
  await assert.rejects(async () => readCustomCostExcel(
    await workbookBytes([{ name: 'Labor', headers: ['Equipment Number'] }]), 'labor', 'en', packageId, equipment, 10,
  ), /Missing column/)
  await assert.rejects(async () => readCustomCostExcel(
    await workbookBytes([
      { name: 'Labor', headers: CUSTOM_COST_EXCEL_HEADERS.labor },
      { name: 'Other', headers: ['Anything'] },
    ]), 'labor', 'en', packageId, equipment, 10,
  ), /one data worksheet/)
})

test('rejects formulas, hyperlinks, dates, errors, empty/corrupt workbooks and oversized uploads', async () => {
  for (const value of [
    { formula: '1+1', result: 2 },
    { text: 'linked', hyperlink: 'https://example.invalid' },
    new Date(),
    { error: '#N/A' },
  ]) {
    const bytes = await laborBook([['UNIT-7', value, 0, 0, 0, 0, 0]])
    await assert.rejects(() => readCustomCostExcel(bytes, 'labor', 'en', packageId, equipment, 10), /Row 2/)
  }
  await assert.rejects(() => readCustomCostExcel(new ArrayBuffer(4), 'labor', 'en', packageId, equipment, 10), /valid, unprotected/)
  await assert.rejects(async () => readCustomCostExcel(
    new ArrayBuffer(MAX_CUSTOM_COST_EXCEL_BYTES + 1), 'labor', 'en', packageId, equipment, 10,
  ), /5 MB/)
  await assert.rejects(async () => readCustomCostExcel(
    await laborBook([]), 'labor', 'en', packageId, equipment, 10,
  ), /no positive hours/)
  await assert.rejects(async () => readCustomCostExcel(
    await workbookBytes([{ name: 'Labor', headers: CUSTOM_COST_EXCEL_HEADERS.labor }]), 'labor', 'en', packageId, equipment, 10,
  ), /no positive hours/)
})

test('hours, row limits and French diagnostics are checked atomically', async () => {
  for (const invalid of [-1, 100000.01, 100001, 'one', 1.234]) {
    await assert.rejects(async () => readCustomCostExcel(
      await laborBook([['UNIT-7', invalid, 0, 0, 0, 0, 0]]), 'labor', 'en', packageId, equipment, 10,
    ), /Row 2/)
  }
  await assert.rejects(async () => readCustomCostExcel(
    await laborBook([['UNIT-7', 1, 0, 0, 0, 0, 0], ['NOT-SELECTED', 2, 0, 0, 0, 0, 0]]),
    'labor', 'fr', packageId, equipment, 10,
  ), /Ligne 3/)
  await assert.rejects(async () => readCustomCostExcel(
    await laborBook([['UNIT-7', 1, 1, 0, 0, 0, 0]]), 'labor', 'fr', packageId, equipment, 1,
  ), /limite de lignes/)
})
