import test from 'node:test'
import assert from 'node:assert/strict'
import { cloneRequest, DEFAULT_CLONE_SECTIONS, OPPORTUNITY_FIELDS, opportunityValues, parseOpportunityValues } from '../src/data/requestClone.ts'
import { revalidateClone } from '../src/data/cloneValidation.ts'

function source() {
  return {
    id: 'old', mode: 'load', version: '42', number: '00042', status: 126110002, title: 'Old job',
    salesperson: 'Old salesperson', pricingState: '2026.4', market: 126110000, branchId: 'branch', stateId: 'state',
    equipmentTypeId: 'type', jobTypeId: 'job', building: 'Office', customer: 'Customer', email: 'test@example.invalid', phone: '',
    fields: [...OPPORTUNITY_FIELDS.map(key => ({ key, value: key === 're_proposallanguage' ? '126110000' : '' })),
      { key: 're_hasbeenapproved', value: '126110000' }, { key: 're_sellprice', value: '500' },
      { key: 're_statedlaborrate', value: '200' }, { key: 're_additionalscope', value: 'Scope' },
      { key: 're_konesparessalespricevk13', value: '99' }, { key: 're_billingplan', value: '126110001' }],
    equipment: [{ id: 'equipment', number: 'E1', name: 'Old', matched: true }],
    packages: [{ id: 'package', number: 'CSTM', nameEn: 'Old', hours: 2, material: 200, isCustom: true }],
    laborLines: [{ id: 'labor', packageId: 'package', role: 126110000, time: 126110000, hours: 2, rate: 500 }],
    materialLines: [{ id: 'material', packageId: 'package', catalogPartId: 'part', unitCost: 20, quantity: 1 }],
  }
}
function transport() {
  return {
    branches: async () => [{ re_branchid: 'branch', re_market: 126110000, _re_country_value: 'country', _re_currency_value: 'currency' }],
    references: async () => ({ equipmentTypes: [{ id: 'type' }], jobTypes: [{ id: 'job' }] }),
    locations: async () => ({ currencies: [{ id: 'currency' }], states: [{ id: 'state', countryId: 'country' }] }),
    choices: async () => ({ re_proposallanguage: [{ value: 126110000 }], re_billingplan: [{ value: 126110001 }] }),
    equipment: async (_branch, numbers) => numbers.map(number => ({
      re_equipmentid: number === 'E1' ? 'equipment' : number, re_equipment: number, re_equipmentname: 'Current master',
    })),
    packages: async () => [{ re_repairpackageid: 'package', re_packagenumber: 'CSTM', re_packagenameen: 'Current package',
      re_mechanichours: 3, re_materialmisctaxcost: 300, re_iscustompackage: true }],
  }
}
test('default clone copies only approved Opportunity values, with fresh unsaved identity', () => {
  const original = source()
  const before = structuredClone(original)
  const copy = cloneRequest(original, DEFAULT_CLONE_SECTIONS, 'new')
  assert.equal(copy.id, 'new')
  assert.equal(copy.version, null)
  assert.equal(copy.title, '')
  for (const key of ['number', 'status', 'salesperson', 'pricingState']) assert.equal(copy[key], undefined)
  assert.deepEqual(copy.fields.map(field => field.key), [...OPPORTUNITY_FIELDS])
  assert.deepEqual(copy.equipment, [])
  assert.deepEqual(copy.packages, [])
  assert.deepEqual(copy.laborLines, [])
  assert.deepEqual(original, before)
})
test('custom cloning preserves selected inputs but refreshes rates, catalog snapshots and line IDs', () => {
  const original = source()
  const copy = cloneRequest(original, { opportunity: false, equipment: true, packages: true, custom: true, notes: true }, 'new')
  assert.equal(copy.branchId, 'branch')
  assert.equal(copy.customer, '')
  assert.equal(copy.stateId, '')
  assert.equal(copy.laborLines[0].rate, undefined)
  assert.notEqual(copy.laborLines[0].id, 'labor')
  assert.notEqual(copy.materialLines[0].id, 'material')
  assert.equal(copy.materialLines[0].refreshPart, true)
  assert.deepEqual(copy.fields.map(field => field.key), ['re_additionalscope', 're_billingplan'])
  copy.packages[0].nameEn = 'Copy only'
  assert.equal(original.packages[0].nameEn, 'Old')
  assert.throws(() => cloneRequest(original, { ...DEFAULT_CLONE_SECTIONS, opportunity: false }, 'new'), /at least one/)
  assert.throws(() => cloneRequest(original, { ...DEFAULT_CLONE_SECTIONS, custom: true }, 'new'), /require package/)
})
test('preset parser rejects missing required values, unapproved, duplicate and oversized fields', () => {
  const values = opportunityValues(source())
  assert.deepEqual(parseOpportunityValues(values), values)
  for (const invalid of [null, {}, { ...values, email: '' }, { ...values, market: 0 },
    { ...values, customer: 'x'.repeat(301) }, { ...values, fields: [] },
    { ...values, fields: [...values.fields, { key: 're_sellprice', value: '100' }] },
    { ...values, fields: [...values.fields, values.fields[0]] }])
    assert.throws(() => parseOpportunityValues(invalid))
})
test('cloning refreshes matched equipment and packages from current master while retaining unlisted details', async () => {
  const copy = cloneRequest(source(), { opportunity: true, equipment: true, packages: true, custom: true, notes: true }, 'new')
  copy.equipment.push({ id: 'local', number: 'U1', name: 'Unlisted', location: 'Lobby', oem: 'OEM', age: 0, matched: false })
  const validated = await revalidateClone(copy, transport())
  assert.equal(validated.equipment[0].name, 'Current master')
  assert.equal(validated.equipment[1].name, 'Unlisted')
  assert.equal(validated.equipment[1].age, 0)
  assert.equal(validated.equipment[1].customer, 'Customer')
  assert.equal(validated.packages[0].nameEn, 'Current package')
  assert.equal(validated.packages[0].material, 300)
})
test('stale or ambiguous master data rejects the clone instead of dropping or downgrading entries', async () => {
  const copy = cloneRequest(source(), { opportunity: true, equipment: true, packages: true, custom: true, notes: true }, 'new')
  for (const override of [
    { branches: async () => [] },
    { locations: async () => ({ currencies: [], states: [] }) },
    { references: async () => ({ equipmentTypes: [], jobTypes: [] }) },
    { choices: async () => ({}) }, { equipment: async () => [] },
    { equipment: async () => [{ re_equipment: 'E1', re_equipmentid: 'replacement' }] },
    { equipment: async () => Array(2).fill({ re_equipment: 'E1', re_equipmentid: 'equipment' }) },
    { packages: async () => [] },
    { packages: async () => [{ re_repairpackageid: 'package', re_packagenumber: 'P1', re_iscustompackage: false }] },
  ]) await assert.rejects(() => revalidateClone(copy, { ...transport(), ...override }))
})
test('equipment validation batches over fifty identifiers without truncation', async () => {
  const copy = cloneRequest(source(), { ...DEFAULT_CLONE_SECTIONS, equipment: true }, 'new')
  copy.equipment = Array.from({ length: 123 }, (_, i) => ({ id: `E${i + 2}`, number: `E${i + 2}`, matched: true }))
  const batches = []
  const api = transport()
  const result = await revalidateClone(copy, { ...api, equipment: async (branch, numbers) => {
    batches.push(numbers.length)
    return api.equipment(branch, numbers)
  } })
  assert.deepEqual(batches, [50, 50, 23])
  assert.equal(result.equipment.length, 123)
})

test('package-priced KONE clones keep descriptive parts but refresh both package amounts', async () => {
  const original = source()
  original.packages[0].materialBeforeMarkup = 50
  original.materialLines = [{ id: 'm', packageId: 'package', description: 'Motor', part: 'KM1', vendor: 'KONE',
    pricingSource: 'package', partType: 'kone', quantity: 99, unitCost: 0 }]
  const copy = cloneRequest(original, { opportunity: true, equipment: true, packages: true, custom: true, notes: false }, 'new')
  const current = transport()
  const validated = await revalidateClone(copy, { ...current, packages: async () => (await current.packages())
    .map(p => ({ ...p, re_materialbeforemarkup: 200 })) })
  assert.equal(validated.packages[0].materialBeforeMarkup, 200)
  assert.equal(validated.packages[0].material, 300)
  assert.equal(validated.materialLines[0].pricingSource, 'package')
  assert.equal(validated.materialLines[0].part, 'KM1')
  assert.equal(validated.materialLines[0].refreshPart, false)
  assert.equal(original.packages[0].materialBeforeMarkup, 50)
})
