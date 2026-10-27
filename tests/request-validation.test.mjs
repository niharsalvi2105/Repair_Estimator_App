import assert from 'node:assert/strict'
import test from 'node:test'
import { pricingUnavailableMessage, statedRateError, submissionErrorMessage } from '../src/data/requestValidation.ts'

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

test('submission errors explain backend validation keys in both languages and preserve diagnostics', () => {
  for (const code of ['RE-100|SELL_PRICE_REQUIRED', 'RE-101|MARGIN_COMMENT_REQUIRED',
    'RE-102|PRICING_NOT_AVAILABLE', 'RE-103|BILLING_PLAN_REQUIRED']) {
    const en = submissionErrorMessage(code, 'en')
    const fr = submissionErrorMessage(code, 'fr')
    assert.ok(en.includes(code) && fr.includes(code))
    assert.notEqual(en, fr)
  }
  assert.equal(submissionErrorMessage('403 Permission denied', 'en'), '403 Permission denied')
})
