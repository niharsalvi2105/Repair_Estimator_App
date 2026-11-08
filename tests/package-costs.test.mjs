import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateAdditionalCost, calculateEquipmentPackageCost, calculatePackageCost, calculatePackageUnitCost, packageCost } from '../src/data/packageCosts.ts'
import { customCostsError } from '../src/data/requestValidation.ts'

test('package costs scale hours and material by equipment and apply additive material tax and freight', () => {
  assert.deepEqual(packageCost(2, 50, 3, 100, 5, 10),
    { hours: 6, labor: 600, material: 150, total: 772.5 })
  assert.throws(() => packageCost(NaN, 50, 3, 100, 5, 10), /invalid/)
  assert.throws(() => packageCost(2, 50, 0, 100, 5, 10), /invalid/)
})

test('additional costs show labor, material, miscellaneous, tax and freight counted once', () => {
  const rates = [{ role: 126110000, time: 126110000, rate: 100 }]
  const cost = calculateAdditionalCost(2, 10, 5, rates, 126110000, 5, 14)
  assert.deepEqual(cost, { hours: 2, labor: 200, material: 10, miscellaneous: 5, rate: 100,
    tax: 5, freight: 14, taxAmount: 0.75, freightAmount: 2.1, total: 217.85 })
  assert.equal(calculateAdditionalCost(0, 0, 0, rates, 126110000, 5, 14).total, 0)
  assert.equal(calculateAdditionalCost(0, 10, 5, rates, 126110000, 8, 20).total, 19.2)
  for (const [hours, material, misc] of [[-1, 0, 0], [0, -1, 5], [0, 5, -1], [NaN, 0, 0], [0, Infinity, 0]])
    assert.throws(() => calculateAdditionalCost(hours, material, misc, rates, 126110000, 5, 14), /invalid/)
  for (const [tax, freight] of [[NaN, 14], [5, NaN], [101, 14], [5, -1]])
    assert.throws(() => calculateAdditionalCost(1, 10, 5, rates, 126110000, tax, freight), /invalid/)
  assert.throws(() => calculateAdditionalCost(1, 0, 0, [], 126110000, 5, 14), /missing or ambiguous/)
  assert.throws(() => calculateAdditionalCost(1, 0, 0, [...rates, rates[0]], 126110000, 5, 14), /ambiguous/)
})

test('each custom package requires assigned positive labor and material entries', () => {
  const labor = [{ id: 'l', packageId: 'a', role: 126110000, time: 126110000, hours: 2 }]
  const materials = [{ id: 'm', packageId: 'a', part: 'MOTOR-1', description: 'Motor', quantity: 1, unitCost: 10 }]
  assert.equal(customCostsError(['a'], labor, materials, 'en'), undefined)
  assert.ok(customCostsError(['a', 'b'], labor, materials, 'en'))
  assert.ok(customCostsError(['a'], [], materials, 'en'))
  assert.ok(customCostsError(['a'], labor, [], 'en'))
  for (const hours of [0, -1, NaN]) assert.ok(customCostsError(['a'], [{ ...labor[0], hours }], materials, 'en'))
  for (const change of [{ quantity: 0 }, { quantity: 1.5 }, { part: ' ' }, { unitCost: 0 }, { description: ' ' }, { packageId: null }])
    assert.ok(customCostsError(['a'], labor, [{ ...materials[0], ...change }], 'en'))
  assert.ok(customCostsError(['a'], [{ ...labor[0], packageId: null }], materials, 'fr'))
  assert.equal(customCostsError([], [], [], 'en'), undefined)
})

test('standard previews always use fixed 5% tax and 14% freight regardless of CSTM inputs', () => {
  const p = { re_repairpackageid: 'standard', re_iscustompackage: false, re_mechanichours: 2, re_materialmisctaxcost: 50 }
  const rates = [{ role: 126110000, time: 126110000, rate: 100 }]
  for (const [tax, freight] of [[0, 0], [8, 20], [NaN, NaN]]) {
    assert.deepEqual(calculatePackageCost(p, 3, rates, 126110000, tax, freight, [], []),
      { hours: 6, labor: 600, material: 150, rate: 100, total: 778.5 })
  }
})

