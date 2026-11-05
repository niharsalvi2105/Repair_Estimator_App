import test from 'node:test'
import assert from 'node:assert/strict'
import { packageContextFilter } from '../src/data/packageQuery.ts'

test('package catalog requires matching currency and permits global country packages', () => {
  const country = '11111111-1111-4111-8111-111111111111'
  const currency = '22222222-2222-4222-8222-222222222222'
  assert.equal(packageContextFilter(country, currency),
    `statecode eq 0 and (_re_country_value eq ${country} or _re_country_value eq null) and ` +
    `(_re_currency_value eq ${currency} or (_re_currency_value eq null and _transactioncurrencyid_value eq ${currency}))`)
  for (const pair of [['', currency], [country, ''], [country, "' or statecode eq 0"]])
    assert.throws(() => packageContextFilter(...pair), /missing or invalid/)
})
