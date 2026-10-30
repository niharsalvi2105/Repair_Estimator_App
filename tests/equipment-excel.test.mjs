import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { EQUIPMENT_EXCEL_HEADERS, MAX_EQUIPMENT_EXCEL_BYTES, equipmentExcelTemplate, readEquipmentExcel } from '../src/data/equipmentExcel.ts'
import { planEquipmentAdd } from '../src/data/equipmentPaste.ts'

async function file(rows, headers = EQUIPMENT_EXCEL_HEADERS, configure) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Equipment')
  sheet.addRow(headers)
  for (const row of rows) sheet.addRow(row)
  configure?.(sheet, workbook)
  return new Uint8Array(await workbook.xlsx.writeBuffer()).buffer
}

test('downloaded Excel template roundtrips with stable columns and text-formatted equipment numbers', async () => {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await equipmentExcelTemplate())
  const sheet = workbook.worksheets[0]
  assert.deepEqual(sheet.getRow(1).values.slice(1), [...EQUIPMENT_EXCEL_HEADERS])
  assert.equal(sheet.getColumn(1).numFmt, '@')
  sheet.addRow(['00000711', 'Lobby lift', 0, 'Main lobby', 'KONE'])
  const { rows } = await readEquipmentExcel(new Uint8Array(await workbook.xlsx.writeBuffer()).buffer, 'en', 1000)
  assert.deepEqual(rows, [{ number: '00000711', name: 'Lobby lift', age: 0, location: 'Main lobby', oem: 'KONE' }])
})

test('Excel trims values, preserves alphanumeric/text and formatted leading zeros, deduplicates case-insensitively', async () => {
  const data = await file([
    [' 00001234 ', ' Lift ', 12, ' Lobby ', ' KONE '],
    ['00001234', 'Lift', 12, 'Lobby', 'KONE'],
    ['UNIT-B', '', '', '', 'Other'],
    ['unit-b', '', '', '', 'Other'],
    [711, 'Numeric', 200, '', ''],
    [],
  ], undefined, (sheet) => { sheet.getCell('A6').numFmt = '00000000' })
  const result = await readEquipmentExcel(data, 'en', 1000)
  assert.deepEqual(result.rows.map((row) => row.number), ['00001234', 'UNIT-B', '00000711'])
  assert.deepEqual(result.duplicates, ['00001234', 'unit-b'])
  assert.equal(result.rows[1].age, undefined)
})

test('Excel invalid rows fail as a whole with row diagnostics and no truncation', async () => {
  for (const row of [
    ['', 'Missing number'], ['A'.repeat(21)], ['TWO NUMBERS'], ['20000711,20000712'],
    ['EQ1', '', -1], ['EQ1', '', 201], ['EQ1', '', 2.5], ['EQ1', '', 'unknown'],
    ['EQ1', 'A'.repeat(101)], ['EQ1', '', '', 'L'.repeat(101)],
    [1.5], [1234567890123456], [Number.MAX_SAFE_INTEGER + 1], ['EQ1', { formula: '1+1', result: 2 }],
    ['EQ1', new Date()], ['EQ1', { error: '#N/A' }],
  ]) {
    const data = await file([row])
    await assert.rejects(() => readEquipmentExcel(data, 'en', 1000), /Row 2/)
  }
})

test('invalid headers, empty/corrupt workbooks, conflicting duplicates and limits fail explicitly', async () => {
  await assert.rejects(() => readEquipmentExcel(new ArrayBuffer(4), 'en', 1000), /valid, unprotected/)
  await assert.rejects(() => readEquipmentExcel(new ArrayBuffer(MAX_EQUIPMENT_EXCEL_BYTES + 1), 'en', 1000), /5 MB/)
  await assert.rejects(async () => readEquipmentExcel(await file([]), 'en', 1000), /empty/)
  await assert.rejects(async () => readEquipmentExcel(await file([['EQ1']], ['Equipment Number']), 'en', 1000), /Missing column/)
  await assert.rejects(async () => readEquipmentExcel(await file([['EQ1']], [...EQUIPMENT_EXCEL_HEADERS, 'Age']), 'en', 1000), /Duplicate column/)
  await assert.rejects(async () => readEquipmentExcel(await file([['EQ1', 'First'], ['EQ1', 'Conflicting']]), 'en', 1000), /conflicting/)
  await assert.rejects(async () => readEquipmentExcel(await file([['EQ1'], ['EQ2']]), 'en', 1), /remaining equipment budget/)
  await assert.rejects(async () => readEquipmentExcel(await file([['EQ1']], undefined,
    (_sheet, book) => book.addWorksheet('Other').addRow(['EQ2'])), 'en', 1000), /one equipment worksheet/)
})

test('Excel supports more than fifty equipment without truncation and planning skips existing unlisted numbers', async () => {
  const result = await readEquipmentExcel(await file(Array.from({ length: 125 }, (_, i) => [`UNIT-${i}`])), 'en', 1000)
  assert.equal(result.rows.length, 125)
  const plan = planEquipmentAdd(['UNIT-0'], result.rows.map((row) => row.number), [{ re_equipment: 'UNIT-1' }])
  assert.deepEqual(plan.alreadySelected, ['UNIT-0'])
  assert.deepEqual(plan.add, [{ re_equipment: 'UNIT-1' }])
  assert.equal(plan.notFound.length, 123)
})

test('French validation reports the failing worksheet row', async () => {
  const data = await file([['EQ1', '', 'not an age']])
  await assert.rejects(() => readEquipmentExcel(data, 'fr', 1000), /Ligne 2/)
})