test('custom previews isolate packages, use branch role/time rates and count entered costs once', () => {
  const rates = [{ role: 126110000, time: 126110000, rate: 100 }, { role: 126110001, time: 126110001, rate: 200 }]
  const p = { re_repairpackageid: 'a', re_iscustompackage: true, re_mechanichours: 0, re_materialmisctaxcost: 0 }
  const labor = [{ id: 'l', packageId: 'a', role: 126110001, time: 126110001, hours: 2 },
    { id: 'other', packageId: 'b', role: 126110000, time: 126110000, hours: 100 }]
  const materials = [{ id: 'm', packageId: 'a', part: 'MOTOR-1', description: 'Motor', quantity: 2, unitCost: 25 }]
  assert.deepEqual(calculatePackageCost(p, 3, rates, 126110000, 5, 10, labor, materials),
    { hours: 2, rate: 100, labor: 400, material: 50, total: 457.5 })
  assert.equal(calculatePackageCost(p, 3, rates, 126110000, 8, 20, labor, materials).total, 464)
  assert.throws(() => calculatePackageCost(p, 3, rates, 126110000, NaN, NaN, labor, materials), /invalid/)
  assert.throws(() => calculatePackageCost(p, 3, [], 126110000, 5, 10, labor, materials), /missing or ambiguous/)
  assert.throws(() => calculatePackageCost(p, 3, rates, 126110000, 5, 10, [], materials), /Complete the CSTM/)
  assert.throws(() => calculatePackageCost(p, 3, [...rates, rates[0]], 126110000, 5, 10, labor, materials), /ambiguous/)
})

test('package KONE amounts scale once per equipment, not per descriptive part or quantity', () => {
  const p = { re_repairpackageid: 'a', re_iscustompackage: true, re_mechanichours: 1,
    re_materialbeforemarkup: 617.45, re_materialmisctaxcost: 849.77 }
  const rates = [{ role: 126110000, time: 126110000, rate: 100 }]
  const labor = [{ id: 'l', packageId: 'a', role: 126110000, time: 126110000, hours: 0.5 }]
  const reference = { id: 'm', packageId: 'a', description: 'Motor', vendor: 'KONE', part: 'KM1',
    quantity: 99, unitCost: 0, partType: 'kone', pricingSource: 'package' }
  const manual = { ...reference, id: 'n', quantity: 1, unitCost: 10, partType: 'non-kone', pricingSource: 'manual' }
  const materials = [reference, { ...reference, id: 'm2' }, manual]
  assert.equal(customCostsError(['a'], labor, materials, 'en'), undefined)
  const cost = calculatePackageCost(p, 2, rates, 126110000, 5, 10, labor, materials)
  assert.equal(cost.material, 1244.9)
  assert.equal(cost.total, 1496.4)
  assert.equal(cost.koneFinal, 1699.54)
  assert.ok(customCostsError(['a'], labor, [{ ...reference, unitCost: 1 }], 'en'))
  assert.ok(customCostsError(['a'], labor, [{ ...reference, markupPercent: 10 }], 'en'))
  assert.throws(() => calculatePackageCost({ ...p, re_materialbeforemarkup: undefined },
    2, rates, 126110000, 5, 10, labor, materials), /Before Markup/)
})

