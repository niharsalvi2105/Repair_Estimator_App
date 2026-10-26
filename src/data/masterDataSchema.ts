export type Language = 'en' | 'fr'
export type MasterRow = Record<string, unknown>
export type MasterField = {
  name: string; label: string; kind: string; required: boolean; readOnly: boolean
  maxLength?: number; options: { value: number; label: string }[]
  navigation?: string; target?: string; create: boolean; update: boolean
  min?: number; max?: number; precision?: number
}
export type MasterTable = {
  logicalName: string; entitySet: string; id: string; primary: string
  en: string; fr: string; fields: MasterField[]
}

const definitions = [
  ['countries', 'Countries', 'Pays'],
  ['state_provinces', 'States / provinces', 'États / provinces'],
  ['branches', 'Branches', 'Succursales'],
  ['salesoffices', 'Sales offices', 'Bureaux de vente'],
  ['margingroups', 'Margin groups', 'Groupes de marge'],
  ['equipmenttypes', 'Equipment types', 'Types d’équipement'],
  ['equipment', 'Equipment', 'Équipements'],
  ['customerverticals', 'Customer verticals', 'Secteurs clients'],
  ['jobtypes', 'Job types', 'Types de travaux'],
  ['packagecategories', 'Package categories', 'Catégories de forfait'],
  ['repairpackages', 'Repair packages', 'Forfaits de réparation'],
  ['scopelibraries', 'Scope library', 'Bibliothèque de portées'],
  ['laborrates', 'Labor rates', 'Taux de main-d’œuvre'],
  ['jobsizebands', 'Job size bands', 'Bandes de taille des travaux'],
  ['redundancybands', 'Redundancy bands', 'Bandes de redondance'],
  ['oembandrules', 'OEM band rules', 'Règles des bandes OEM'],
  ['bandmatrices', 'Band matrices', 'Matrices des bandes'],
  ['marginrules', 'Margin rules', 'Règles de marge'],
  ['situationaladjustments', 'Situational adjustments', 'Ajustements situationnels'],
  ['incentiverates', 'Incentive rates', 'Taux d’incitatifs'],
  ['pricingparameters', 'Pricing parameters', 'Paramètres de tarification'],
] as const

const schemas = import.meta.glob('../../.power/schemas/dataverse/*.Schema.json', { eager: true, import: 'default' })
export function object(value: unknown): MasterRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Dataverse metadata or record.')
  return value as MasterRow
}

export const masterTables: MasterTable[] = definitions.map(([file, en, fr]) => {
  const schema = object(schemas[`../../.power/schemas/dataverse/${file}.Schema.json`])
  const item = object(object(schema.schema).items)
  return {
    logicalName: String(schema.name), entitySet: String(item['x-ms-dataverse-entityset']),
    id: String(item['x-ms-dataverse-primary-id']), primary: String(item['x-ms-dataverse-primary-name']), en, fr,
    fields: Object.entries(object(item.properties))
      .filter(([name, value]) => name.startsWith('re_') && !object(value)['x-ms-dataverse-attribute-of']
        && !object(value)['x-ms-dataverse-primary-id'])
      .map(([name, value]) => {
        const field = object(value)
        const labels = Array.isArray(field.enum) ? field.enum : []
        const values = Array.isArray(field['x-ms-enum-values']) ? field['x-ms-enum-values'] : []
        const navigation = field['x-ms-dataverse-navigation-properties']
        return {
          name, label: String(field.title), kind: String(field['x-ms-dataverse-type']),
          required: field.required === true, readOnly: field['x-ms-read-only'] === true,
          maxLength: typeof field.maxLength === 'number' ? field.maxLength : undefined,
          options: values.map((v, i) => ({ value: Number(v), label: String(labels[i]) })),
          navigation: Array.isArray(navigation) ? String(navigation[0]) : undefined,
          create: !field['x-ms-read-only'], update: !field['x-ms-read-only'],
        }
      }),
  }
})

export function tableByName(name: string): MasterTable {
  const table = masterTables.find((entry) => entry.logicalName === name || entry.entitySet === name)
  if (!table) throw new Error('This table is not in the approved master-data inventory.')
  return table
}

export function fieldKey(field: MasterField): string {
  return field.kind === 'LookupType' ? `_${field.name}_value` : field.name
}

export function masterNameFields(table: MasterTable): string[] {
  return table.fields.filter((field) => /(?:name|jobtype)(?:en|fr)$/.test(field.name) && field.kind === 'StringType').map((field) => field.name)
}

export function masterRecordLabel(table: MasterTable, row: MasterRow, language: Language): string {
  const names = masterNameFields(table)
  const english = names.find((name) => name.endsWith('en'))
  const french = names.find((name) => name.endsWith('fr'))
  return String((language === 'fr' && french ? row[french] : '') || (english ? row[english] : '') || row[table.primary] || '—')
}

export function fieldInput(row: MasterRow, field: MasterField): string {
  const value = row[fieldKey(field)]
  if (value === null || value === undefined) return ''
  if (field.kind === 'BooleanType') return value ? '1' : '0'
  if (field.kind === 'DateTimeType') return String(value).slice(0, 10)
  return String(value)
}

export function buildMasterChanges(table: MasterTable, values: Record<string, string>, original?: MasterRow): MasterRow {
  if (values.re_effectivefrom && values.re_effectiveto && values.re_effectiveto < values.re_effectivefrom) {
    throw new Error('Effective To must not precede Effective From / La date de fin doit suivre la date de début.')
  }
  const changes: MasterRow = {}
  for (const field of table.fields) {
    if (field.readOnly || (original ? !field.update : !field.create)) continue
    const input = values[field.name] ?? ''
    if (original && input === fieldInput(original, field)) continue
    if (field.required && !input.trim()) throw new Error(`${field.label}: required / obligatoire.`)
    if (field.maxLength && input.length > field.maxLength) throw new Error(`${field.label}: maximum ${field.maxLength}.`)
    let value: unknown = input || null
    if (input && ['DecimalType', 'DoubleType', 'MoneyType', 'IntegerType'].includes(field.kind)) {
      value = Number(input)
      if (!Number.isFinite(value) || (field.kind === 'IntegerType' && !Number.isInteger(value))) {
        throw new Error(`${field.label}: invalid number / nombre invalide.`)
      }
      if (typeof value === 'number' && ((field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max))) {
        throw new Error(`${field.label}: value outside the permitted range / valeur hors limites.`)
      }
    } else if (input && field.kind === 'BooleanType') {
      if (!['0', '1'].includes(input)) throw new Error(`${field.label}: invalid boolean.`)
      value = input === '1'
    } else if (input && field.kind === 'PicklistType') {
      value = Number(input)
      if (!field.options.some((option) => option.value === value)) throw new Error(`${field.label}: invalid choice.`)
    } else if (field.kind === 'LookupType') {
      if (!field.navigation || !field.target) throw new Error(`${field.label}: lookup metadata missing.`)
      if (input && !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(input)) throw new Error(`${field.label}: invalid reference.`)
      changes[`${field.navigation}@odata.bind`] = input ? `/${field.target}(${input})` : null
      continue
    } else if (input && field.kind === 'DateTimeType') {
      const date = new Date(input)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input) {
        throw new Error(`${field.label}: invalid date.`)
      }
    }
    changes[field.name] = value
  }
  return changes
}
