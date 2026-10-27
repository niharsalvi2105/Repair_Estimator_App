import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { projectMasterSchema } from '../src/data/masterSchemaProjection.ts'

const approved = [
  'countries', 'state_provinces', 'branches', 'salesoffices', 'margingroups', 'equipmenttypes',
  'equipment', 'customerverticals', 'jobtypes', 'packagecategories', 'repairpackages', 'scopelibraries',
  'laborrates', 'jobsizebands', 'redundancybands', 'oembandrules', 'bandmatrices', 'marginrules',
  'situationaladjustments', 'incentiverates', 'pricingparameters',
]

test('compact master projections preserve every approved field and its validation metadata', () => {
  for (const file of approved) {
    const source = JSON.parse(readFileSync(new URL(`../.power/schemas/dataverse/${file}.Schema.json`, import.meta.url), 'utf8'))
    const projected = projectMasterSchema(source)
    const item = source.schema.items
    assert.equal(projected.summary.logicalName, source.name)
    assert.equal(projected.summary.id, item['x-ms-dataverse-primary-id'])
    assert.equal(projected.summary.primary, item['x-ms-dataverse-primary-name'])
    assert.equal(projected.summary.entitySet, item['x-ms-dataverse-entityset'])
    const fields = Object.entries(item.properties).filter(([name, value]) =>
      name.startsWith('re_') && !value['x-ms-dataverse-attribute-of'] && !value['x-ms-dataverse-primary-id'])
    assert.deepEqual(projected.fields.map((field) => field.name), fields.map(([name]) => name))
    for (const [index, [, original]] of fields.entries()) {
      const field = projected.fields[index]
      assert.equal(field.label, String(original.title))
      assert.equal(field.kind, String(original['x-ms-dataverse-type']))
      assert.equal(field.required, original.required === true)
      assert.equal(field.readOnly, original['x-ms-read-only'] === true)
      assert.equal(field.create, !original['x-ms-read-only'])
      assert.equal(field.update, !original['x-ms-read-only'])
      assert.equal(field.maxLength, original.maxLength)
      assert.equal(field.navigation, original['x-ms-dataverse-navigation-properties']?.[0])
      assert.deepEqual(field.options, (original['x-ms-enum-values'] ?? []).map((value, i) =>
        ({ value: Number(value), label: String(original.enum?.[i]) })))
    }
    assert.deepEqual(projected.summary.nameFields, projected.fields.filter((field) =>
      /(?:name|jobtype)(?:en|fr)$/.test(field.name) && field.kind === 'StringType').map((field) => field.name))
    assert.ok(JSON.stringify(projected).length < JSON.stringify(source).length / 2)
  }
})

test('invalid build-time schemas fail explicitly rather than produce empty definitions', () => {
  for (const value of [null, [], {}, { schema: {} }, { schema: { items: {} } }]) {
    assert.throws(() => projectMasterSchema(value), /Invalid generated master schema/)
  }
})