test('per-equipment package previews exclude custom rows and preserve standard fixed rates', () => {
  const rates = [{ role: 126110000, time: 126110000, rate: 187.65 }]
  const standard = { re_repairpackageid: 'psr', re_iscustompackage: false, re_mechanichours: 8, re_materialmisctaxcost: 123.39 }
  const unit = calculatePackageUnitCost(standard, rates, 126110000, NaN, NaN, [])
  assert.equal(unit.total, 1648.0341)
  assert.equal(unit.hours, 8)
  assert.equal(unit.rate, 187.65)
  assert.equal(unit.labor, 1501.2)
  assert.equal(unit.material, 123.39)
  assert.equal(unit.tax, 5)
  assert.equal(unit.freight, 14)
  assert.equal(unit.taxAmount, 6.1695)
  assert.ok(Math.abs(unit.freightAmount - 17.2746) < 1e-9)
  assert.ok(Math.abs(unit.total - (unit.labor + unit.material + unit.taxAmount + unit.freightAmount)) < 1e-9)
  assert.ok(Math.abs(calculatePackageCost(standard, 11, rates, 126110000, 0, 0, [], []).total - unit.total * 11) < 1e-9)
  const custom = { ...standard, re_repairpackageid: 'cstm', re_iscustompackage: true, re_mechanichours: 1, re_materialmisctaxcost: 10 }
  const materials = [{ id: 'm', packageId: 'cstm', part: 'MOTOR-1', description: 'Estimate-level motor', quantity: 2, unitCost: 50 }]
  const labor = [{ id: 'l', packageId: 'cstm', role: 126110000, time: 126110000, hours: 2 }]
  assert.ok(Math.abs(calculatePackageUnitCost(custom, rates, 126110000, 8, 20, materials).total - 200.45) < 1e-9)
  assert.ok(Math.abs(calculatePackageCost(custom, 3, rates, 126110000, 8, 20, labor, materials).total
    - (200.45 * 3 + 375.3 + 128)) < 1e-9)
})

test('per-equipment KONE true cost ignores descriptive quantity and extra tax/freight', () => {
  const p = { re_repairpackageid: 'kone', re_iscustompackage: true, re_mechanichours: 1,
    re_materialbeforemarkup: 617.45, re_materialmisctaxcost: 849.77 }
  const rates = [{ role: 126110000, time: 126110000, rate: 100 }]
  const reference = { id: 'm', packageId: 'kone', description: 'KONE', quantity: 99, unitCost: 0, partType: 'kone', pricingSource: 'package' }
  assert.equal(calculatePackageUnitCost(p, rates, 126110000, NaN, NaN, [reference, { ...reference, id: 'm2' }]).total, 717.45)
  const unit = calculatePackageUnitCost(p, rates, 126110000, 8, 20, [reference])
  assert.equal(unit.packagePriced, true)
  assert.equal(unit.tax, 0)
  assert.equal(unit.freight, 0)
  assert.equal(unit.taxAmount, 0)
  assert.equal(unit.freightAmount, 0)
  assert.throws(() => calculatePackageUnitCost({ ...p, re_materialbeforemarkup: undefined }, rates, 126110000, 5, 14, [reference]), /Before Markup/)
  assert.throws(() => calculatePackageUnitCost(p, [], 126110000, 5, 14, []), /missing or ambiguous/)
  assert.throws(() => calculatePackageUnitCost(p, [...rates, rates[0]], 126110000, 5, 14, []), /ambiguous/)
  assert.throws(() => calculatePackageUnitCost(p, rates, 126110000, NaN, 14, []), /invalid/)
})

