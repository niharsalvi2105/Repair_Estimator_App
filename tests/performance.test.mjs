import test from 'node:test'
import assert from 'node:assert/strict'
import { measureOperation } from '../src/data/performance.ts'
import { withTimeout } from '../src/data/dataverseOperation.ts'

test('operation timings preserve results and record only static names, duration and outcome', async () => {
  const name = 'repair-estimator:customer-defaults'
  performance.clearMeasures(name)
  const value = { confidential: 'not included in timings' }
  assert.equal(await measureOperation('customer-defaults', async () => value), value)
  const [entry] = performance.getEntriesByName(name, 'measure')
  assert.ok(entry.duration >= 0)
  assert.deepEqual(entry.detail, { outcome: 'completed' })
  assert.ok(!JSON.stringify(entry).includes(value.confidential))
  const failure = new Error('diagnostic not included in timings')
  await assert.rejects(measureOperation('customer-defaults', async () => { throw failure }),
    reason => reason === failure)
  const failed = performance.getEntriesByName(name, 'measure').at(-1)
  assert.deepEqual(failed.detail, { outcome: 'failed' })
  assert.ok(!JSON.stringify(failed).includes(failure.message))
  performance.clearMeasures(name)
})

test('timing retention is bounded per operation and clearing one operation preserves others', async () => {
  const name = 'repair-estimator:account-search'
  const other = 'repair-estimator:contact-search'
  performance.clearMeasures(name)
  performance.clearMeasures(other)
  await measureOperation('contact-search', async () => undefined)
  for (let i = 0; i < 105; i++) await measureOperation('account-search', async () => undefined)
  assert.equal(performance.getEntriesByName(name, 'measure').length, 5)
  assert.equal(performance.getEntriesByName(other, 'measure').length, 1)
  performance.clearMeasures(name)
  performance.clearMeasures(other)
})

test('SDK operation counting retains explicit errors and timeout behavior', async () => {
  const name = 'repair-estimator:power-apps-request'
  performance.clearMeasures(name)
  assert.equal(await withTimeout(Promise.resolve(42)), 42)
  await assert.rejects(withTimeout(Promise.reject(new Error('Access denied'))), /Access denied/)
  await assert.rejects(withTimeout(new Promise(() => {}), 5), reason =>
    reason.status === 408 && reason.message.includes('timed out'))
  const entries = performance.getEntriesByName(name, 'measure')
  assert.equal(entries.length, 3)
  assert.deepEqual(entries.map(entry => entry.detail.outcome), ['completed', 'failed', 'failed'])
  performance.clearMeasures(name)
})
