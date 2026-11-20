import test from 'node:test'
import assert from 'node:assert/strict'
import { missingMaterialSellingPrices } from '../src/data/materialSaveVerification.ts'

const line = (id, sellingPrice = 55.25, extra = {}) => ({
  id, packageId: 'package', equipmentNumber: 'E1', catalogPartId: 'ABC',
  partType: 'kone', quantity: 2, markupPercent: 10, sellingPrice, ...extra,
})
const missing = missingMaterialSellingPrices

test('a submitted catalog cost override must be returned as the effective unit cost', () => {
  const sent = line('client', null, { unitCostOverride: 15.123456789 })
  assert.equal(missing([sent], [line('server', null, { unitCost: 15.123456789 })], []), false)
  assert.equal(missing([sent], [line('server', null, { unitCost: 99 })], []), true)
})

test('new server IDs and reordering preserve exact selling prices', () => {
  const sent = [line('new-1'), line('new-2', 17.1234567891, { quantity: 3 })]
  const received = [line('server-2', 17.1234567891, { quantity: 3, catalogPartId: 'abc' }), line('server-1')]
  assert.equal(missing(sent, received, []), false)
  assert.equal(missing(sent, [received[0], line('server-1', 55.26)], []), true)
  assert.equal(missing(sent, [received[0], line('server-1', null)], []), true)
})

test('existing rows must retain their own ID and price', () => {
  const old = line('existing', 10)
  const sent = [line('existing', 55.25), line('new', 20)]
  assert.equal(missing(sent, [line('server', 20), line('existing', 55.25)], [old]), false)
  assert.equal(missing(sent, [line('existing', 20), line('server', 55.25)], [old]), true)
  assert.equal(missing(sent, [line('server', 55.25), line('server-2', 20)], [old]), true)
})

test('duplicate new rows require one distinct matching saved row per override', () => {
  const sent = [line('one'), line('two')]
  assert.equal(missing(sent, [line('a'), line('b')], []), false)
  assert.equal(missing(sent, [line('a'), line('b', null)], []), true)
  assert.equal(missing(sent, [line('a')], []), true)
})

test('other rows cannot satisfy an override with a different assignment or identity', () => {
  const sent = [line('old', null), line('new')]
  assert.equal(missing(sent, [line('old'), line('server', null)], [line('old', null)]), true)
  for (const extra of [{ packageId: 'other' }, { equipmentNumber: 'E2' },
    { catalogPartId: 'other' }, { quantity: 3 }, { markupPercent: 12 }])
    assert.equal(missing([line('new')], [line('server', 55.25, extra)], []), true)
  assert.equal(missing([line('new', null)], [], []), false)
})
