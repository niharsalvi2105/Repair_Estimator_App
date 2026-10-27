import assert from 'node:assert/strict'
import test from 'node:test'
import { pricingUnavailableMessage, statedRateError } from '../src/data/requestValidation.ts'

test('stated rates remain optional and zero preserves standard pricing', () => {
  for (const language of ['en', 'fr'])
    for (const value of [undefined, '', '  ', '0', '0.00', '4', '250.50'])
      assert.equal(statedRateError(value, language), undefined)
})

test('malformed, negative and nonfinite stated rates have localized errors', () => {
  for (const value of ['-1', 'NaN', 'Infinity', '1e999', 'invalid'])
    for (const language of ['en', 'fr'])
      assert.equal(typeof statedRateError(value, language), 'string')
  assert.notEqual(statedRateError('-1', 'en'), statedRateError('-1', 'fr'))
})

test('pricing failures explain saved state and rate remediation without claiming a specific cause', () => {
  assert.match(pricingUnavailableMessage('en'), /draft is saved/)
  assert.match(pricingUnavailableMessage('en'), /If a stated labor billing rate/)
  assert.match(pricingUnavailableMessage('en'), /configuration/)
  assert.match(pricingUnavailableMessage('fr'), /brouillon est enregistré/)
})
