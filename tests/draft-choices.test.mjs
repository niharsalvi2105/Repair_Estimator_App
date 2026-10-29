import assert from 'node:assert/strict'
import test from 'node:test'
import { parseDraftChoices } from '../src/data/draftChoices.ts'

const option = (value, en, fr) => ({ value, en, ...(fr === undefined ? {} : { fr }) })

test('Draft choices use published values and localized labels for every requested field', () => {
  const choices = parseDraftChoices({ mode: 'choices', fields: [
    { key: 're_papertype', options: [option(727000042, 'Non KONE Paper', 'Papier non KONE'), option(17, 'NA', '')] },
    { key: 're_yesno', options: [option(126110000, 'Yes', 'Oui')] },
  ] }, ['re_papertype'])
  assert.deepEqual(choices.re_papertype, [
    { value: 727000042, en: 'Non KONE Paper', fr: 'Papier non KONE' },
    { value: 17, en: 'NA', fr: undefined },
  ])
  assert.deepEqual(choices.re_yesno, [{ value: 126110000, en: 'Yes', fr: 'Oui' }])
})

test('Draft choices reject malformed or incomplete metadata rather than using static defaults', () => {
  const valid = { key: 're_papertype', options: [option(1, 'A')] }
  for (const value of [null, {}, { mode: 'paperTypes', fields: [valid] }, { mode: 'choices', fields: {} },
    { mode: 'choices', fields: [valid, valid] },
    { mode: 'choices', fields: [{ key: 're_papertype', options: [] }] },
    ...[{ value: -1, en: 'A' }, { value: 1.5, en: 'A' }, { value: 1, en: ' ' }, { value: 1, en: 'A', fr: 42 }]
      .map((entry) => ({ mode: 'choices', fields: [{ key: 're_papertype', options: [entry] }] })),
    { mode: 'choices', fields: [{ key: 're_papertype', options: [option(1, 'A'), option(1, 'B')] }] }]) {
    assert.throws(() => parseDraftChoices(value, ['re_papertype']), /choice/i)
  }
  assert.throws(() => parseDraftChoices({ mode: 'choices', fields: [valid] }, ['re_papertype', 're_billingplan']),
    /missing for re_billingplan/)
})

const row = (attributename, attributevalue, value, langid, displayorder) => ({ attributename, attributevalue, value, langid, displayorder })
const label = (Label, LanguageCode) => ({ Label, LanguageCode })
const fail = (message) => async () => ({ success: false, error: { message } })

test('Stringmap choices group values by display order with English and French labels', async () => {
  const { createDraftChoiceLoader } = await import('../src/data/draftChoiceLoader.ts')
  const filters = []
  const load = createDraftChoiceLoader({
    stringMaps: async (filter) => {
      filters.push(filter)
      return { success: true, data: { value: [
        row('re_papertype', 126110002, 'NA', 1033, 3), row('re_papertype', 126110000, 'Non KONE Paper', 1033, 1),
        row('re_papertype', 126110000, 'Papier non KONE', 1036, 1), row('re_emergency', 126110000, 'Yes', 1033, 1),
      ] } }
    },
    optionSet: async () => { throw new Error('global choice metadata unavailable') },
    draftApi: async () => { throw new Error('not expected') },
  })
  const choices = await load(['re_papertype', 're_emergency'])
  assert.deepEqual(choices.re_papertype, [
    { value: 126110000, en: 'Non KONE Paper', fr: 'Papier non KONE' },
    { value: 126110002, en: 'NA', fr: undefined },
  ])
  assert.deepEqual(choices.re_emergency, [{ value: 126110000, en: 'Yes', fr: undefined }])
  assert.deepEqual(filters, ["objecttypecode eq 're_repairestimate' and (attributename eq 're_papertype' or attributename eq 're_emergency')"])
})

test('Global choice metadata takes precedence over stale stringmap labels', async () => {
  const { createDraftChoiceLoader } = await import('../src/data/draftChoiceLoader.ts')
  let stringMapsCalled = false
  const load = createDraftChoiceLoader({
    stringMaps: async () => {
      stringMapsCalled = true
      return { success: true, data: { value: [
        row('re_papertype', 126110000, 'Customer Paper', 1033, 1),
        row('re_papertype', 126110001, 'Kone Paper', 1033, 2),
      ] } }
    },
    optionSet: async (name) => {
      assert.equal(name, 're_papertype')
      return { success: true, data: { Options: [
        { Value: 126110000, Label: { LocalizedLabels: [label('NON KONE Paper', 1033)] } },
        { Value: 126110001, Label: { LocalizedLabels: [label('Kone Paper', 1033)] } },
        { Value: 126110002, Label: { LocalizedLabels: [label('NA', 1033)] } },
      ] } }
    },
    draftApi: async () => { throw new Error('not expected') },
  })

  assert.deepEqual((await load(['re_papertype'])).re_papertype, [
    { value: 126110000, en: 'NON KONE Paper', fr: undefined },
    { value: 126110001, en: 'Kone Paper', fr: undefined },
    { value: 126110002, en: 'NA', fr: undefined },
  ])
  assert.equal(stringMapsCalled, false)
})

