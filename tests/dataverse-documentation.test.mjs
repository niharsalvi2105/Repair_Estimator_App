import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const { requiresUpdate, requiresAppUpdate, requiresPluginUpdate } = createRequire(import.meta.url)('../automation/check-dataverse-doc.cjs')

test('Dataverse-related changes require the reference to be updated', () => {
  for (const file of ['src/App.tsx', 'src/data/draftContract.ts', 'backend/DraftPlugin.cs',
    'backend-pricing/Plugins/CalculationWriter.cs', '.power/schemas/dataverse/equipment.Schema.json',
    'tests/draft-contract.test.mjs', 'automation/deploy-schema.cjs']) {
    assert.equal(requiresUpdate([file]), true, file)
    assert.equal(requiresUpdate([file, 'Audit_Track/dataverse.md']), false, file)
  }
})

test('Unrelated files and documentation-only changes do not require a second update', () => {
  assert.equal(requiresUpdate(['README.md']), false)
  assert.equal(requiresUpdate(['Audit_Track/dataverse.md']), false)
  assert.equal(requiresUpdate([]), false)
})

test('App changes including CSS and assets require app documentation', () => {
  for (const file of ['src/App.tsx', 'src/App.css', 'src/data/packageCosts.ts',
    'public/icon.svg', 'e2e/responsive.spec.mjs', 'tests/package-costs.test.mjs',
    'package-lock.json', 'vite.config.ts', 'index.html']) {
    assert.equal(requiresAppUpdate([file]), true, file)
    assert.equal(requiresAppUpdate([file, 'Audit_Track/app.md']), false, file)
  }
  assert.equal(requiresAppUpdate(['backend/DraftPlugin.cs']), false)
  assert.equal(requiresAppUpdate(['README.md']), false)
  assert.equal(requiresAppUpdate(['Audit_Track/app.md']), false)
})

test('Plugin implementation, project, schema and test changes require plugin documentation', () => {
  for (const file of ['backend/DraftPlugin.cs', 'backend/submission-export-schema.json',
    'backend/RepairEstimator.Drafts.csproj', 'backend-pricing/Pricing/PricingEngine.cs',
    'backend-tests/Program.cs', 'backend-pricing-tests/PricingTests.cs',
    'automation/check-dataverse-doc.cjs']) {
    assert.equal(requiresPluginUpdate([file]), true, file)
    assert.equal(requiresPluginUpdate([file, 'Audit_Track/plugin.md']), false, file)
  }
  assert.equal(requiresPluginUpdate(['src/App.tsx']), false)
  assert.equal(requiresPluginUpdate(['Audit_Track/plugin.md']), false)
})

test('Git diff guard rejects missing, empty and deleted updates and accepts a real update', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'repair-estimator-doc-test-'))
  const script = fileURLToPath(new URL('../automation/check-dataverse-doc.cjs', import.meta.url))
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim()
  const tree = () => { git('add', '-A'); return git('write-tree') }
  const run = (base, head) => spawnSync(process.execPath, [script, base, head], {
    cwd: directory, encoding: 'utf8',
  })
  try {
    git('init', '--quiet')
    mkdirSync(path.join(directory, 'src'))
    mkdirSync(path.join(directory, 'Audit_Track'))
    const document = path.join(directory, 'Audit_Track', 'dataverse.md')
    writeFileSync(document, '# Original reference\n')
    const base = tree()
    assert.equal(run(base, base).status, 0)
    writeFileSync(path.join(directory, 'src', 'App.tsx'), 'export const field = 1\n')
    const missingUpdate = run(base, tree())
    assert.equal(missingUpdate.status, 1)
    assert.match(missingUpdate.stderr, /Update Audit_Track\/dataverse.md/)
    writeFileSync(document, '# Updated reference\nNo new persistence.\n')
    const appDocument = path.join(directory, 'Audit_Track', 'app.md')
    const missingAppUpdate = run(base, tree())
    assert.equal(missingAppUpdate.status, 1)
    assert.match(missingAppUpdate.stderr, /Update Audit_Track\/app.md/)
    writeFileSync(appDocument, '# Updated app reference\nNew field.\n')
    assert.equal(run(base, tree()).status, 0)
    mkdirSync(path.join(directory, 'backend'))
    writeFileSync(path.join(directory, 'backend', 'DraftPlugin.cs'), '// test fixture\n')
    const missingPluginUpdate = run(base, tree())
    assert.equal(missingPluginUpdate.status, 1)
    assert.match(missingPluginUpdate.stderr, /Update Audit_Track\/plugin.md/)
    const pluginDocument = path.join(directory, 'Audit_Track', 'plugin.md')
    writeFileSync(pluginDocument, '# Updated plugin reference\n')
    assert.equal(run(base, tree()).status, 0)
    writeFileSync(pluginDocument, '')
    assert.equal(run(base, tree()).status, 1)
    rmSync(pluginDocument)
    assert.equal(run(base, tree()).status, 1)
    writeFileSync(pluginDocument, '# Updated plugin reference\n')
    writeFileSync(appDocument, '')
    assert.equal(run(base, tree()).status, 1)
    rmSync(appDocument)
    assert.equal(run(base, tree()).status, 1)
    writeFileSync(appDocument, '# Updated app reference\n')
    writeFileSync(document, '')
    assert.equal(run(base, tree()).status, 1)
    rmSync(document)
    assert.equal(run(base, tree()).status, 1)
    assert.equal(run('not-a-revision', tree()).status, 1)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
