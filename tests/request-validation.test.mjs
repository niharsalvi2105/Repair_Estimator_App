import assert from 'node:assert/strict'
import test from 'node:test'
import { konePricingConflict, pricingUnavailableMessage, statedRateError, submissionErrorMessage } from '../src/data/requestValidation.ts'

test('aggregate VK13 conflicts with itemized KONE but not manual non-KONE or an empty aggregate', () => {
  const base = { id: 'line', description: 'Part', quantity: 1, unitCost: 10, partNumber: 'P1' }
  for (const language of ['en', 'fr']) {
    assert.equal(typeof konePricingConflict([{ ...base, partType: 'kone' }], '100', language), 'string')
    assert.equal(typeof konePricingConflict([{ ...base, partType: 'kone', pricingSource: 'package', unitCost: 0 }], '100', language), 'string')
    assert.equal(konePricingConflict([{ ...base, partType: 'non-kone', pricingSource: 'manual' }], '100', language), undefined)
    for (const value of [undefined, '', '0', '0.00'])
      assert.equal(konePricingConflict([{ ...base, partType: 'kone' }], value, language), undefined)
  }
})

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
    'RE-102|PRICING_NOT_AVAILABLE', 'RE-103|BILLING_PLAN_REQUIRED',
    'RE-117|BAND_MATRIX_AMBIGUOUS', 'RE-117|REDUNDANCY_BAND_AMBIGUOUS', 'RE-117|INCENTIVE_RATE_AMBIGUOUS']) {
    const en = submissionErrorMessage(code, 'en')
    const fr = submissionErrorMessage(code, 'fr')
    assert.ok(en.includes(code) && fr.includes(code))
    assert.notEqual(en, fr)
  }
  assert.equal(submissionErrorMessage('403 Permission denied', 'en'), '403 Permission denied')
})
