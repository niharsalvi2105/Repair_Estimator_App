import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAccountMasterOptions, parseContactMasterOptions, parseCustomerDefaults, defaultContact, defaultLocationDescription } from '../src/data/customerMasterContract.ts'

test('customer master search responses require typed Dataverse identifiers and fields', () => {
  const account = { id: '11111111-1111-4111-8111-111111111111', number: 'A-42', name: 'Customer Account' }
  const contact = { id: '22222222-2222-4222-8222-222222222222', name: 'Contact Name', email: 'c@example.invalid', phone: '' }
  assert.deepEqual(parseAccountMasterOptions({ accounts: [account] }), [account])
  assert.deepEqual(parseContactMasterOptions({ contacts: [contact] }), [contact])
  assert.throws(() => parseAccountMasterOptions({ accounts: [{ ...account, id: 'bad' }] }), /Account/)
  assert.throws(() => parseContactMasterOptions({ contacts: [{ ...contact, email: null }] }), /Contact/)
  assert.throws(() => parseAccountMasterOptions({ accounts: Array(21).fill(account) }), /limit/)
})

test('customer defaults select only a unique eligible Contact or unique primary, never a truncated result', () => {
  const first = { id: '22222222-2222-4222-8222-222222222222', name: 'Contact', email: 'c@example.invalid', phone: '' }
  const second = { ...first, id: '33333333-3333-4333-8333-333333333333', primary: true }
  const defaults = parseCustomerDefaults({ contacts: [first], locations: ['Site A'], locationDescriptions: [] })
  assert.deepEqual(defaultContact(defaults), first)
  assert.equal(defaultContact({ ...defaults, contacts: [first, second] }), second)
  assert.equal(defaultContact({ ...defaults, contacts: [{ ...first, primary: true }, second] }), undefined)
  assert.equal(defaultContact({ ...defaults, contacts: [first, { ...second, primary: false }] }), undefined)
  assert.equal(defaultContact({ ...defaults, contactsTruncated: true }), undefined)
  assert.equal(defaultContact({ ...defaults, contacts: [] }), undefined)
})

test('location description defaults require a complete, unique, within-limit Equipment description', () => {
  const parse = values => parseCustomerDefaults({ contacts: [], locations: [], locationDescriptions: values })
  assert.equal(defaultLocationDescription(parse(['Building A', 'Building A'])), 'Building A')
  assert.equal(defaultLocationDescription(parse([])), undefined)
  assert.equal(defaultLocationDescription(parse(['Building A', 'Building B'])), undefined)
  const unique = parse(['Building A'])
  assert.equal(defaultLocationDescription({ ...unique, locationDescriptionsTruncated: true }), undefined)
  assert.equal(defaultLocationDescription({ ...unique, locationDescriptionsTooLong: true }), undefined)
  assert.equal(defaultLocationDescription(parse(['x'.repeat(300)])), 'x'.repeat(300))
  for (const values of [[1], [''], ['x'.repeat(301)], Array(21).fill('Building')])
    assert.throws(() => parse(values), /updated draft API/)
  assert.throws(() => parseCustomerDefaults({ contacts: [], locations: [], locationDescriptions: [], locationDescriptionsTruncated: 1 }), /updated draft API/)
  assert.throws(() => parseCustomerDefaults({ contacts: [], locations: [], locationDescriptions: [], locationDescriptionsTooLong: 'false' }), /updated draft API/)
})

test('customer defaults reject old API responses and malformed or oversized location lists', () => {
  assert.throws(() => parseCustomerDefaults({ contacts: [] }), /updated draft API/)
  for (const locations of [[1], [''], ['x'.repeat(101)], Array(21).fill('Site')]) {
    assert.throws(() => parseCustomerDefaults({ contacts: [], locations }), /functional locations/)
  }
  assert.throws(() => parseCustomerDefaults({ contacts: [], locations: [], contactsTruncated: 'false' }), /updated draft API/)
})
