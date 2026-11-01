import { Re_DraftEstimateService } from '../generated/services/Re_DraftEstimateService'
import { unwrap, withTimeout } from './dataverseOperation'
import type { Market } from './estimateQuery'
import { parseContractResult } from './contractEquipment'

export async function getContractEquipment(branchId: string, market: Market,
  mode: 'contractcapabilities' | 'contractsearch' | 'contractresolve', input?: string | string[]) {
  if (import.meta.env.VITE_CONTRACT_LOOKUP_ENABLED !== 'true') {
    return parseContractResult({
      mode: 'contracts', available: false, more: false,
      reason: 'Contract lookup is not enabled in this app release. The updated backend and approved equipment mapping must be deployed first. Equipment search and draft saving remain available.',
      contracts: [], notFound: [], equipment: [],
    })
  }
  const result = unwrap(await withTimeout(Re_DraftEstimateService.re_DraftEstimate(JSON.stringify({
    mode, branchId, market, search: typeof input === 'string' ? input : undefined,
    contractNumbers: Array.isArray(input) ? input : undefined,
  }))))
  if (typeof result?.ResultJson !== 'string') throw new Error('Contract equipment service returned no response.')
  return parseContractResult(JSON.parse(result.ResultJson))
}
