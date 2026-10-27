import type { RequestInputs } from '../RequestFields'
import type { Market } from './estimateQuery'

export type DraftEquipment = {
  id: string; number: string; name: string; location: string; customer: string
  oem: string; age?: number | null; matched: boolean
}
export type DraftPackage = {
  id: string; number: string; nameEn: string; nameFr?: string | null
  scopeEn: string; scopeFr?: string | null; hours: number; material: number
  isCustom?: boolean; isTimeMaterial?: boolean
}
export type DraftLabor = { id: string; role: number; time: number; hours: number; rate?: number }
export type DraftMaterial = { id: string; description: string; vendor: string; part: string; quantity: number; unitCost: number }
export const MAX_DRAFT_BYTES = 200000
export const MAX_DRAFT_CHILD_OPERATIONS = 1000
export function serializeDraft(input: unknown): string {
  const json = JSON.stringify(input)
  if (new TextEncoder().encode(json).length > MAX_DRAFT_BYTES)
    throw new Error('Draft exceeds the 200000-byte request budget. / Le brouillon dépasse la limite de 200000 octets.')
  return json
}
export type DraftRecord = {
  mode: 'save' | 'load'; id: string; version: string | null; number?: string | null
  title: string; branchId: string; stateId: string; equipmentTypeId: string; jobTypeId: string
  building: string; customer: string; email: string; phone: string; market: Market
  salesperson?: string | null
  pricingState?: string | null
  fields: { key: string; value: string }[]; equipment: DraftEquipment[]; packages: DraftPackage[]
  laborLines?: DraftLabor[]; materialLines?: DraftMaterial[]
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
  if (record.equipment.length < 1 || record.equipment.length > 14 || record.packages.length < 1 ||
    record.packages.length + record.equipment.length + (record.laborLines?.length ?? 0) +
      (record.materialLines?.length ?? 0) > MAX_DRAFT_CHILD_OPERATIONS)
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
      || (item.isCustom != null && typeof item.isCustom !== 'boolean')
      || (item.isTimeMaterial != null && typeof item.isTimeMaterial !== 'boolean')
      || !Number.isFinite(item.hours) || item.hours < 0
      || !Number.isFinite(item.material) || item.material < 0) throw new Error('Invalid draft package snapshot.')
  }
  if (record.laborLines != null && (!Array.isArray(record.laborLines) || record.laborLines.some((line) =>
    !line || typeof line.id !== 'string' || ![126110000, 126110001, 126110002].includes(line.role) ||
    ![126110000, 126110001].includes(line.time) || !Number.isFinite(line.hours) || line.hours < 0 ||
    line.hours > 100000 || !Number.isFinite(line.rate) || (line.rate ?? -1) < 0)))
    throw new Error('Invalid draft labor snapshot.')
  if (record.materialLines != null && (!Array.isArray(record.materialLines) || record.materialLines.some((line) =>
    !line || typeof line.id !== 'string' || typeof line.description !== 'string' ||
    !nullableString(line.vendor) || !nullableString(line.part) ||
    !Number.isFinite(line.quantity) || line.quantity < 0 || !Number.isFinite(line.unitCost) || line.unitCost < 0)))
    throw new Error('Invalid draft material snapshot.')

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
    're_payer', 're_notesforcttteam', 're_konesparessalespricevk13',
  ].includes(key)
}
