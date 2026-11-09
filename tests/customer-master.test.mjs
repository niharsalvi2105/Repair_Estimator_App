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
  const defaults = parseCustomerDefaults({ contacts: [first], locations: ['Site A'], locationDescriptions: [], locationOptions: [] })
  assert.deepEqual(defaultContact(defaults), first)
  assert.equal(defaultContact({ ...defaults, contacts: [first, second] }), second)
  assert.equal(defaultContact({ ...defaults, contacts: [{ ...first, primary: true }, second] }), undefined)
  assert.equal(defaultContact({ ...defaults, contacts: [first, { ...second, primary: false }] }), undefined)
  assert.equal(defaultContact({ ...defaults, contactsTruncated: true }), undefined)
  assert.equal(defaultContact({ ...defaults, contacts: [] }), undefined)
})

test('partial Contacts keep their identity and available fields without requiring a master email', () => {
  const contact = { id: '22222222-2222-4222-8222-222222222222', name: 'Contact', email: '', phone: '' }
  const defaults = parseCustomerDefaults({ contacts: [contact], locations: [], locationDescriptions: [], locationOptions: [] })
  assert.deepEqual(defaultContact(defaults), contact)
  assert.deepEqual(parseContactMasterOptions({ contacts: [{ ...contact, name: '' }] }), [{ ...contact, name: '' }])
})

test('location defaults require a complete sole number/name pair, not a unique Equipment description', () => {
  const parse = values => parseCustomerDefaults({ contacts: [], locations: [], locationDescriptions: values,
    locationOptions: values.map(name => ({ number: 'FL00042', name })) })
  assert.equal(defaultLocationDescription(parse(['Building A', 'Building A'])), 'Building A')
  assert.equal(defaultLocationDescription(parse([])), undefined)
  assert.equal(defaultLocationDescription(parse(['Building A', 'Building B'])), undefined)
  const unique = parse(['Building A'])
  assert.equal(defaultLocationDescription({ ...unique, locationDescriptionsTruncated: true }), undefined)
  assert.equal(defaultLocationDescription({ ...unique, locationDescriptionsTooLong: true }), undefined)
  assert.equal(defaultLocationDescription({ ...unique, locationNamesUnavailable: true }), undefined)
  assert.equal(defaultLocationDescription({ ...unique, locationsTruncated: true }), undefined)
  assert.equal(defaultLocationDescription({ ...unique, locationOptions: [
    { number: 'FL00042', name: 'Building A' }, { number: 'FL00043', name: 'Building A' },
  ] }), undefined)
  assert.equal(defaultLocationDescription(parse(['x'.repeat(300)])), 'x'.repeat(300))
  for (const values of [[1], [''], ['x'.repeat(301)], Array(21).fill('Building')])
    assert.throws(() => parse(values), /updated draft API/)
  assert.throws(() => parseCustomerDefaults({ contacts: [], locations: [], locationDescriptions: [], locationDescriptionsTruncated: 1 }), /updated draft API/)
  assert.throws(() => parseCustomerDefaults({ contacts: [], locations: [], locationDescriptions: [], locationDescriptionsTooLong: 'false' }), /updated draft API/)
})

test('Account location options preserve leading zeros and pair identity, rejecting invalid or old contracts', () => {
  const base = { contacts: [], locations: [], locationDescriptions: [] }
  const options = [{ number: 'FL00042', name: 'Building A' }, { number: 'FL00043', name: 'Building A' }]
  assert.deepEqual(parseCustomerDefaults({ ...base, locationOptions: [...options, options[0]] }).locationOptions, options)
  assert.throws(() => parseCustomerDefaults(base), /updated draft API/)
  for (const option of [null, { number: '', name: 'A' }, { number: 'FL1', name: '' },
    { number: 42, name: 'A' }, { number: 'x'.repeat(101), name: 'A' }, { number: 'FL1', name: 'x'.repeat(301) }]) {
    assert.throws(() => parseCustomerDefaults({ ...base, locationOptions: [option] }), /invalid Account location/)
  }
  assert.throws(() => parseCustomerDefaults({ ...base, locationOptions: Array(21).fill(options[0]) }), /updated draft API/)
})
test('customer defaults reject old API responses and malformed or oversized location lists', () => {
  assert.throws(() => parseCustomerDefaults({ contacts: [] }), /updated draft API/)
  for (const locations of [[1], [''], ['x'.repeat(101)], Array(21).fill('Site')]) {
    assert.throws(() => parseCustomerDefaults({ contacts: [], locations }), /functional locations/)
  }
  assert.throws(() => parseCustomerDefaults({ contacts: [], locations: [], contactsTruncated: 'false' }), /updated draft API/)
})
