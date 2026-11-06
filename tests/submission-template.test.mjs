import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import Excel from 'exceljs'

const require = createRequire(import.meta.url)
const { buildSubmissionTemplate, summaryFields } = require('../automation/build-submission-template.cjs')
const source = ts.transpileModule(readFileSync(new URL('../automation/office-scripts/FillSubmission.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
}).outputText
const fill = vm.runInNewContext(source + '\nmain', { ExcelScript: { ClearApplyTo: { contents: 'contents' } } })
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const cell = (key, value, text = null) => ({ key, number: typeof value === 'number' ? value : null,
  text: typeof value === 'string' ? value : text })
export function sampleSubmission() {
  return { schemaVersion: '1', templateVersion: '1', submissionId: id(1), revision: '42', mode: 'sample',
    header: { id: id(2), cells: [
      cell('re_name', 'DEMO-000042'), cell('re_estimatename', 'Synthetic repair estimate - review only'),
      cell('re_customeraccount', 'Demonstration Account'), cell('re_accountnumber', '00001234'),
      cell('re_customername', 'Demonstration Contact'), cell('re_customeremail', 'contact@example.invalid'),
      cell('re_customerphone', '+10000000000'), cell('re_branch', 'Demonstration branch'),
      cell('re_market', 126110001, 'CKE'), cell('re_buildingname', 'Demonstration functional location'),
      cell('re_buildingprovincestate', 'Ontario'), cell('re_salesperson', 'Demonstration user'),
      cell('re_equipmenttype', 'Elevator'), cell('re_jobtype', 'Repair'),
      cell('re_proposallanguage', 126110000, 'English'), cell('re_numberofequipment', 2),
      cell('re_calculationversion', '2026.8'), cell('re_totaltruecost', 578.92), cell('re_sellprice', 1000),
      cell('re_suggestedprice', 964.87), cell('re_recommendedcmii', .4), cell('re_actualcmii', .4211),
      cell('re_cmiivariance', .0211), cell('re_basetargetcmii', .4),
      cell('re_packageestimatedcost', 449.06), cell('re_totaladditionalcost', 129.86),
      cell('re_laborcost', 492.08), cell('re_materialcost', 68.23), cell('re_usetaxamount', 4.77),
      cell('re_freightamount', 8.18), cell('re_amincentive', 0), cell('re_bdincentive', 0),
      cell('re_billingplan', 126110002, 'Final 100%'), cell('re_notesforcttteam', 'Synthetic sample only. Not a real quotation.'),
      cell('re_additionalscope', 'Confirm access and coordinate the work.'),
    ] },
    equipment: [3, 4].map(n => ({ id: id(n), cells: [cell('re_equipmentnumber', `0000000${n}`),
      cell('re_equipmentnamesnapshot', `Demonstration unit ${n}`)] })),
    packages: [{ id: id(5), cells: [cell('re_packagenumber', 'DEMO'),
      cell('re_packagenameen', 'Demonstration repair package'), cell('re_iscustompackage', 0, 'No'),
      cell('re_proposalscopeen', 'Inspect the equipment, perform the approved repair, test operation and document completion.'),
      cell('re_equipmentnumbers', '["00000003","00000004"]')] }],
    labor: [], materials: [], costs: [] }
}

export function submissionAdapter(book, writes = []) {
  const range = (sheet, r, c, rows = 1, columns = 1) => {
    const each = fn => { for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) fn(sheet.getCell(r + y + 1, c + x + 1)) }
    return {
      getValue: () => sheet.getCell(r + 1, c + 1).value ?? '',
      setValue: value => {
        writes.push(value)
        sheet.getCell(r + 1, c + 1).value = typeof value === 'string' && value.startsWith("'") ? value.slice(1) : value
      },
      setNumberFormat: value => each(cell => { cell.numFmt = value }),
      clear: () => each(cell => { cell.value = null }),
      unmerge: () => { for (const merge of [...sheet.model.merges]) sheet.unMergeCells(merge) },
      merge: () => sheet.mergeCells(r + 1, c + 1, r + rows, c + columns),
      getFormat: () => ({
        setWrapText: value => each(cell => { cell.alignment = { ...cell.alignment, wrapText: value } }),
        setRowHeight: height => { for (let y = 0; y < rows; y++) sheet.getRow(r + y + 1).height = height },
        getFill: () => ({ setColor: color => each(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color.slice(1) } } }) }),
        getFont: () => ({ setBold: bold => each(cell => { cell.font = { ...cell.font, bold } }) }),
      }),
    }
  }
  const sheet = s => ({
    getRangeByIndexes: (...args) => range(s, ...args),
    getUsedRange: () => range(s, 0, 0, s.rowCount, s.columnCount),
    getPageLayout: () => ({ setPrintArea: () => { s.pageSetup.printArea = `A1:H${s.rowCount}` } }),
  })
  return {
    getWorksheet: name => book.getWorksheet(name) ? sheet(book.getWorksheet(name)) : undefined,
    getWorksheets: () => book.worksheets.map(sheet),
    getNamedItem: name => {
      const ranges = book.definedNames.getRanges(name).ranges
      if (!ranges.length) return undefined
      const address = ranges[0].split('!')[1].replaceAll('$', '').split(':')[0]
      const c = book.getWorksheet('Estimate').getCell(address)
      return { getRange: () => range(c.worksheet, c.row - 1, c.col - 1) }
    },
  }
}
const named = (book, key) => book.getWorksheet('Estimate').getCell(summaryFields.find(([name]) => name === key)[1].split(':')[0])
export const fillSubmission = (book, data) => fill(submissionAdapter(book), JSON.stringify(data), 'CAD', '2026-11-06T04:00:00Z')