test('Global choice metadata is used when stringmaps are unavailable, reading each shared choice once', async () => {
  const { createDraftChoiceLoader } = await import('../src/data/draftChoiceLoader.ts')
  const names = []
  const load = createDraftChoiceLoader({
    stringMaps: fail('stringmaps denied'),
    optionSet: async (name) => {
      names.push(name)
      return { success: true, data: { Options: [
        { Value: 126110000, Label: { LocalizedLabels: [label('Yes', 1033), label('Oui', 1036)] } },
        { Value: 126110001, Label: { LocalizedLabels: [], UserLocalizedLabel: label('No', 1033) } },
      ] } }
    },
    draftApi: async () => { throw new Error('not expected') },
  })
  const choices = await load(['re_emergency', 're_customerbudgeted'])
  assert.deepEqual(names, ['re_yesno'])
  assert.deepEqual(choices.re_customerbudgeted, [{ value: 126110000, en: 'Yes', fr: 'Oui' }, { value: 126110001, en: 'No', fr: undefined }])
  assert.equal(choices.re_emergency, choices.re_customerbudgeted)
})

test('Draft API is the last fallback and total failure gives a short message without plugin details', async () => {
  const { createDraftChoiceLoader } = await import('../src/data/draftChoiceLoader.ts')
  const api = { mode: 'choices', fields: [{ key: 're_papertype', options: [option(126110001, 'Kone Paper', 'Papier KONE')] }] }
  const fallback = createDraftChoiceLoader({
    stringMaps: async () => ({ success: true, data: { value: [], '@odata.nextLink': 'next' } }),
    optionSet: async () => ({ success: true, data: { Options: [{ Value: 1.5, Label: {} }] } }),
    draftApi: async () => ({ success: true, data: { ResultJson: JSON.stringify(api) } }),
  })
  assert.deepEqual((await fallback(['re_papertype'])).re_papertype, [{ value: 126110001, en: 'Kone Paper', fr: 'Papier KONE' }])
  const broken = createDraftChoiceLoader({
    stringMaps: fail('stringmaps denied'), optionSet: fail('metadata denied'),
    draftApi: async () => { throw new Error('Guid.Parse failed') },
  })
  const error = console.error
  console.error = () => {}
  try {
    await assert.rejects(broken(['re_papertype']), (reason) => reason.message === 'Dataverse choices are temporarily unavailable.')
  } finally { console.error = error }
  await assert.rejects(broken(["re_x' or 1 eq 1"]), /Invalid choice field request/)
})

test('Choice metadata GET definitions build valid read-only Web API URLs', async () => {
  const { dataSourcesInfo } = await import('../.power/schemas/appschemas/dataSourcesInfo.ts')
  const { apis } = dataSourcesInfo.re_choicemetadata
  // Mirrors the SDK customapi path substitution: path params are URI-encoded into the pre-built path.
  const url = (api, body) => api.parameters.reduce((path, { name }) => path.replace(`{${name}}`, encodeURIComponent(body[name])), api.path)
  assert.equal(apis.StringMaps.method, 'GET')
  assert.equal(apis.GlobalOptionSet.method, 'GET')
  const stringMaps = new URL(url(apis.StringMaps, { filter: "objecttypecode eq 're_repairestimate' and (attributename eq 're_papertype')" }), 'https://org.crm.dynamics.com')
  assert.equal(stringMaps.pathname, '/api/data/v9.2/stringmaps')
  assert.equal(stringMaps.searchParams.get('$filter'), "objecttypecode eq 're_repairestimate' and (attributename eq 're_papertype')")
  assert.equal(stringMaps.searchParams.get('$select'), 'attributename,attributevalue,value,langid,displayorder')
  assert.equal(url(apis.GlobalOptionSet, { name: 're_papertype' }), "/api/data/v9.2/GlobalOptionSetDefinitions(Name='re_papertype')")
})
