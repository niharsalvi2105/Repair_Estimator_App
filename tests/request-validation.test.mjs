import assert from 'node:assert/strict'
import test from 'node:test'
import { konePricingConflict, phoneNumberError, pricingUnavailableMessage, statedRateError, submissionErrorMessage, whitespaceOnlyError } from '../src/data/requestValidation.ts'

test('whitespace-only required text has a localized error while empty and meaningful text do not', () => {
  for (const value of [' ', '\t', '\n', ' \t\r\n\u00a0']) {
    assert.equal(typeof whitespaceOnlyError(value, 'en'), 'string')
    assert.equal(typeof whitespaceOnlyError(value, 'fr'), 'string')
    assert.notEqual(whitespaceOnlyError(value, 'en'), whitespaceOnlyError(value, 'fr'))
  }
  for (const value of [undefined, '', '  name  ']) {
    assert.equal(whitespaceOnlyError(value, 'en'), undefined)
    assert.equal(whitespaceOnlyError(value, 'fr'), undefined)
  }
})

test('phone numbers allow digits and common punctuation but reject letters and punctuation-only values', () => {
  for (const value of ['', undefined, '5550100', '+1 (555) 010-1234', '555.010.1234'])
    assert.equal(phoneNumberError(value, 'en'), undefined)
  for (const value of ['1-800-FLOWERS', 'abc123', '---', '   ', '555++123']) {
    assert.match(phoneNumberError(value, 'en'), /Use digits and phone characters/)
    assert.match(phoneNumberError(value, 'fr'), /Utilisez des chiffres/)
  }
})

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