test('new template has all summary anchors, logo, hidden control and portrait PDF areas', async () => {
  const book = await buildSubmissionTemplate()
  assert.equal(book.getWorksheet('_Template').state, 'veryHidden')
  assert.equal(book.getWorksheet('Estimate').getImages().length, 1)
  for (const [name] of summaryFields) assert.equal(book.definedNames.getRanges(name).ranges.length, 1)
  assert.equal(book.getWorksheet('Estimate').pageSetup.printArea, 'A1:H55')
})

test('fills saved totals without formulas, preserves leading zeros, zero incentives and percentage-point variance', async () => {
  const book = await buildSubmissionTemplate()
  const result = fillSubmission(book, sampleSubmission())
  assert.equal(result.totalTrueCost, 578.92)
  assert.equal(named(book, 'AccountNumber').value, '00001234')
  assert.equal(named(book, 'ActualCmii').value, .4211)
  assert.equal(named(book, 'ActualCmii').numFmt, '0.00%')
  assert.ok(Math.abs(named(book, 'CmiiVariance').value - 2.11) < 1e-10)
  assert.equal(named(book, 'AmIncentive').value, 0)
  assert.equal(named(book, 'KoneSuggestedPrice').value, '')
  const restored = new Excel.Workbook()
  await restored.xlsx.load(Buffer.from(await book.xlsx.writeBuffer()))
  assert.equal(restored.getWorksheet('Estimate').getCell('C37').value, 578.92)
  for (const sheet of book.worksheets) sheet.eachRow(row => row.eachCell(c => assert.notEqual(c.type, Excel.ValueType.Formula)))
  assert.throws(() => fillSubmission(book, sampleSubmission()), /ALREADY_FILLED/)
})

test('rejects invalid pricing, missing labels and malformed rows before modifying the template', async () => {
  for (const mutate of [
    p => { p.header.cells.find(c => c.key === 're_totaltruecost').number = null },
    p => { p.header.cells.find(c => c.key === 're_calculationversion').text = 'unavailable' },
    p => { p.header.cells.find(c => c.key === 're_market').text = null },
    p => { p.equipment.push(p.equipment[0]) },
    p => { p.header.cells.push(p.header.cells[0]) },
  ]) {
    const book = await buildSubmissionTemplate(); const data = sampleSubmission(); mutate(data)
    assert.throws(() => fillSubmission(book, data), /SUBMISSION_/)
    assert.equal(named(book, 'TotalCost').value, '')
    assert.equal(book.getWorksheet('_Template').getCell('A2').value, null)
  }
})

test('long scopes and all CSTM rows survive continuation, formula-like strings remain literal', async () => {
  const book = await buildSubmissionTemplate(); const data = sampleSubmission()
  const scope = ('Long scope with accents: é and supplementary character 🚀. ').repeat(80) + 'SCOPE-END'
  data.packages[0].cells.find(c => c.key === 're_proposalscopeen').text = scope
  data.labor = [{ id: id(6), cells: [cell('re_hours', 1.25), cell('re_totalcost', 123.45)] }]
  data.materials = [{ id: id(7), cells: [cell('re_partnumber', '000456'), cell('re_unitcostprecise', 49.66248),
    cell('re_entereddescription', '=HYPERLINK("invalid")')] }]
  const writes = []
  fill(submissionAdapter(book, writes), JSON.stringify(data), 'CAD', '2026-11-06T04:00:00Z')
  assert.match(named(book, 'ScopePreview').value, /See Details/)
  const values = book.getWorksheet('Details').getSheetValues().flat()
  assert.ok(values.includes('000456') && values.includes(49.66248))
  assert.ok(values.includes('=HYPERLINK("invalid")'))
  assert.ok(writes.includes('\'=HYPERLINK("invalid")'))
  book.getWorksheet('Details').eachRow(row => row.eachCell(c => assert.notEqual(c.type, Excel.ValueType.Formula)))
  assert.ok(values.some(v => typeof v === 'string' && v.includes('SCOPE-END')))
  const index = values.indexOf('Scope of work (EN)')
  assert.ok(index >= 0)
  let rebuilt = ''
  let collecting = false
  book.getWorksheet('Details').eachRow(row => {
    if (row.getCell(1).value === 'Scope of work (EN)') collecting = true
    else if (collecting && row.getCell(1).value !== '(continued)') collecting = false
    if (collecting) rebuilt += row.getCell(2).value
  })
  assert.equal(rebuilt, scope)
})

test('missing anchors fail before mutation and long customer values use full Details', async () => {
  const book = await buildSubmissionTemplate()
  const adapter = submissionAdapter(book)
  const original = adapter.getNamedItem
  adapter.getNamedItem = name => name === 'SellPrice' ? undefined : original(name)
  assert.throws(() => fill(adapter, JSON.stringify(sampleSubmission()), 'CAD', '2026-11-06T04:00:00Z'), /ANCHOR_MISSING/)
  assert.equal(named(book, 'TotalCost').value, '')
  const data = sampleSubmission()
  const account = 'Long demonstration Account name '.repeat(5)
  data.header.cells.find(c => c.key === 're_customeraccount').text = account
  data.header.cells.find(c => c.key === 're_actualcmii').number = -.1
  fillSubmission(book, data)
  assert.equal(named(book, 'AccountName').value, 'See Details')
  assert.equal(named(book, 'ActualCmii').value, -.1)
  const allText = book.getWorksheet('Details').getSheetValues().flat().filter(v => typeof v === 'string').join('')
  assert.ok(allText.includes(account.slice(0, 72)))
})
