import test from 'node:test'
import assert from 'node:assert/strict'
import { requestReuseErrorMessage } from '../src/data/dataverseOperation.ts'

const serverError = JSON.stringify({ error: {
  code: '0x80040265',
  message: 'Unsupported draft operation.',
  '@Microsoft.PowerApps.CDS.ErrorDetails.Plugin.ExceptionFromPluginExecute': 'RepairEstimator.Drafts.DraftPlugin',
} })

test('unsupported deployed clone operations explain the assembly mismatch instead of displaying raw JSON', () => {
  const result = requestReuseErrorMessage(new Error(serverError), 'clone', 'en')
  assert.match(result, /deployed Dataverse backend/)
  assert.match(result, /clonesource/)
  assert.match(result, /update the existing RepairEstimator.Drafts assembly/)
  assert.match(result, /re_DraftEstimate/)
  assert.match(result, /did not create a copy/)
  assert.match(result, /Unsupported draft operation\./)
  assert.ok(!result.includes('"error"'))
  assert.ok(!result.includes('re_opportunitypreset'))
})

test('presets identify both the new API modes and the private schema deployment', () => {
  for (const reason of [serverError, 'Unsupported draft operation.', new Error('Unsupported draft operation.')]) {
    const result = requestReuseErrorMessage(reason, 'presets', 'en')
    assert.match(result, /presetlist \/ presetsave \/ presetdelete/)
    assert.match(result, /re_opportunitypreset/)
    assert.match(result, /permissions/)
  }
  assert.match(requestReuseErrorMessage(serverError, 'presets', 'fr'), /autorisations/)
  assert.match(requestReuseErrorMessage(serverError, 'clone', 'fr'), /recharger l’application/)
})

test('permission, validation, timeout and malformed responses retain their original diagnostics', () => {
  for (const detail of ['Access denied', 'Request timed out', 'The source branch is inactive.',
    '{"error":', '{"error":null}', '{"error":{"message":"Access denied"}}']) {
    assert.equal(requestReuseErrorMessage(new Error(detail), 'clone', 'en'), detail)
  }
})
