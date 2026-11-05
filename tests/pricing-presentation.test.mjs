import test from 'node:test'
import assert from 'node:assert/strict'
import { cmiiGaugeShare, pricingComposition } from '../src/data/pricingPresentation.ts'

const row = {
  re_packageestimatedcost: 30164.12, re_customlaborcost: 750.6,
  re_custommaterialcost: 10000, re_totaladditionalcost: 19513.85, re_totaltruecost: 49677.97,
}

test('composition reconciles the reference total without counting custom costs twice', () => {
  const parts = pricingComposition(row)
  assert.deepEqual(parts.map((p) => p.amount), [30164.12, 750.6, 10000, 8763.25])
  assert.equal(parts.reduce((sum, p) => sum + p.amount, 0), 49677.97)
  assert.ok(Math.abs(parts.reduce((sum, p) => sum + p.share, 0) - 1) < 1e-12)
})

test('incomplete, negative and inconsistent costs do not generate a misleading chart', () => {
  for (const overrides of [
    { re_customlaborcost: null }, { re_custommaterialcost: undefined },
    { re_totaltruecost: NaN }, { re_packageestimatedcost: -1 },
    { re_totaladditionalcost: 100 }, { re_totaltruecost: 123 },
  ]) assert.equal(pricingComposition({ ...row, ...overrides }), null)
})

test('zero-cost composition contains zero shares rather than NaN', () => {
  const parts = pricingComposition(Object.fromEntries(Object.keys(row).map((k) => [k, 0])))
  assert.deepEqual(parts.map((p) => p.share), [0, 0, 0, 0])
})

test('gauge bounds only the drawing, not the saved margin', () => {
  assert.equal(cmiiGaugeShare(0.172), 0.172)
  assert.equal(cmiiGaugeShare(-650.2816), 0)
  assert.equal(cmiiGaugeShare(1.5), 1)
  assert.equal(cmiiGaugeShare(0), 0)
  for (const actual of [null, undefined, NaN, Infinity]) assert.equal(cmiiGaugeShare(actual), null)
})
