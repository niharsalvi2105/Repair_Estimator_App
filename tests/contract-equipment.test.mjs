import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { contractEquipmentRecords, parseContractResult } from '../src/data/contractEquipment.ts'
import { parseContractWorksheet, readContractExcel, contractExcelTemplate } from '../src/data/contractExcel.ts'
import { contractMapping, contractMasterValue } from '../backend/prepare-contract-equipment.mjs'

const equipment = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', number: '000123', name: 'Motor',
  location: 'Building', customer: 'Customer', oem: 'KONE', age: 0, matched: true }
const result = { mode: 'contracts', available: true, more: false, contracts: [], notFound: [], equipment: [equipment] }

test('contract responses preserve authoritative equipment snapshots and explicit deployment gates', () => {
  assert.deepEqual(contractEquipmentRecords(parseContractResult(result))[0], {
    re_equipmentid: equipment.id, re_equipment: '000123', re_equipmentname: 'Motor', re_functionallocation: 'Building',
    re_soldtoname: 'Customer', re_oem: 'KONE', re_equipmentage: 0,
  })
  const unavailable = { ...result, available: false, equipment: [], reason: 'Deploy schema' }
  assert.equal(parseContractResult(unavailable).available, false)
  assert.throws(() => contractEquipmentRecords(unavailable), /Deploy schema/)
  for (const change of [{ mode: 'save' }, { equipment: null }, { contracts: ['A', 'a'] },
    { contracts: ['invalid number'] }, { notFound: ['%'] }, { equipment: [equipment, equipment] },
    { equipment: [{ ...equipment, matched: false }] }, { equipment: [{ ...equipment, age: 201 }] },
    { equipment: [{ ...equipment, id: 'bad' }] }])
    assert.throws(() => parseContractResult({ ...result, ...change }), /contract/i)
})

test('contract template uses one text column and roundtrips leading-zero numbers and duplicates', async () => {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await contractExcelTemplate())
  const sheet = workbook.worksheets[0]
  sheet.addRow(['00001234']); sheet.addRow(['C-12']); sheet.addRow(['c-12'])
  const parsed = await readContractExcel(new Uint8Array(await workbook.xlsx.writeBuffer()).buffer)
  assert.deepEqual(parsed, { numbers: ['00001234', 'C-12'], duplicates: ['c-12'] })
})

test('contract files reject malformed rows, formulas, wrong headers, multiple sheets and excessive sizes', async () => {
  for (const value of ['contract number with spaces', { formula: '1+1', result: 2 }, new Date(), 1234567890123456]) {
    const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet('Contracts')
    sheet.addRow(['Contract Number']); sheet.addRow([value])
    assert.throws(() => parseContractWorksheet(sheet), /Row/)
  }
  const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet('Contracts')
  sheet.addRow(['Equipment Number']); sheet.addRow(['0001'])
  assert.throws(() => parseContractWorksheet(sheet), /Contract Number/)
  await assert.rejects(readContractExcel(new ArrayBuffer(5 * 1024 * 1024 + 1)), /5 MB/)
  await assert.rejects(readContractExcel(new TextEncoder().encode('not an xlsx').buffer), /Cannot read/)
  sheet.getCell('A1').value = 'Contract Number'
  workbook.addWorksheet('Other').addRow(['data'])
  await assert.rejects(readContractExcel(new Uint8Array(await workbook.xlsx.writeBuffer()).buffer), /one populated/)
})

test('master mapping uses confirmed sales-market aliases, requires Active/VALID status and preserves identifiers', () => {
  for (const market of ['MKOF', 'MKOM', 'MKO', 'CKE', 'CKQ']) {
    const mapping = contractMapping([market, '020', '000001', 'VALID', 'N40131104', 'Active']).mapping
    assert.equal(mapping.market, market.startsWith('MKO') ? 'MKO' : market)
    assert.equal(mapping.equipmentNumber, '000001')
    assert.equal(mapping.re_contractnumber, 'N40131104')
  }
  assert.equal(contractMapping(['CKE', '110', '123', 'VALID', '', 'Active']).skipped, 'missingContract')
  assert.equal(contractMapping(['CKE', '110', '123', 'VALID', 'C1', 'Cancelled']).skipped, 'inactive')
  assert.throws(() => contractMapping(['OTHER', '110', '123', 'VALID', 'C1', 'Active']), /Invalid/)
  assert.equal(contractMasterValue({ value: 12, numFmt: '00000' }), '00012')
  assert.throws(() => contractMasterValue({ value: { formula: '1' } }), /exact/)
})
