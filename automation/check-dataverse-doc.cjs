const { execFileSync } = require('node:child_process')

const document = 'Audit_Track/dataverse.md'
const appDocument = 'Audit_Track/app.md'
const pluginDocument = 'Audit_Track/plugin.md'

function requiresUpdate(files) {
  const relevant = files.some(file =>
    /^(src\/.*\.(ts|tsx)|backend\/|backend-pricing\/|backend-tests\/|backend-pricing-tests\/|\.power\/|e2e\/|tests\/|automation\/)/.test(file) ||
    ['package.json', '.github/copilot-instructions.md', '.github/workflows/dataverse-documentation.yml'].includes(file))
  return relevant && !files.includes(document)
}

function requiresAppUpdate(files) {
  const relevant = files.some(file =>
    /^(src\/|e2e\/|tests\/|public\/|\.power\/)/.test(file) ||
    /^(package(-lock)?\.json|index\.html|vite\.config\.|tsconfig|playwright\.config\.)/.test(file) ||
    ['.github/copilot-instructions.md', '.github/workflows/dataverse-documentation.yml',
      'automation/check-dataverse-doc.cjs'].includes(file))
  return relevant && !files.includes(appDocument)
}

function requiresPluginUpdate(files) {
  const relevant = files.some(file =>
    /^(backend\/|backend-pricing\/|backend-tests\/|backend-pricing-tests\/)/.test(file) ||
    ['.github/copilot-instructions.md', '.github/workflows/dataverse-documentation.yml',
      'automation/check-dataverse-doc.cjs'].includes(file))
  return relevant && !files.includes(pluginDocument)
}

function check(base, head = 'HEAD') {
  if (!base) throw new Error('Provide a base Git revision and optional head revision.')
  const files = execFileSync('git', ['diff', '--name-only', '--no-renames', base, head], { encoding: 'utf8' })
    .trim().split(/\r?\n/).filter(Boolean)
  if (requiresUpdate(files)) {
    throw new Error(`Update ${document} in the same change as application/Dataverse code. Record mappings, persistence, issues, validation and deployment status.`)
  }
  if (requiresAppUpdate(files)) {
    throw new Error(`Update ${appDocument} in the same change as frontend code. Record controls, navigation, calculations, errors, validation and deployment status.`)
  }
  if (requiresPluginUpdate(files)) {
    throw new Error(`Update ${pluginDocument} in the same change as plugin code. Record triggers, calculations, validation, registration and deployment status.`)
  }
  for (const reference of [document, appDocument, pluginDocument]) {
    if (files.includes(reference)) {
      const content = execFileSync('git', ['show', `${head}:${reference}`], { encoding: 'utf8' })
      if (!content.trim()) throw new Error(`${reference} must not be empty or deleted.`)
    }
  }
  console.log('Dataverse, app and plugin documentation change check passed.')
}

module.exports = { requiresUpdate, requiresAppUpdate, requiresPluginUpdate, check }
if (require.main === module) {
  try { check(process.argv[2], process.argv[3]) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
