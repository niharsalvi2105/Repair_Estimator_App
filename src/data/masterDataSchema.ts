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
  en: string; fr: string; nameFields: string[]; fields: MasterField[]
}
type MasterTableSummary = Omit<MasterTable, 'fields'>

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

const summaries = import.meta.glob<Pick<MasterTableSummary, 'logicalName' | 'entitySet' | 'id' | 'primary' | 'nameFields'>>(
  '../../.power/schemas/dataverse/{countries,state_provinces,branches,salesoffices,margingroups,equipmenttypes,equipment,customerverticals,jobtypes,packagecategories,repairpackages,scopelibraries,laborrates,jobsizebands,redundancybands,oembandrules,bandmatrices,marginrules,situationaladjustments,incentiverates,pricingparameters}.Schema.json',
  { eager: true, import: 'default', query: '?master-summary' },
)
const fieldLoaders = import.meta.glob<MasterField[]>(
  '../../.power/schemas/dataverse/{countries,state_provinces,branches,salesoffices,margingroups,equipmenttypes,equipment,customerverticals,jobtypes,packagecategories,repairpackages,scopelibraries,laborrates,jobsizebands,redundancybands,oembandrules,bandmatrices,marginrules,situationaladjustments,incentiverates,pricingparameters}.Schema.json',
  { import: 'default', query: '?master-fields' },
)
const loadedTables = new Map<string, Promise<MasterTable>>()
export function object(value: unknown): MasterRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Dataverse metadata or record.')
  return value as MasterRow
}

export const masterTables: MasterTableSummary[] = definitions.map(([file, en, fr]) => {
  const summary = summaries[`../../.power/schemas/dataverse/${file}.Schema.json`]
  if (!summary) throw new Error(`Missing approved master schema: ${file}`)
  return { ...summary, en, fr }
})

export function tableByName(name: string): MasterTableSummary {
  const table = masterTables.find((entry) => entry.logicalName === name || entry.entitySet === name)
  if (!table) throw new Error('This table is not in the approved master-data inventory.')
  return table
}

export function loadMasterTable(name: string): Promise<MasterTable> {
  const summary = tableByName(name)
  const cached = loadedTables.get(summary.logicalName)
  if (cached) return cached
  const definition = definitions.find(([, en]) => en === summary.en)
  if (!definition) throw new Error(`Missing master definition: ${name}`)
  const load = fieldLoaders[`../../.power/schemas/dataverse/${definition[0]}.Schema.json`]
  if (!load) throw new Error(`Missing master fields: ${name}`)
  const request = load().then((fields) => ({ ...summary, fields })).catch((reason: unknown) => {
    loadedTables.delete(summary.logicalName)
    throw reason
  })
  loadedTables.set(summary.logicalName, request)
  return request
}

export function fieldKey(field: MasterField): string {
  return field.kind === 'LookupType' ? `_${field.name}_value` : field.name
}

export function masterNameFields(table: MasterTableSummary): string[] {
  return table.nameFields
}

export function masterRecordLabel(table: MasterTableSummary, row: MasterRow, language: Language): string {
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
