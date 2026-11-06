import test from 'node:test'
import assert from 'node:assert/strict'
import { equipmentDisplayDetails } from '../src/data/equipmentDisplay.ts'

test('imported equipment details are display-only and derive age from construction year', () => {
  const source = { re_description: ' Equipment description ', re_manufacturer: ' Manufacturer ',
    re_constructionyear: 2006 }
  const before = structuredClone(source)
  assert.deepEqual(equipmentDisplayDetails(source, 2026), {
    description: 'Equipment description', manufacturer: 'Manufacturer', age: 20,
  })
  assert.deepEqual(source, before)
})

test('legacy OEM and age remain available and age zero is preserved', () => {
  assert.deepEqual(equipmentDisplayDetails({ re_oem: 'Legacy OEM', re_equipmentage: 0,
    re_constructionyear: 2006 }, 2026), { description: '', manufacturer: 'Legacy OEM', age: 0 })
  assert.equal(equipmentDisplayDetails({ re_manufacturer: 'Source manufacturer', re_oem: 'Legacy OEM' }).manufacturer,
    'Source manufacturer')
})

test('missing, future and invalid construction years never invent an age', () => {
  for (const re_constructionyear of [undefined, null, 0, -1, 2027, 2000.5, NaN, Infinity, '2006'])
    assert.equal(equipmentDisplayDetails({ re_constructionyear }, 2026).age, undefined)
  assert.equal(equipmentDisplayDetails({ re_constructionyear: 2026 }, 2026).age, 0)
})
