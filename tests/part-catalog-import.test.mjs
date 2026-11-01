import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { preparePartCatalog } from '../backend/prepare-part-catalog.mjs'

const options = { asOf: '2026-11-01', sourceVersion: 'approved.xlsx', refreshedOn: '2026-11-01T10:00:00Z' }
const headers = ['Condition Type', 'Sales Organization', 'Distribution Channel', 'Material', 'Material Description',
  'Valid From', 'Valid to', 'Price (USD)', 'Condition currency', 'Pricing unit', 'Unit of measure',
  'Cost (USD)', 'Condition currency', 'Condition record no.', 'Price (CAD)', 'Condition currency',
  'Cost (CAD)', 'Condition currency']
function fixture() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Material')
  sheet.addRow(headers)
  sheet.addRow(['ZR00', 'MKOM', '01', '0000123', 'Motor', new Date('2026-01-01'), new Date('2026-12-31'),
    28.84, 'USD', 1, 'PC', 4.49, 'USD', '0000765', { formula: 'H2*1.4' }, 'CAD',
    { formula: 'L2*1.23*1.4' }, 'CAD'])
  return { workbook, sheet }
}

test('workbook extract preserves leading zeros, source dates and precise USD amounts; CAD derives on server', () => {
  const { workbook } = fixture()
  const result = preparePartCatalog(workbook, options)
  assert.equal(result.approved.length, 1)
  assert.deepEqual(result.report.stats, { sourceRows: 1, expired: 0, future: 0, effective: 1, approved: 1, rejected: 0 })
  assert.equal(result.report.productionImported, false)
  assert.equal(result.approved[0].re_partnumber, '0000123')
  assert.equal(result.approved[0].re_usdcost, '4.490000')
  assert.equal(result.approved[0].re_usdprice, '28.840000')
  assert.equal(result.approved[0].re_parttype, 126110000)
  assert.equal(result.approved[0].re_sourcekey, 'Material:ZR00:MKOM:01:0000123')
  assert.equal(result.approved[0].re_effectivefrom, '2026-01-01')
})

test('zero prices/costs, non-unit pricing and excessive precision are excluded with row-level reasons', () => {
  for (const [column, value] of [[8, 0], [12, 0], [12, 4.1234567], [10, 10], [9, 'CAD'], [6, 'invalid'],
    [8, { error: '#VALUE!' }]]) {
    const { workbook, sheet } = fixture()
    sheet.getRow(2).getCell(column).value = value
    const result = preparePartCatalog(workbook, options)
    assert.equal(result.approved.length, 0)
    assert.equal(result.report.rejected[0].row, 2)
    assert.ok(result.report.rejected[0].reasons.length)
  }
})

test('expired/future rows are excluded and overlapping effective records never choose an arbitrary price', () => {
  for (const [column, date] of [[7, '2026-10-31'], [6, '2026-11-02']]) {
    const { workbook, sheet } = fixture()
    sheet.getRow(2).getCell(column).value = new Date(date)
    const result = preparePartCatalog(workbook, options)
    assert.equal(result.approved.length, 0)
    assert.equal(result.report.stats.expired + result.report.stats.future, 1)
  }
  const { workbook, sheet } = fixture()
  sheet.addRow(sheet.getRow(2).values)
  sheet.getRow(3).getCell(8).value = 0
  const result = preparePartCatalog(workbook, options)
  assert.equal(result.approved.length, 0)
  assert.equal(result.report.rejected.length, 2)
  assert.ok(result.report.rejected.some((r) => r.reasons.includes('Ambiguous effective source key')))
})

test('incorrect workbook headers and malformed as-of dates fail explicitly', () => {
  const { workbook, sheet } = fixture()
  assert.throws(() => preparePartCatalog(workbook, { ...options, asOf: '2026-02-30' }), /valid/)
  sheet.getRow(1).getCell(4).value = 'Wrong'
  assert.throws(() => preparePartCatalog(workbook, options), /headers/)
})
