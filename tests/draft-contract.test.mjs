import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDraft, draftInputs, serializeDraft } from '../src/data/draftContract.ts'

const fixture = () => ({
  mode: 'save', id: 'draft-id', version: '17', number: '0000000042', title: 'Repair',
  branchId: 'branch-id', stateId: 'state-id', equipmentTypeId: 'type-id', jobTypeId: '',
  building: 'Building', customer: 'Customer', email: null, phone: null, market: 126110000,
  fields: [{ key: 're_usetax', value: '5' }, { key: 're_freight', value: '0' }],
  equipment: [{ id: '', matched: false, number: 'UNLISTED', name: null, location: null, customer: null, oem: null, age: null }],
  packages: [{ id: 'package-id', number: 'P1', nameEn: 'Package', scopeEn: 'Scope', hours: 2.5, material: 125 }],
})

test('draft responses preserve row version, snapshots and display percentages', () => {
  const record = parseDraft(fixture())
  assert.equal(record.version, '17')
  assert.equal(record.packages[0].hours, 2.5)
  assert.deepEqual(draftInputs(record), { re_usetax: '5', re_freight: '0' })
})

test('pricing state accepts old responses and nullable strings but rejects malformed values', () => {
  for (const pricingState of [undefined, null, 'unavailable', '2026.1']) {
    assert.equal(parseDraft({ ...fixture(), pricingState }).pricingState, pricingState)
  }
  for (const pricingState of [false, 0, {}]) {
    assert.throws(() => parseDraft({ ...fixture(), pricingState }), /draft/i)
  }
})

test('submitted snapshots carry explicit status and reject unsupported statuses', () => {
  assert.equal(parseDraft({ ...fixture(), status: 126110002 }).status, 126110002)
  assert.equal(parseDraft({ ...fixture(), status: 126110000 }).status, 126110000)
  for (const status of ['126110002', false, 126110001, -1])
    assert.throws(() => parseDraft({ ...fixture(), status }), /draft/i)
})

test('missing versions, header values and unknown market fail explicitly', () => {
  for (const value of [null, {}, { ...fixture(), version: '' }, { ...fixture(), title: null },
    { ...fixture(), market: 7 }, { ...fixture(), email: {} }]) {
    assert.throws(() => parseDraft(value), /draft/i)
  }
})

test('malformed snapshots are rejected before the editor receives them', () => {
  for (const change of [
    { equipment: [] }, { packages: [] }, { equipment: [null] },
    { equipment: [{ ...fixture().equipment[0], matched: true, id: '' }] },
    { equipment: [{ ...fixture().equipment[0], age: -1 }] },
    { packages: [{ ...fixture().packages[0], hours: NaN }] },
    { packages: [{ ...fixture().packages[0], material: -1 }] },
    { packages: [{ ...fixture().packages[0], scopeFr: {} }] },
    { fields: [{ key: 're_usetax', value: 5 }] },
    { fields: [fixture().fields[0], fixture().fields[0]] },
  ]) assert.throws(() => parseDraft({ ...fixture(), ...change }), /draft/i)
})

test('saved inputs cannot inject status or unsupported editor fields', () => {
  const record = fixture()
  record.fields.push({ key: 're_estimatestatus', value: '126110002' })
  assert.throws(() => draftInputs(parseDraft(record)), /Unsupported saved input/)
})

test('more than three packages and custom snapshots roundtrip without trusting malformed lines', () => {
  const record = fixture()
  record.packages = Array.from({ length: 125 }, (_, i) => ({ ...record.packages[0], id: `p${i}`, isCustom: i === 0 }))
  record.laborLines = [{ id: 'l', role: 126110002, time: 126110001, hours: 2, rate: 250 }]
  record.materialLines = [{ id: 'm', description: 'Part', vendor: 'KONE', part: 'KM1', quantity: 2, unitCost: 10 }]
  assert.equal(parseDraft(record).packages.length, 125)
  assert.equal(parseDraft(record).laborLines[0].rate, 250)
  assert.throws(() => parseDraft({ ...record, laborLines: [{ ...record.laborLines[0], rate: -1 }] }), /labor/i)
  assert.throws(() => parseDraft({ ...record, laborLines: {} }), /labor/i)
  assert.throws(() => parseDraft({ ...record, materialLines: [{ ...record.materialLines[0], quantity: NaN }] }), /material/i)
})

test('equipment selections above fourteen roundtrip without truncation within technical budgets', () => {
  const record = fixture()
  record.equipment = Array.from({ length: 125 }, (_, i) => ({
    ...record.equipment[0], number: `UNIT-${i}`,
  }))
  assert.equal(parseDraft(JSON.parse(serializeDraft(record))).equipment.length, 125)
  record.equipment = Array.from({ length: 1000 }, (_, i) => ({
    ...record.equipment[0], number: `UNIT-${i}`,
  }))
  assert.throws(() => parseDraft(record), /selection counts/i)
})

test('request budget measures UTF-8 bytes and never truncates input', () => {
  assert.equal(serializeDraft({ text: 'a'.repeat(199989) }).length, 200000)
  assert.throws(() => serializeDraft({ text: 'a'.repeat(199990) }), /budget/i)
  assert.throws(() => serializeDraft({ text: 'é'.repeat(100000) }), /budget/i)
})
