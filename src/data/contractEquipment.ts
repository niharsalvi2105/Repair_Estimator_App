import type { Equipment } from './repairEstimatorRepository'
import type { DraftEquipment } from './draftContract'

export type ContractResult = {
  mode: 'contracts'; available: boolean; reason?: string | null; more: boolean
  contracts: string[]; notFound: string[]; equipment: DraftEquipment[]
}
export function validContractNumber(number: string): boolean {
  return /^[\p{L}\p{N}.-]{1,100}$/u.test(number)
}
export function parseContractResult(value: unknown): ContractResult {
  if (!value || typeof value !== 'object') throw new Error('Invalid contract equipment response.')
  const result = value as Partial<ContractResult>
  if (result.mode !== 'contracts' || typeof result.available !== 'boolean' || typeof result.more !== 'boolean' ||
    !Array.isArray(result.contracts) || !Array.isArray(result.notFound) || !Array.isArray(result.equipment))
    throw new Error('Contract equipment is not available in the deployed backend.')
  if (!result.available && (typeof result.reason !== 'string' || !result.reason.trim()))
    throw new Error('Contract lookup unavailable without a diagnostic.')
  for (const numbers of [result.contracts, result.notFound]) {
    if (numbers.some((n) => typeof n !== 'string' || !validContractNumber(n)) ||
      new Set(numbers.map((n) => n.toLowerCase())).size !== numbers.length)
      throw new Error('Invalid or duplicate contract identifiers.')
  }
  if (result.equipment.some((e) => !e || typeof e.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e.id) ||
    typeof e.number !== 'string' || !e.number.trim() || e.number.length > 20 || e.matched !== true ||
    [e.name, e.location, e.customer, e.oem].some((v) => v != null && typeof v !== 'string') ||
    (e.age != null && (!Number.isInteger(e.age) || e.age < 0 || e.age > 200))) ||
    new Set(result.equipment.map((e) => e.id)).size !== result.equipment.length)
    throw new Error('Invalid contract equipment snapshots.')
  return result as ContractResult
}
export function contractEquipmentRecords(result: ContractResult): Equipment[] {
  if (!result.available) throw new Error(result.reason ?? 'Contract lookup unavailable.')
  return result.equipment.map((e) => ({
    re_equipmentid: e.id, re_equipment: e.number, re_equipmentname: e.name ?? '',
    re_functionallocation: e.location ?? '', re_soldtoname: e.customer ?? '',
    re_oem: e.oem ?? '', re_equipmentage: e.age ?? undefined,
  }))
}
