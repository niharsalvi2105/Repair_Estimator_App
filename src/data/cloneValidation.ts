import type { Branch, DraftReferences, Equipment, ReferenceOption, RepairPackage } from './repairEstimatorRepository'
import type { DraftChoices } from './draftChoices'
import type { DraftRecord } from './draftContract'
import { EQUIPMENT_LOOKUP_BATCH_SIZE } from './equipmentPaste.ts'

export async function revalidateClone(record: DraftRecord, transport: {
  branches: () => Promise<Branch[]>
  references: () => Promise<{ equipmentTypes: ReferenceOption[]; jobTypes: ReferenceOption[] }>
  locations: () => Promise<DraftReferences>
  choices: (keys: string[]) => Promise<DraftChoices>
  equipment: (branchId: string, numbers: string[]) => Promise<Equipment[]>
  packages: (countryId: string) => Promise<RepairPackage[]>
}): Promise<DraftRecord> {
  const [branches, references, locations] = await Promise.all([
    transport.branches(), transport.references(), transport.locations(),
  ])
  const branch = branches.find(row => row.re_branchid === record.branchId && row.re_market === record.market)
  if (!branch?._re_country_value || !branch._re_currency_value ||
    !locations.currencies.some(row => row.id === branch._re_currency_value))
    throw new Error('The source branch/currency is no longer available. Review its current configuration.')
  if (record.stateId && !locations.states.some(row => row.id === record.stateId && row.countryId === branch._re_country_value))
    throw new Error('The source building province/state is no longer valid for this branch.')
  if (locations.states.find(row => row.id === record.stateId)?.frenchRequired &&
    record.fields.find(field => field.key === 're_proposallanguage')?.value !== '126110001')
    throw new Error('The source province now requires French proposal language. Update it before cloning.')
  if (record.equipmentTypeId && !references.equipmentTypes.some(row => row.id === record.equipmentTypeId))
    throw new Error('The source equipment type is no longer available.')
  if (record.jobTypeId && !references.jobTypes.some(row => row.id === record.jobTypeId))
    throw new Error('The source job type is no longer available.')
  const choiceFields = record.fields.filter(field => field.value &&
    !['re_supervisor', 're_numberoftechs', 're_notesforcttteam', 're_additionalscope', 're_additionallaborhours',
      're_additionalmaterial', 're_additionalmiscellaneous', 're_usetax', 're_freight'].includes(field.key))
  if (choiceFields.length) {
    const choices = await transport.choices(choiceFields.map(field => field.key))
    for (const field of choiceFields)
      if (!choices[field.key]?.some(option => String(option.value) === field.value))
        throw new Error(`The source contains an unavailable choice: ${field.key}. Update it before cloning.`)
  }
  const matched = record.equipment.filter(row => row.matched)
  const currentEquipment: Equipment[] = []
  for (let offset = 0; offset < matched.length; offset += EQUIPMENT_LOOKUP_BATCH_SIZE)
    currentEquipment.push(...await transport.equipment(record.branchId, matched.slice(offset, offset + EQUIPMENT_LOOKUP_BATCH_SIZE).map(row => row.number)))
  const equipment = record.equipment.map(row => {
    if (!row.matched) return { ...row, id: '', customer: record.customer }
    const current = currentEquipment.filter(item => item.re_equipment.toLowerCase() === row.number.toLowerCase())
    if (current.length !== 1 || current[0].re_equipmentid !== row.id)
      throw new Error(`Equipment ${row.number} is missing, ambiguous or outside the current branch.`)
    const item = current[0]
    return { id: item.re_equipmentid, number: item.re_equipment, name: item.re_equipmentname ?? '',
      location: item.re_functionallocation ?? '', customer: item.re_soldtoname ?? '', oem: item.re_oem ?? '',
      age: item.re_equipmentage, matched: true }
  })
  const catalog = record.packages.length ? await transport.packages(branch._re_country_value) : []
  const packages = record.packages.map(row => {
    const current = catalog.find(item => item.re_repairpackageid === row.id)
    if (!current) throw new Error(`Package ${row.number} is no longer available for this branch.`)
    return { id: current.re_repairpackageid, number: current.re_packagenumber, nameEn: current.re_packagenameen,
      nameFr: current.re_packagenamefr, scopeEn: current.re_proposalscopeen ?? '', scopeFr: current.re_proposalscopefr,
      hours: current.re_mechanichours, material: current.re_materialmisctaxcost,
      materialBeforeMarkup: current.re_materialbeforemarkup,
      isCustom: current.re_iscustompackage, isTimeMaterial: current.re_istimematerial }
  })
  const customIds = new Set(packages.filter(row => row.isCustom).map(row => row.id))
  if ([...(record.laborLines ?? []), ...(record.materialLines ?? [])].some(row => !customIds.has(row.packageId ?? '')))
    throw new Error('Custom costs no longer match current CSTM packages. Clone without custom costs and re-enter them.')
  return { ...record, equipment, packages }
}
