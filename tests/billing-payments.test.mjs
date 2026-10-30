import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateBillingPayments } from '../src/data/billingPayments.ts'

test('billing plans split the entered selling price', () => {
  assert.deepEqual(calculateBillingPayments(100, 60), { downPayment: 60, finalPayment: 40 })
  assert.deepEqual(calculateBillingPayments(100, 50), { downPayment: 50, finalPayment: 50 })
  assert.deepEqual(calculateBillingPayments(100, 0), { downPayment: 0, finalPayment: 100 })
  assert.deepEqual(calculateBillingPayments(0, 60), { downPayment: 0, finalPayment: 0 })
})

test('cent rounding keeps payments equal to the displayed selling price', () => {
  assert.deepEqual(calculateBillingPayments(100.01, 50), { downPayment: 50.01, finalPayment: 50 })
  assert.deepEqual(calculateBillingPayments(100.01, 60), { downPayment: 60.01, finalPayment: 40 })
  for (const price of [0.01, 1.005, 1234.56789, 9999999999.99])
    for (const percent of [0, 50, 60]) {
      const { downPayment, finalPayment } = calculateBillingPayments(price, percent)
      assert.equal(Math.round(downPayment * 100) + Math.round(finalPayment * 100), Math.round(Number(price.toFixed(2)) * 100))
    }
})

test('invalid selling prices fail explicitly', () => {
  for (const price of [-1, NaN, Infinity, -Infinity, Number.MAX_VALUE])
    assert.throws(() => calculateBillingPayments(price, 60), /valid nonnegative selling price/)
})
