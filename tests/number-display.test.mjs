import test from 'node:test'
import assert from 'node:assert/strict'
import { decimalInputDisplay } from '../src/data/numberDisplay.ts'

test('decimal input display uses two places without changing raw saved values', () => {
  for (const [raw, expected] of [
    ['30.0000000000', '30.00'], ['25.0000000000', '25.00'],
    ['2.5', '2.50'], ['0', '0.00'], ['1.2367', '1.24'],
    ['', ''], ['invalid', 'invalid'],
  ]) assert.equal(decimalInputDisplay(raw), expected)
})
