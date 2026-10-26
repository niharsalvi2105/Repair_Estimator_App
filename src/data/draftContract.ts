import type { RequestInputs } from '../RequestFields'
import type { Market } from './estimateQuery'

export type DraftEquipment = {
  id: string; number: string; name: string; location: string; customer: string
  oem: string; age?: number | null; matched: boolean
}
export type DraftPackage = {
  id: string; number: string; nameEn: string; nameFr?: string | null
  scopeEn: string; scopeFr?: string | null; hours: number; material: number
}
export type DraftRecord = {
  mode: 'save' | 'load'; id: string; version: string | null; number?: string | null
  title: string; branchId: string; stateId: string; equipmentTypeId: string; jobTypeId: string
  building: string; customer: string; email: string; phone: string; market: Market
  salesperson?: string | null
  pricingState?: string | null
  fields: { key: string; value: string }[]; equipment: DraftEquipment[]; packages: DraftPackage[]
}

export function parseDraft(value: unknown): DraftRecord {
  if (!value || typeof value !== 'object') throw new Error('Invalid draft response.')
  const record = value as Partial<DraftRecord>
  if (typeof record.id !== 'string' || typeof record.version !== 'string' || !record.version
    || typeof record.title !== 'string' || typeof record.branchId !== 'string'
    || typeof record.stateId !== 'string' || typeof record.equipmentTypeId !== 'string'
    || typeof record.building !== 'string' || typeof record.customer !== 'string'
    || !nullableString(record.email) || !nullableString(record.phone) || !nullableString(record.jobTypeId)
    || !nullableString(record.salesperson) || !nullableString(record.number)
    || !nullableString(record.pricingState)
    || ![126110000, 126110001, 126110002].includes(record.market ?? -1)
    || !Array.isArray(record.fields) || !Array.isArray(record.equipment) || !Array.isArray(record.packages)) {
    throw new Error('The draft service returned incomplete data. Reload before editing.')
  }
  if (record.equipment.length < 1 || record.equipment.length > 14 || record.packages.length < 1 || record.packages.length > 3)
    throw new Error('Invalid draft selection counts.')
  if (new Set(record.fields.map((f) => f?.key)).size !== record.fields.length) throw new Error('Duplicate draft input.')
  for (const field of record.fields) {
    if (!field || typeof field.key !== 'string' || typeof field.value !== 'string') throw new Error('Invalid draft field.')
  }
  for (const equipment of record.equipment) {
    if (!equipment || typeof equipment.number !== 'string' || typeof equipment.matched !== 'boolean'
      || typeof equipment.id !== 'string' || (equipment.matched && !equipment.id)
      || ![equipment.name, equipment.location, equipment.customer, equipment.oem].every(nullableString)
      || (equipment.age != null && (!Number.isInteger(equipment.age) || equipment.age < 0 || equipment.age > 200)))
      throw new Error('Invalid draft equipment snapshot.')
  }
  for (const item of record.packages) {
    if (!item || typeof item.id !== 'string' || typeof item.number !== 'string'
      || typeof item.nameEn !== 'string' || typeof item.scopeEn !== 'string'
      || !nullableString(item.nameFr) || !nullableString(item.scopeFr)
      || !Number.isFinite(item.hours) || item.hours < 0
      || !Number.isFinite(item.material) || item.material < 0) throw new Error('Invalid draft package snapshot.')
  }

  function nullableString(value: unknown): boolean {
    return value == null || typeof value === 'string'
  }
  return record as DraftRecord
}

export function draftInputs(record: DraftRecord): RequestInputs {
  const result: RequestInputs = {}
  for (const field of record.fields) {
    if (!isRequestInputKey(field.key)) throw new Error(`Unsupported saved input: ${field.key}`)
    result[field.key] = field.value
  }
  return result
}

export function isRequestInputKey(key: string): key is keyof RequestInputs {
  return [
    're_supervisor', 're_workcenterrequest', 're_numberoftechs', 're_hasbeenapproved',
    're_nationalaccount', 're_emergency', 're_subcontractorcost', 're_customerbudgeted',
    're_papertype', 're_consultantinvolved', 're_competingbids', 're_statedlaborrate',
    're_proposallanguage', 're_timecategory', 're_additionallaborhours', 're_additionalmaterial',
    're_additionalmiscellaneous', 're_usetax', 're_freight', 're_additionalscope', 're_sellprice',
    're_billingplan', 're_margincomments', 're_prospectaccount', 're_soldto', 're_billto',
    're_payer', 're_notesforcttteam',
  ].includes(key)
}
