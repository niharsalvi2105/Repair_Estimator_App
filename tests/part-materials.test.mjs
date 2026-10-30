import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { calculatePartMaterial } from '../src/data/partMaterials.ts'

const config = {
  version: 'test-v1', usdToCadFactor: 1.4, costOnlyFactor: 1.23, defaultMarkupPercent: 10,
  koneTaxPercent: 5, koneFreightPercent: 10, materialTaxPercent: 5, materialFreightPercent: 14,
}
const part = {
  id: 'test-part', number: '000123', description: 'Test part', type: 'kone',
  usdCostPerUnit: 100, usdPricePerPricingUnit: 100, pricingUnit: 1, uom: 'PC', sourceVersion: 'test-v1',
}
const input = {
  type: 'kone', source: 'catalog', part, manualNumber: '', manualDescription: '',
  manualUnitCost: '', quantity: '1', markupPercent: '10',
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`)

test('MKO retains USD; CKE and CKQ use different workbook factors for price and cost', () => {
  const usd = calculatePartMaterial(input, 'MKO', config)
  assert.equal(usd.currency, 'USD')
  assert.equal(usd.unitCost, 100)
  assert.equal(usd.unitPrice, 100)
  near(usd.sellingContribution, 125)
  for (const market of ['CKE', 'CKQ']) {
    const cad = calculatePartMaterial(input, market, config)
    assert.equal(cad.currency, 'CAD')
    near(cad.unitCost, 172.2)
    near(cad.unitPrice, 140)
    near(cad.totalCost, 172.2 * 1.19)
    near(cad.sellingContribution, 175)
  }
})

test('CAD unit values retain workbook precision before quantity extension', () => {
  const result = calculatePartMaterial({ ...input, quantity: '3',
    part: { ...part, usdCostPerUnit: 4.49, usdPricePerPricingUnit: 28.84 } }, 'CKQ', config)
  near(result.unitCost, 7.73178)
  near(result.unitPrice, 40.376)
  near(result.materialCost, 23.19534)
})

test('markup changes VK13 contribution but never internal cost', () => {
  const amounts = [0, 10, 100].map((markup) => calculatePartMaterial({
    ...input, quantity: '2', markupPercent: String(markup),
  }, 'MKO', config))
  assert.ok(amounts.every((value) => value.materialCost === 200))
  near(amounts[0].sellingContribution, 230)
  near(amounts[1].sellingContribution, 250)
  near(amounts[2].sellingContribution, 430)
  near(amounts[1].markupAmount, 20)
})

test('pricing unit applies to source selling price, not per-unit source cost', () => {
  const result = calculatePartMaterial({ ...input, part: { ...part, pricingUnit: 10 }, quantity: '2' }, 'MKO', config)
  assert.equal(result.unitCost, 100)
  assert.equal(result.unitPrice, 10)
  near(result.sellingContribution, 25)
})

test('non-KONE manual amounts are already in estimate currency', () => {
  const manual = { ...input, source: 'manual', type: 'non-kone', part: undefined,
    manualNumber: 'CUSTOM-1', manualDescription: 'Manual part', manualUnitCost: '12.34567', quantity: '2' }
  for (const market of ['MKO', 'CKE', 'CKQ']) {
    const result = calculatePartMaterial(manual, market, config)
    near(result.materialCost, 24.69134)
    assert.equal(result.unitCost, 12.34567)
    assert.equal(result.sellingContribution, undefined)
  }
  const catalog = calculatePartMaterial({ ...input, type: 'non-kone',
    part: { ...part, type: 'non-kone', usdPricePerPricingUnit: undefined } }, 'CKE', config)
  near(catalog.unitCost, 172.2)
  assert.equal(catalog.sellingContribution, undefined)
})

test('invalid or ambiguous material input never produces valid-looking totals', () => {
  for (const quantity of ['', '-1', '0', 'NaN', 'Infinity', '100001'])
    assert.throws(() => calculatePartMaterial({ ...input, quantity }, 'MKO', config), /quantity/)
  for (const markupPercent of ['', '-1', '101', 'NaN'])
    assert.throws(() => calculatePartMaterial({ ...input, markupPercent }, 'MKO', config), /markup/)
  assert.throws(() => calculatePartMaterial({ ...input, source: 'manual' }, 'MKO', config), /koneCatalogRequired/)
  assert.throws(() => calculatePartMaterial({ ...input, part: undefined }, 'MKO', config), /selectPart/)
  assert.throws(() => calculatePartMaterial({ ...input, type: 'non-kone' }, 'MKO', config), /classification/)
  assert.throws(() => calculatePartMaterial({ ...input, part: { ...part, usdCostPerUnit: NaN } }, 'MKO', config), /cost/)
  assert.throws(() => calculatePartMaterial({ ...input, part: { ...part, usdPricePerPricingUnit: 0 } }, 'MKO', config), /price/)
  assert.throws(() => calculatePartMaterial({ ...input, part: { ...part, pricingUnit: 0 } }, 'MKO', config), /pricingUnit/)
  assert.throws(() => calculatePartMaterial(input, 'CKE', { ...config, usdToCadFactor: NaN }), /configuration/)
})

test('catalog schema is explicitly undeployed and includes precise snapshots and both scopes', async () => {
  const schema = JSON.parse(await readFile(new URL('../backend/parts-catalog-schema.json', import.meta.url), 'utf8'))
  assert.equal(schema.status, 'design-only-not-deployed')
  assert.equal(schema.productionImportEnabled, false)
  const table = schema.tables.find((entry) => entry.logicalName === 're_sparepart')
  assert.deepEqual(table.alternateKey, ['re_sourcekey'])
  assert.equal(table.columns.re_usdcost.precision, 6)
  assert.equal(table.columns.re_partnumber.type, 'String')
  const snapshots = schema.extendTables.find((entry) => entry.logicalName === 're_estimatematerialline').columns
  assert.equal(snapshots.re_unitcostprecise.precision, 10)
  assert.equal(snapshots.re_estimatepackage.target, 're_estimatepackage')
  assert.equal(snapshots.re_materialscope.values['126110001'], 'Additional material')
  assert.equal(snapshots.re_markuppct.max, 100)
})
