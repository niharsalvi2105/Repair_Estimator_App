import { getClient } from '@microsoft/power-apps/data'
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo'
import { unwrap, withTimeout } from './dataverseOperation'
import { buildMasterChanges, masterNameFields, object, tableByName, type Language, type MasterRow, type MasterTable } from './masterDataSchema'

const client = getClient(dataSourcesInfo)
const currency = { logicalName: 'transactioncurrency', entitySet: 'transactioncurrencies', id: 'transactioncurrencyid', primary: 'currencyname' }

export async function getMasterMetadata(name: string, language: Language): Promise<MasterTable> {
  const table = tableByName(name)
  const metadata = object(unwrap(await withTimeout(client.executeAsync({
    dataverseRequest: { action: 'getEntityMetadata', parameters: {
      tableName: table.entitySet, options: { metadata: ['PrimaryIdAttribute', 'PrimaryNameAttribute'],
        schema: { columns: 'all', manyToOne: true } },
    } },
  }))))
  if (!Array.isArray(metadata.Attributes) || !Array.isArray(metadata.ManyToOneRelationships)) {
    throw new Error('Dataverse did not return the master-data columns and relationships.')
  }
  const attributes = metadata.Attributes.map(object)
  const relationships = metadata.ManyToOneRelationships.map(object)
  return { ...table, fields: table.fields.map((field) => {
    const attribute = attributes.find((entry) => entry.LogicalName === field.name)
    if (!attribute) throw new Error(`Missing live metadata: ${field.name}`)
    const labels = attribute.DisplayName && object(attribute.DisplayName).LocalizedLabels
    const localized = Array.isArray(labels) ? labels.map(object).find((l) => l.LanguageCode === (language === 'fr' ? 1036 : 1033)) : undefined
    const relationship = relationships.find((entry) => entry.ReferencingAttribute === field.name)
    const target = relationship?.ReferencedEntity
    return {
      ...field, label: typeof localized?.Label === 'string' ? localized.Label : field.label,
      min: typeof attribute.MinValue === 'number' ? attribute.MinValue : undefined,
      max: typeof attribute.MaxValue === 'number' ? attribute.MaxValue : undefined,
      precision: typeof attribute.Precision === 'number' ? attribute.Precision : undefined,
      create: attribute.IsValidForCreate === true, update: attribute.IsValidForUpdate === true,
      readOnly: field.readOnly || attribute.IsValidForRead !== true,
      navigation: typeof relationship?.ReferencingEntityNavigationPropertyName === 'string'
        ? relationship.ReferencingEntityNavigationPropertyName : field.navigation,
      target: target === currency.logicalName ? currency.entitySet
        : typeof target === 'string' ? tableByName(target).entitySet : undefined,
    }
  }) }
}

export async function listMasterRecords(name: string, search = '', status = '0', skipToken?: string) {
  if (!['', '0', '1'].includes(status)) throw new Error('Invalid master-data status.')
  if (search.length > 150) throw new Error('Master-data search exceeds 150 characters.')
  const table = tableByName(name)
  const escaped = search.trim().replaceAll("'", "''")
  const searchFields = [...new Set([table.primary, ...masterNameFields(table)])]
  const filters = [
    status === '' ? '' : `statecode eq ${status === '1' ? 1 : 0}`,
    escaped ? `(${searchFields.map((field) => `startswith(${field},'${escaped}')`).join(' or ')})` : '',
  ].filter(Boolean)
  const result = await withTimeout(client.retrieveMultipleRecordsAsync<MasterRow>(table.entitySet, {
    select: [...new Set([table.id, table.primary, 'statecode', ...masterNameFields(table)])],
    filter: filters.join(' and '), orderBy: [`${table.primary} asc`, `${table.id} asc`], maxPageSize: 25, skipToken,
  }))
  return { records: unwrap(result), skipToken: result.skipToken }
}

export async function getMasterRecord(table: MasterTable, id: string): Promise<MasterRow> {
  const row = unwrap(await withTimeout(client.retrieveRecordAsync<MasterRow>(table.entitySet, id, {
    select: [...new Set([table.id, table.primary, 'statecode', 'statuscode', ...table.fields.map((f) => f.kind === 'LookupType' ? `_${f.name}_value` : f.name)])],
  })))
  await Promise.all(table.fields.filter((f) => f.kind === 'LookupType' && row[`_${f.name}_value`]).map(async (field) => {
    const key = `_${field.name}_value`
    const labelKey = `${key}@OData.Community.Display.V1.FormattedValue`
    if (typeof row[labelKey] === 'string') return
    if (!field.target) throw new Error(`${field.label}: lookup metadata missing.`)
    const target = field.target === currency.entitySet ? currency : tableByName(field.target)
    const reference = unwrap(await withTimeout(client.retrieveRecordAsync<MasterRow>(target.entitySet, String(row[key]), { select: [target.primary] })))
    if (typeof reference[target.primary] !== 'string') throw new Error(`${field.label}: reference label missing.`)
    row[labelKey] = reference[target.primary]
  }))
  return row
}

export async function saveMasterRecord(table: MasterTable, id: string, values: Record<string, string>, original?: MasterRow): Promise<void> {
  const changes = buildMasterChanges(table, values, original)
  if (original) {
    if (Object.keys(changes).length) unwrap(await withTimeout(client.updateRecordAsync(table.entitySet, id, changes)))
  } else {
    // Reusing this ID after an uncertain create cannot create a duplicate row.
    unwrap(await withTimeout(client.createRecordAsync(table.entitySet, { ...changes, [table.id]: id })))
  }
}

export async function setMasterActive(table: MasterTable, id: string, active: boolean): Promise<void> {
  unwrap(await withTimeout(client.updateRecordAsync(table.entitySet, id, { statecode: active ? 0 : 1, statuscode: active ? 1 : 2 })))
}

export async function searchMasterLookup(entitySet: string, search: string) {
  const table = entitySet === currency.entitySet ? currency : tableByName(entitySet)
  const result = await withTimeout(client.retrieveMultipleRecordsAsync<MasterRow>(table.entitySet, {
    select: [table.id, table.primary], filter: `statecode eq 0 and startswith(${table.primary},'${search.replaceAll("'", "''")}')`,
    orderBy: [`${table.primary} asc`], maxPageSize: 20,
  }))
  return { records: unwrap(result).map((row) => ({ id: String(row[table.id]), label: String(row[table.primary]) })), more: Boolean(result.skipToken) }
}
