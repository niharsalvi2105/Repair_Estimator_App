import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDraft, draftInputs } from '../src/data/draftContract.ts'

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
