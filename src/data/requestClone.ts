import { isRequestInputKey, type DraftRecord } from './draftContract.ts'

export const OPPORTUNITY_FIELDS = [
  're_supervisor', 're_workcenterrequest', 're_numberoftechs', 're_nationalaccount', 're_emergency',
  're_customerbudgeted', 're_papertype', 're_consultantinvolved', 're_competingbids', 're_proposallanguage',
] as const
export type OpportunityValues = Pick<DraftRecord, 'branchId' | 'stateId' | 'equipmentTypeId' | 'jobTypeId' |
  'building' | 'customer' | 'email' | 'phone' | 'market' | 'fields'>
export type CloneSections = { opportunity: boolean; equipment: boolean; packages: boolean; custom: boolean; notes: boolean }
export const DEFAULT_CLONE_SECTIONS: CloneSections = { opportunity: true, equipment: false, packages: false, custom: false, notes: false }
const CUSTOM_FIELDS = ['re_timecategory', 're_additionallaborhours', 're_additionalmaterial',
  're_additionalmiscellaneous', 're_usetax', 're_freight', 're_additionalscope']
const NOTE_FIELDS = ['re_billingplan', 're_notesforcttteam']
const allowedOpportunityFields = new Set<string>(OPPORTUNITY_FIELDS)

export function opportunityValues(source: OpportunityValues): OpportunityValues {
  return {
    branchId: source.branchId, stateId: source.stateId, equipmentTypeId: source.equipmentTypeId,
    jobTypeId: source.jobTypeId ?? '', building: source.building, customer: source.customer,
    email: source.email ?? '', phone: source.phone ?? '', market: source.market,
    fields: source.fields.filter(field => allowedOpportunityFields.has(field.key)).map(field => ({ ...field })),
  }
}

export function parseOpportunityValues(value: unknown): OpportunityValues {
  if (!value || typeof value !== 'object') throw new Error('Invalid Opportunity preset.')
  const record = value as Partial<OpportunityValues>
  if (!['branchId', 'stateId', 'equipmentTypeId', 'jobTypeId', 'building', 'customer', 'email', 'phone']
    .every(key => typeof record[key as keyof OpportunityValues] === 'string') ||
    ![126110000, 126110001, 126110002].includes(record.market ?? -1) || !Array.isArray(record.fields))
    throw new Error('Invalid Opportunity preset.')
  const lengths = { branchId: 36, stateId: 36, equipmentTypeId: 36, jobTypeId: 36, building: 300, customer: 300, email: 100, phone: 100 }
  for (const [key, max] of Object.entries(lengths)) {
    const text = record[key as keyof typeof lengths]
    if (typeof text !== 'string' || text.length > max) throw new Error('Invalid Opportunity preset field.')
  }
  if (!record.branchId || !record.stateId || !record.equipmentTypeId || !record.building?.trim() ||
    !record.customer?.trim() || !record.email?.trim()) throw new Error('Complete the Opportunity details before saving a preset.')
  if (record.fields.some(field => !field || !allowedOpportunityFields.has(field.key) ||
    typeof field.value !== 'string' || field.value.length > 100) ||
    new Set(record.fields.map(field => field.key)).size !== record.fields.length)
    throw new Error('Invalid Opportunity preset inputs.')
  if (!record.fields.some(field => field.key === 're_proposallanguage' && field.value))
    throw new Error('Select a proposal language before saving a preset.')
  return opportunityValues(record as OpportunityValues)
}

export function cloneRequest(source: DraftRecord | OpportunityValues, sections: CloneSections, id: string): DraftRecord {
  if (!Object.values(sections).some(Boolean)) throw new Error('Select at least one section to copy.')
  if (sections.custom && !sections.packages) throw new Error('Custom costs require package selection.')
  const full = 'equipment' in source ? source : undefined
  const fields = source.fields.filter(field => isRequestInputKey(field.key) &&
    ((sections.opportunity && allowedOpportunityFields.has(field.key)) ||
      (sections.custom && CUSTOM_FIELDS.includes(field.key)) || (sections.notes && NOTE_FIELDS.includes(field.key))))
    .map(field => ({ ...field }))
  const opportunity = sections.opportunity ? opportunityValues(source) : {
    market: source.market, branchId: source.branchId, stateId: '', equipmentTypeId: '', jobTypeId: '',
    building: '', customer: '', email: '', phone: '', fields: [],
  }
  return {
    ...opportunity, mode: 'save', id, version: null, title: '', fields,
    equipment: sections.equipment ? (full?.equipment ?? []).map(row => ({ ...row })) : [],
    packages: sections.packages ? (full?.packages ?? []).map(row => ({ ...row })) : [],
    laborLines: sections.custom ? (full?.laborLines ?? []).map(row => ({ ...row, id: crypto.randomUUID(), rate: undefined })) : [],
    materialLines: sections.custom ? (full?.materialLines ?? []).map(row => ({
      ...row, id: crypto.randomUUID(), refreshPart: !!row.catalogPartId,
    })) : [],
  }
}
