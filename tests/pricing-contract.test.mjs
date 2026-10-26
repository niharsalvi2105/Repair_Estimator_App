import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePricing } from '../src/data/pricingContract.ts'

const fixture = () => ({
  versionnumber: 42, _transactioncurrencyid_value: 'currency-id',
  re_calculationversion: '2026.1', re_calculatedon: '2026-10-26T11:15:58Z',
  re_totaltruecost: 16282.04, re_sellprice: 25, re_suggestedprice: 31807.21,
  re_recommendedcmii: 0.4881022722, re_actualcmii: -650.2816, re_amincentive: 0, re_bdincentive: 0,
})

test('saved pricing preserves negative margins and explicit zero incentives', () => {
  const row = parsePricing(fixture(), '42')
  assert.equal(row.re_actualcmii, -650.2816)
  assert.equal(row.re_amincentive, 0)
})

test('pricing must belong to the exact saved draft version', () => {
  assert.throws(() => parsePricing(fixture(), '41'), /different saved version/)
  assert.throws(() => parsePricing({ ...fixture(), versionnumber: Number.MAX_SAFE_INTEGER + 1 }, '42'))
})

test('missing calculations are distinct from invalid or incomplete completed results', () => {
  for (const re_calculationversion of [null, undefined, 'unavailable'])
    assert.equal(parsePricing({ versionnumber: 42, _transactioncurrencyid_value: 'currency-id',
      re_calculationversion }, '42').re_calculationversion, re_calculationversion)
  for (const change of [
    { re_totaltruecost: null }, { re_suggestedprice: null }, { re_recommendedcmii: null },
    { re_calculatedon: 'invalid' }, { re_actualcmii: NaN }, { re_sellprice: '25' },
    { _transactioncurrencyid_value: null },
  ]) assert.throws(() => parsePricing({ ...fixture(), ...change }, '42'))
})
