import test from 'node:test'
import assert from 'node:assert/strict'
import { createCustomerNameLoader } from '../src/data/customerNames.ts'

const branch = '11111111-1111-1111-1111-111111111111'
test('customer names are branch scoped, active, paged, trimmed and distinct', async () => {
  const calls = []
  const load = createCustomerNameLoader({ async getAll(options) {
    calls.push(options)
    return options.skipToken
      ? { success: true, data: [{ re_soldtoname: 'acme' }, { re_soldtoname: 'Zulu' }] }
      : { success: true, data: [{ re_soldtoname: ' Acme ' }, { re_soldtoname: '' },
        { re_soldtoname: '   ' }, {}], skipToken: 'next' }
  } })
  assert.deepEqual(await load(branch), ['Acme', 'Zulu'])
  assert.equal(calls.length, 2)
  for (const query of calls) {
    assert.equal(query.filter, `statecode eq 0 and _re_branch_value eq ${branch} and re_soldtoname ne null`)
    assert.deepEqual(query.select, ['re_equipmentid', 're_soldtoname'])
    assert.deepEqual(query.orderBy, ['re_soldtoname asc', 're_equipmentid asc'])
    assert.equal(query.maxPageSize, 500)
    assert.equal(query.top, undefined)
  }
  assert.equal(calls[1].skipToken, 'next')
})

test('invalid branches, repeated pages and service errors are explicit failures', async () => {
  const repeated = createCustomerNameLoader({ async getAll() {
    return { success: true, data: [], skipToken: 'same' }
  } })
  for (const id of ['', 'bad', `${branch} or true`])
    await assert.rejects(repeated(id), /valid branch/)
  await assert.rejects(repeated(branch), /repeated customer-name paging token/)
  await assert.rejects(createCustomerNameLoader({ async getAll() {
    return { success: false, error: { message: 'Access denied', status: 403 } }
  } })(branch), /Access denied/)
})
