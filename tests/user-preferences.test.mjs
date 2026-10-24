import test from 'node:test'
import assert from 'node:assert/strict'
import { createPreferenceRepository, parsePreferences, preferenceFields } from '../src/data/userPreferences.ts'

const userId = '11111111-1111-1111-1111-111111111111'
const defaults = { language: 'en', locale: 'en-US', theme: 'system' }
const ok = (data) => ({ success: true, data })
const row = {
  re_appuserpreferenceid: 'preference-id', re_name: 'User', statecode: 0,
  re_preferredlanguage: 126110001, re_preferredlocale: 'fr-CA', re_preferredtheme: 126110002,
}
function fixture(records = []) {
  const calls = []
  return {
    calls,
    getAll: async (query) => { calls.push(['read', query]); return ok(records) },
    create: async (value) => { calls.push(['create', value]); return ok(value) },
    update: async (id, value) => { calls.push(['update', id, value]); return ok(value) },
  }
}

test('startup creates one complete preference record for concurrent callers', async () => {
  const transport = fixture()
  const repository = createPreferenceRepository(transport)
  assert.deepEqual(await Promise.all([
    repository.loadOrCreate(userId, 'Test User'), repository.loadOrCreate(userId, 'Test User'),
  ]), [defaults, defaults])
  assert.equal(transport.calls.filter(([type]) => type === 'create').length, 1)
  assert.deepEqual(transport.calls.find(([type]) => type === 'create')[1], {
    re_name: 'Test User', 're_User@odata.bind': `/systemusers(${userId})`, statecode: 0,
    re_preferredlanguage: 126110000, re_preferredlocale: 'en-US', re_preferredtheme: 126110000,
  })
  const query = transport.calls[0][1]
  assert.equal(query.filter, `_re_user_value eq ${userId}`)
  assert.ok(!query.select.includes('re_preferredthemename'))
})

test('existing preferences load without resetting or rewriting them', async () => {
  const transport = fixture([row])
  assert.deepEqual(await createPreferenceRepository(transport).loadOrCreate(userId, 'User'), {
    language: 'fr', locale: 'fr-CA', theme: 'light',
  })
  assert.equal(transport.calls.length, 1)
})

test('older records get missing name, locale and System theme populated', async () => {
  const transport = fixture([{ ...row, re_name: '', re_preferredlocale: null, re_preferredtheme: null }])
  await createPreferenceRepository(transport).loadOrCreate(userId, 'User')
  assert.deepEqual(transport.calls[1], ['update', 'preference-id', {
    re_name: 'User', re_preferredlanguage: 126110001, re_preferredlocale: 'fr-CA', re_preferredtheme: 126110000,
  }])
})

test('theme and language save together without modifying user binding, owner or proposal language', async () => {
  const transport = fixture([row])
  await createPreferenceRepository(transport).save(userId, { language: 'en', locale: 'en-US', theme: 'dark' })
  assert.deepEqual(transport.calls[1], ['update', 'preference-id', {
    re_preferredlanguage: 126110000, re_preferredlocale: 'en-US', re_preferredtheme: 126110001,
  }])
})

test('all published theme options map to exact live choice values', () => {
  for (const [theme, choice] of [['system', 126110000], ['dark', 126110001], ['light', 126110002]]) {
    assert.equal(preferenceFields({ ...defaults, theme }).re_preferredtheme, choice)
    assert.equal(parsePreferences({ ...row, re_preferredtheme: choice }).theme, theme)
  }
  assert.throws(() => parsePreferences({ ...row, re_preferredtheme: 42 }), /theme/)
  assert.throws(() => parsePreferences({ ...row, re_preferredlanguage: 42 }), /language/)
})

test('duplicates, inactive records and invalid identity fail explicitly', async () => {
  await assert.rejects(createPreferenceRepository(fixture([row, row])).loadOrCreate(userId, 'User'), /Multiple/)
  await assert.rejects(createPreferenceRepository(fixture([{ ...row, statecode: 1 }])).loadOrCreate(userId, 'User'), /inactive/)
  assert.throws(() => createPreferenceRepository(fixture()).loadOrCreate('invalid', 'User'), /valid signed-in/)
})

test('permission failures do not create fallback records and failed writes can be retried', async () => {
  const transport = fixture([row])
  transport.getAll = async () => ({ success: false, error: { status: 403, message: 'Denied' } })
  const repository = createPreferenceRepository(transport)
  await assert.rejects(repository.loadOrCreate(userId, 'User'), /Denied/)
  assert.equal(transport.calls.length, 0)
  transport.getAll = async () => ok([row])
  transport.update = async () => ({ success: false, error: { message: 'Write denied' } })
  await assert.rejects(repository.save(userId, defaults), /Write denied/)
  transport.update = async () => ok(row)
  await repository.save(userId, defaults)
})
