import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePartCatalog } from '../src/data/partCatalogContract.ts'
import { parseDraft } from '../src/data/draftContract.ts'
import { materialEntryError } from '../src/data/customMaterialCosts.ts'
import { customCostsError } from '../src/data/requestValidation.ts'
import { missingMaterialSellingPrices } from '../src/data/materialSaveVerification.ts'

const details = () => ({
  version: 1, number: 'TEST-ZERO', masterPartType: 'non-kone', state: 1,
  sourceCost: 0, sourcePrice: 0, pricingUnit: 1, sourceCurrency: 'USD',
  sourceKey: 'test-source', sourceVersion: 'test-v1', description: null, descriptionFr: null, uom: null,
  effectiveFrom: '2020-01-01', effectiveTo: '2020-12-31', refreshedOn: '2026-01-01T00:00:00Z',
  salesOrganization: null, distributionChannel: null, conditionRecord: null,
  unitCost: 0, unitPrice: 0, requiresCost: true, requiresSellingPrice: true,
  requiresDescription: true, requiresUom: true, issues: ['inactive', 'expired', 'invalid-cost', 'invalid-price'],
})
const part = () => ({
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', number: 'TEST-ZERO', description: '',
  partType: 'non-kone', unitCost: 0, unitPrice: 0, uom: '', details: details(),
})
const result = () => ({
  mode: 'partcatalog', catalogVersion: 2, available: true, currency: 'USD',
  defaultMarkupPercent: 10, more: false, parts: [part()],
})
const material = () => ({
  id: 'new', packageId: 'p', catalogPartId: part().id, catalogDetails: details(),
  part: 'TEST-ZERO', partType: 'kone', markupPercent: 10, description: 'Completed description',
  unitCost: 8.123456789, unitPrice: 0, sellingPrice: 12.3456789012, uom: 'PC', quantity: 1, vendor: 'KONE',
})
const record = line => ({
  mode: 'load', id: 'draft', version: '1', title: 'Synthetic', branchId: 'b', stateId: 's',
  equipmentTypeId: 't', jobTypeId: '', building: '', customer: 'Synthetic', email: '', phone: '',
  market: 126110000, fields: [],
  equipment: [{ id: '', number: 'E1', matched: false, name: '', location: '', customer: '', oem: '' }],
  packages: [{ id: 'p', number: 'P1', nameEn: 'Custom', scopeEn: '', hours: 0, material: 0 }],
  materialLines: [line],
})

test('inactive, expired and incomplete parts remain valid results with original zero and null values', () => {
  const parsed = parsePartCatalog(result()).parts[0]
  assert.equal(parsed.unitPrice, 0)
  assert.equal(parsed.details.description, null)
  assert.deepEqual(parsed.details.issues, details().issues)
  const unavailable = { ...result(), available: false, parts: [], currency: null, reason: 'Missing snapshot schema.' }
  assert.equal(parsePartCatalog(unavailable).reason, unavailable.reason)
})

test('older filtering APIs and broken pagination are rejected instead of hiding parts', () => {
  for (const change of [{ catalogVersion: undefined }, { catalogVersion: 1 },
    { more: true }, { more: true, nextPage: 2 }, { more: true, nextCursor: 'cookie' }])
    assert.throws(() => parsePartCatalog({ ...result(), ...change }), /deployed backend/)
  assert.equal(parsePartCatalog({ ...result(), more: true, nextPage: 2, nextCursor: 'cookie' }).more, true)
  assert.throws(() => parsePartCatalog({ ...result(), parts: [{ ...part(), details: { ...details(), number: 'OTHER' } }] }),
    /inconsistent/)
})

test('both selected classifications allow manual completion while preserving master classification and source zero price', () => {
  for (const partType of ['kone', 'non-kone']) {
    const line = { ...material(), partType, markupPercent: partType === 'kone' ? 10 : undefined }
    const saved = parseDraft(record(line)).materialLines[0]
    assert.equal(saved.partType, partType)
    assert.equal(saved.catalogDetails.masterPartType, 'non-kone')
    assert.equal(saved.unitPrice, 0)
    assert.equal(saved.sellingPrice, 12.3456789012)
    for (const language of ['en', 'fr']) {
      assert.equal(materialEntryError(line, language), undefined)
      for (const change of [{ sellingPrice: undefined }, { sellingPrice: 0 }, { unitCost: 0 },
        { unitCost: .12345678901 }, { description: ' ' }, { uom: '' }, { uom: 'x'.repeat(21) }])
        assert.ok(materialEntryError({ ...line, ...change }, language))
    }
    for (const change of [{ sellingPrice: undefined }, { unitCost: 0 }, { uom: '' },
      { catalogDetails: { ...details(), number: 'OTHER' } }])
      assert.throws(() => parseDraft(record({ ...line, ...change })), /material/i)
  }
})

test('KONE markup is fixed at ten, not a configurable cost uplift', () => {
  const labor = [{ id: 'l', packageId: 'p', role: 126110000, time: 126110000, hours: 1 }]
  assert.equal(customCostsError(['p'], labor, [material()], 'en'), undefined)
  for (const markupPercent of [undefined, 0, 9.99, 20, 100])
    assert.match(customCostsError(['p'], labor, [{ ...material(), markupPercent }], 'en'), /fixed at 10/)
  assert.ok(customCostsError(['p'], labor, [{ ...material(), partType: 'non-kone' }], 'en'))
})

test('manual KONE requires explicit selling price and does not accept catalog or VK13 snapshots', () => {
  const line = { ...material(), pricingSource: 'manual', catalogPartId: undefined, catalogDetails: undefined,
    uom: undefined, unitPrice: undefined, unitCost: 25, sellingPrice: 30 }
  assert.equal(customCostsError(['p'], [], [line], 'en'), undefined)
  assert.equal(parseDraft(record(line)).materialLines[0].sellingPrice, 30)
  for (const change of [{ sellingPrice: undefined }, { sellingPrice: 0 }, { unitCost: 25.001 },
    { markupPercent: 9 }, { unitPrice: 30 }, { catalogPartId: part().id }, { partType: 'non-kone' }]) {
    const invalid = { ...line, ...change }
    assert.ok(customCostsError(['p'], [], [invalid], 'en'))
    assert.throws(() => parseDraft(record(invalid)), /material/i)
  }
})

test('save verification detects dropped manual completion and source evidence even with new server IDs', () => {
  const sent = material()
  const received = { ...sent, id: 'server' }
  assert.equal(missingMaterialSellingPrices([sent], [received], []), false)
  for (const change of [{ unitCost: 1 }, { description: 'Changed' }, { uom: 'EA' }, { catalogDetails: undefined }])
    assert.equal(missingMaterialSellingPrices([sent], [{ ...received, ...change }], []), true)
})
