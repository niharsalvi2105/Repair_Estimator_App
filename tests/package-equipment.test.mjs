import test from 'node:test'
import assert from 'node:assert/strict'
import { packageEquipmentNumbers, validPackageEquipment, validCustomCostEquipment } from '../src/data/packageEquipment.ts'
import { calculatePackageCost } from '../src/data/packageCosts.ts'

const equipment = Array.from({ length: 5 }, (_, i) => ({ number: `E${i + 1}` }))
test('custom cost equipment cannot follow a removed unit or a different package subset', () => {
  const packages = [{ id: 'a', equipmentNumbers: ['0001'] }, { id: 'b', equipmentNumbers: ['E2'] }]
  assert.equal(validCustomCostEquipment([{ packageId: 'a', equipmentNumber: '0001' }], packages), true)
  for (const equipmentNumber of ['1', 'E2', ' 0001', 'MISSING'])
    assert.equal(validCustomCostEquipment([{ packageId: 'a', equipmentNumber }], packages), false)
  for (const equipmentNumber of [null, undefined, ''])
    assert.equal(validCustomCostEquipment([{ packageId: 'a', equipmentNumber }], packages), true)
  assert.equal(validCustomCostEquipment([{ packageId: 'b', equipmentNumber: '0001' }], packages), false)
})

test('Pit 4 / MR 3 / Door 5 use actual subsets and exact costs', () => {
  const rates = [{ role: 126110000, time: 126110000, rate: 100 }]
  const packageBase = { re_mechanichours: 1, re_materialmisctaxcost: 100 }
  const selections = [{ equipmentNumbers: ['E1', 'E2', 'E3', 'E4'] },
    { equipmentNumbers: ['E1', 'E2', 'E3'] }, {}]
  assert.deepEqual(selections.map((p) => packageEquipmentNumbers(p, equipment).length), [4, 3, 5])
  assert.deepEqual(selections.map((p) => calculatePackageCost(packageBase,
    packageEquipmentNumbers(p, equipment).length, rates, 126110000, 5, 14, [], []).total), [876, 657, 1095])
})
test('all-mode follows new units; explicit selection never silently adds units', () => {
  const subset = { equipmentNumbers: ['E1', 'E2'] }
  assert.deepEqual(packageEquipmentNumbers({}, [...equipment, { number: 'E6' }]), ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'])
  assert.deepEqual(packageEquipmentNumbers(subset, [...equipment, { number: 'E6' }]), ['E1', 'E2'])
  assert.equal(validPackageEquipment(subset, equipment.slice(1)), false)
})
test('empty, duplicate, foreign and malformed selections fail instead of becoming all', () => {
  for (const equipmentNumbers of [[], ['E1', 'E1'], ['FOREIGN'], [''], [42], 'E1'])
    assert.equal(validPackageEquipment({ equipmentNumbers }, equipment), false)
  for (const equipmentNumbers of [undefined, null, ['E1']])
    assert.equal(validPackageEquipment({ equipmentNumbers }, equipment), true)
})