test('CSTM equipment cards include entered hours and costs exactly once across assigned equipment', () => {
  const rates = [{ role: 126110000, time: 126110000, rate: 100 },
    { role: 126110001, time: 126110001, rate: 200 }]
  const p = { re_repairpackageid: 'cstm', re_iscustompackage: true, re_mechanichours: 0, re_materialmisctaxcost: 0 }
  const labor = [{ id: 'l', packageId: 'cstm', role: 126110001, time: 126110001, hours: 6 },
    { id: 'other', packageId: 'other', role: 126110000, time: 126110000, hours: 100 }]
  const materials = [{ id: 'm', packageId: 'cstm', part: 'MOTOR-1', description: 'Motor', quantity: 2, unitCost: 25 },
    { id: 'other', packageId: 'other', part: 'OTHER', description: 'Other', quantity: 1, unitCost: 999 }]
  for (const quantity of [1, 2, 3, 21]) {
    const unit = calculateEquipmentPackageCost(p, quantity, rates, 126110000, 5, 10, labor, materials)
    const total = calculatePackageCost(p, quantity, rates, 126110000, 5, 10, labor, materials)
    assert.equal(unit.rate, 200)
    for (const field of ['hours', 'labor', 'material', 'total'])
      assert.ok(Math.abs(unit[field] * quantity - total[field]) < 1e-9, `${field}, ${quantity} equipment`)
    assert.ok(Math.abs(unit.total - unit.labor - unit.material - unit.taxAmount - unit.freightAmount) < 1e-9)
  }
  const unit = calculateEquipmentPackageCost(p, 2, rates, 126110000, 5, 10, labor, materials)
  assert.equal(unit.hours, 3)
  assert.equal(unit.labor, 600)
  assert.equal(unit.material, 25)
  assert.equal(unit.total, 628.75)
  assert.equal(unit.taxAmount, 1.25)
  assert.equal(unit.freightAmount, 2.5)
  assert.equal(calculateEquipmentPackageCost(p, 2, rates, 126110000, 5, 10,
    [{ ...labor[0], hours: 8, rate: 175 }], materials).labor, 700)
  assert.throws(() => calculateEquipmentPackageCost(p, 0, rates, 126110000, 5, 10, labor, materials), /invalid/)
  assert.throws(() => calculateEquipmentPackageCost(p, 2, rates, 126110000, 5, 10, [], materials), /Complete the CSTM/)
  assert.throws(() => calculateEquipmentPackageCost(p, 2, rates, 126110000, 5, 10, labor, []), /Complete the CSTM/)
  assert.throws(() => calculateEquipmentPackageCost(p, 2, [], 126110000, 5, 10, labor, materials), /missing or ambiguous/)
})

test('CSTM equipment allocation preserves predefined costs, KONE exceptions and saved mixed-role rates', () => {
  const p = { re_repairpackageid: 'cstm', re_iscustompackage: true, re_mechanichours: 1,
    re_materialbeforemarkup: 617.45, re_materialmisctaxcost: 849.77 }
  const rates = [{ role: 126110000, time: 126110000, rate: 100 }]
  const labor = [{ id: 'l', packageId: 'cstm', role: 126110001, time: 126110001, hours: 2, rate: 200 },
    { id: 'l2', packageId: 'cstm', role: 126110000, time: 126110000, hours: 1 }]
  const materials = [{ id: 'm', packageId: 'cstm', part: 'KM1', description: 'KONE reference',
    quantity: 99, unitCost: 0, partType: 'kone', pricingSource: 'package' },
    { id: 'manual', packageId: 'cstm', part: 'BR1', description: 'Bracket', quantity: 2, unitCost: 25 }]
  const unit = calculateEquipmentPackageCost(p, 2, rates, 126110000, 5, 10, labor, materials)
  assert.equal(unit.hours, 2.5)
  assert.equal(unit.rate, 140)
  assert.equal(unit.labor, 350)
  assert.equal(unit.material, 642.45)
  assert.equal(unit.taxAmount, 1.25)
  assert.equal(unit.freightAmount, 2.5)
  assert.equal(unit.total, 996.2)
  assert.equal(unit.total * 2, calculatePackageCost(p, 2, rates, 126110000, 5, 10, labor, materials).total)
  const standard = { ...p, re_iscustompackage: false }
  assert.deepEqual(calculateEquipmentPackageCost(standard, 2, rates, 126110000, NaN, NaN, labor, materials),
    calculatePackageUnitCost(standard, rates, 126110000, NaN, NaN, materials))
})
