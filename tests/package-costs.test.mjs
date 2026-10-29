import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatePackageCost, packageCost } from '../src/data/packageCosts.ts'
import { customCostsError } from '../src/data/requestValidation.ts'

test('package costs scale hours and material by equipment and apply additive material tax and freight', () => {
  assert.deepEqual(packageCost(2, 50, 3, 100, 5, 10),
    { hours: 6, labor: 600, material: 150, total: 772.5 })
  assert.throws(() => packageCost(NaN, 50, 3, 100, 5, 10), /invalid/)
  assert.throws(() => packageCost(2, 50, 0, 100, 5, 10), /invalid/)
})

test('each custom package requires assigned positive labor and material entries', () => {
  const labor = [{ id: 'l', packageId: 'a', role: 126110000, time: 126110000, hours: 2 }]
  const materials = [{ id: 'm', packageId: 'a', description: 'Motor', quantity: 1, unitCost: 10 }]
  assert.equal(customCostsError(['a'], labor, materials, 'en'), undefined)
  assert.ok(customCostsError(['a', 'b'], labor, materials, 'en'))
  assert.ok(customCostsError(['a'], [], materials, 'en'))
  assert.ok(customCostsError(['a'], labor, [], 'en'))
  for (const hours of [0, -1, NaN]) assert.ok(customCostsError(['a'], [{ ...labor[0], hours }], materials, 'en'))
  for (const change of [{ quantity: 0 }, { unitCost: 0 }, { description: ' ' }, { packageId: null }])
    assert.ok(customCostsError(['a'], labor, [{ ...materials[0], ...change }], 'en'))
  assert.ok(customCostsError(['a'], [{ ...labor[0], packageId: null }], materials, 'fr'))
  assert.equal(customCostsError([], [], [], 'en'), undefined)
})

test('custom previews isolate packages, use branch role/time rates and count entered costs once', () => {
  const rates = [{ role: 126110000, time: 126110000, rate: 100 }, { role: 126110001, time: 126110001, rate: 200 }]
  const p = { re_repairpackageid: 'a', re_iscustompackage: true, re_mechanichours: 0, re_materialmisctaxcost: 0 }
  const labor = [{ id: 'l', packageId: 'a', role: 126110001, time: 126110001, hours: 2 },
    { id: 'other', packageId: 'b', role: 126110000, time: 126110000, hours: 100 }]
  const materials = [{ id: 'm', packageId: 'a', description: 'Motor', quantity: 2, unitCost: 25 }]
  assert.deepEqual(calculatePackageCost(p, 3, rates, 126110000, 5, 10, labor, materials),
    { hours: 2, rate: 100, labor: 400, material: 50, total: 457.5 })
  assert.throws(() => calculatePackageCost(p, 3, [], 126110000, 5, 10, labor, materials), /missing or ambiguous/)
  assert.throws(() => calculatePackageCost(p, 3, rates, 126110000, 5, 10, [], materials), /Complete the CSTM/)
  assert.throws(() => calculatePackageCost(p, 3, [...rates, rates[0]], 126110000, 5, 10, labor, materials), /ambiguous/)
})
