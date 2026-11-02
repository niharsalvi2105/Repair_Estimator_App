const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const assert = require('node:assert/strict')

const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'backend', 'submission-export-schema.json'), 'utf8'))
const base = 'https://org79f23007.api.crm.dynamics.com/api/data/v9.2/'
const resource = 'https://org79f23007.crm.dynamics.com'
const apply = process.argv.includes('--apply')
let token
const label = text => ({ LocalizedLabels: [{ Label: text, LanguageCode: 1033 }] })

async function request(method, endpoint, body) {
  if (!token) token = JSON.parse(execFileSync('C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\python.exe',
    ['-IBm', 'azure.cli', 'account', 'get-access-token', '--resource', resource, '--output', 'json'],
    { encoding: 'utf8' })).accessToken
  const response = await fetch(base + endpoint, {
    method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json',
      'Content-Type': 'application/json', 'MSCRM.SolutionUniqueName': 'RepairEstimatorApp' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(120000),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${method} ${endpoint}: ${response.status} ${text}`)
  return text ? JSON.parse(text) : undefined
}

async function entity(name) {
  const response = await request('GET', `EntityDefinitions?$select=MetadataId,LogicalName,EntitySetName,OwnershipType,IsOptimisticConcurrencyEnabled&$filter=LogicalName eq '${name}'`)
  assert.ok(response.value.length <= 1, `Ambiguous entity ${name}`)
  return response.value[0]
}

function attribute(name, spec, primary = false) {
  const result = {
    '@odata.type': `Microsoft.Dynamics.CRM.${spec.type}AttributeMetadata`,
    SchemaName: name, DisplayName: label(name.slice(3)),
    RequiredLevel: { Value: spec.required ? 'ApplicationRequired' : 'None' },
    IsAuditEnabled: { Value: false },
  }
  if (primary) result.IsPrimaryName = true
  if (spec.type === 'String' || spec.type === 'Memo') {
    result.MaxLength = spec.maxLength
    result.FormatName = { Value: spec.type === 'Memo' ? 'TextArea' : 'Text' }
  }
  if (spec.type === 'Integer') Object.assign(result, { MinValue: spec.min, MaxValue: spec.max, Format: 'None' })
  if (spec.type === 'DateTime') Object.assign(result, { Format: 'DateAndTime', DateTimeBehavior: { Value: 'UserLocal' } })
  if (spec.type === 'Boolean') Object.assign(result, {
    DefaultValue: spec.default ?? false,
    OptionSet: { '@odata.type': 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata',
      TrueOption: { Value: 1, Label: label('Yes') }, FalseOption: { Value: 0, Label: label('No') } },
  })
  return result
}

async function main() {
  const who = await request('GET', 'WhoAmI')
  for (const table of schema.tables) {
    const found = await entity(table.logicalName)
    if (found) {
      assert.equal(found.OwnershipType, table.ownership, `Incompatible ownership for ${table.logicalName}`)
      continue
    }
    console.log(`${apply ? 'Creating' : 'Would create'} table ${table.logicalName}`)
    if (apply) await request('POST', 'EntityDefinitions', {
      '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
      SchemaName: table.logicalName, OwnershipType: table.ownership,
      DisplayName: label(table.logicalName.slice(3)), DisplayCollectionName: label(table.logicalName.slice(3) + 's'),
      HasActivities: false, HasNotes: false, IsOptimisticConcurrencyEnabled: true,
      PrimaryNameAttribute: 're_name', Attributes: [attribute('re_name', table.columns.re_name, true)],
    })
  }
  for (const table of [...schema.tables, ...schema.extendTables]) {
    const found = await entity(table.logicalName)
    if (!found) { assert.ok(!apply); continue }
    if (table.optimisticConcurrency) assert.equal(found.IsOptimisticConcurrencyEnabled, true,
      `Optimistic concurrency must be enabled before deploying ${table.logicalName}`)
    const endpoint = `EntityDefinitions(LogicalName='${table.logicalName}')`
    const existing = await request('GET', endpoint + '/Attributes?$select=LogicalName,AttributeType')
    for (const [name, spec] of Object.entries(table.columns)) {
      const column = existing.value.find(value => value.LogicalName === name)
      if (column) {
        assert.equal(column.AttributeType, spec.type, `Incompatible ${table.logicalName}.${name}`)
        continue
      }
      console.log(`${apply ? 'Creating' : 'Would create'} column ${table.logicalName}.${name}`)
      if (!apply) continue
      if (spec.type === 'Lookup') await request('POST', 'RelationshipDefinitions', {
        '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
        SchemaName: `${table.logicalName}_${name}_${spec.target}`,
        ReferencedEntity: spec.target, ReferencingEntity: table.logicalName, Lookup: attribute(name, spec),
        CascadeConfiguration: { Assign: 'NoCascade', Delete: 'Restrict', Merge: 'NoCascade',
          Reparent: 'NoCascade', Share: 'NoCascade', Unshare: 'NoCascade', RollupView: 'NoCascade' },
      })
      else await request('POST', endpoint + '/Attributes', attribute(name, spec))
    }
    if (table.alternateKey) {
      const keys = (await request('GET', endpoint + '/Keys')).value
      const match = keys.find(key => [...key.KeyAttributes].sort().join(',') === [...table.alternateKey].sort().join(','))
      if (!match) {
        console.log(`${apply ? 'Creating' : 'Would create'} unique key ${table.logicalName}`)
        if (apply) await request('POST', endpoint + '/Keys', {
          '@odata.type': 'Microsoft.Dynamics.CRM.EntityKeyMetadata',
          SchemaName: `${table.logicalName}_submissionkey`, DisplayName: label('Unique submission key'),
          KeyAttributes: table.alternateKey,
        })
      }
    }
  }
  if (!apply) { console.log('Read-only preflight complete. No schema or records changed.'); return }
  await request('POST', 'PublishAllXml', {})
  const configuration = await entity('re_exportconfiguration')
  const rows = (await request('GET', `${configuration.EntitySetName}?$select=re_name,re_enabled&$filter=re_name eq 'RepairEstimator'`)).value
  assert.ok(rows.length <= 1, 'Duplicate export configuration')
  if (!rows.length) await request('POST', configuration.EntitySetName, {
    re_name: 'RepairEstimator', re_enabled: false, re_outputmode: 'sample',
    're_flowuser@odata.bind': `/systemusers(${who.UserId})`,
  })
  else assert.equal(rows[0].re_enabled, false, 'Refusing to modify an active automation configuration')
  for (const table of schema.tables) {
    const endpoint = `EntityDefinitions(LogicalName='${table.logicalName}')`
    for (let attempt = 0; attempt < 30; attempt++) {
      const keys = (await request('GET', endpoint + '/Keys')).value
      const match = keys.find(key => [...key.KeyAttributes].sort().join(',') === [...table.alternateKey].sort().join(','))
      assert.ok(match, `Missing unique key ${table.logicalName}`)
      if (match.EntityKeyIndexStatus === 'Active') break
      assert.notEqual(match.EntityKeyIndexStatus, 'Failed', `Unique index failed ${table.logicalName}`)
      if (attempt === 29) throw new Error(`Unique index is not active yet: ${table.logicalName}`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  console.log('Additive Dev schema and active unique keys verified. Configuration remains disabled. No assemblies, flows or estimates changed.')
}
module.exports = { request }
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1 })
