import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateCustomMaterialTotal, materialEntryError } from '../src/data/customMaterialCosts.ts'
import { calculatePackageCost } from '../src/data/packageCosts.ts'
import { customCostsError } from '../src/data/requestValidation.ts'

const material = { id: 'm', packageId: 'custom', part: '0001', description: 'Motor', vendor: '',
  quantity: 2, unitCost: 7.73178, unitPrice: 40.376, partType: 'kone',
  catalogPartId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', markupPercent: 10 }

test('material total uses exact unit cost times quantity, never selling price or equipment count', () => {
  const manual = { ...material, id: 'n', partType: 'non-kone', catalogPartId: undefined, markupPercent: undefined,
    unitPrice: undefined, quantity: 3, unitCost: 10 }
  assert.equal(calculateCustomMaterialTotal([material, manual]), 45.46356)
  assert.equal(calculateCustomMaterialTotal([{ ...material, unitPrice: 900 }]), 15.46356)
  assert.equal(calculateCustomMaterialTotal([]), 0)
  const p = { re_repairpackageid: 'custom', re_iscustompackage: true, re_mechanichours: 0, re_materialmisctaxcost: 0 }
  const labor = [{ id: 'l', packageId: 'custom', role: 126110000, time: 126110000, hours: 2 }]
  const rates = [{ role: 126110000, time: 126110000, rate: 100 }]
  assert.equal(customCostsError(['custom'], labor, [material, manual], 'en'), undefined)
  for (const equipmentCount of [1, 2, 10])
    assert.equal(calculatePackageCost(p, equipmentCount, rates, 126110000, 5, 14, labor, [material, manual]).material, 45.46356)
})

test('part number and natural-number quantities are mandatory in both languages', () => {
  for (const language of ['en', 'fr']) {
    assert.equal(materialEntryError(material, language), undefined)
    for (const change of [{ part: '' }, { part: '  ' }, { quantity: 0 }, { quantity: -1 }, { quantity: 1.01 },
      { quantity: NaN }, { quantity: Infinity }, { quantity: 100001 }]) {
      assert.ok(materialEntryError({ ...material, ...change }, language))
      assert.throws(() => calculateCustomMaterialTotal([{ ...material, ...change }]), /Complete/)
    }
  }
  for (const quantity of [1, 2, 100000])
    assert.equal(materialEntryError({ ...material, quantity }, 'en'), undefined)
})

test('invalid costs and saved package-priced references cannot masquerade as itemized totals', () => {
  for (const unitCost of [0, -1, NaN, Infinity])
    assert.throws(() => calculateCustomMaterialTotal([{ ...material, unitCost }]), /Complete/)
  assert.throws(() => calculateCustomMaterialTotal([{ ...material, pricingSource: 'package', unitCost: 0 }]), /package amounts/)
})
