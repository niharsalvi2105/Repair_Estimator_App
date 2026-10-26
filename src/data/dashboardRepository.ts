import { Re_DraftEstimateService } from '../generated/services/Re_DraftEstimateService'
import { unwrap, withTimeout } from './dataverseOperation'
import { parseDashboard } from './dashboardContract'
import type { Market } from './estimateQuery'

export async function getDashboard(market: Market, owner: string) {
  const result = unwrap(await withTimeout(
    Re_DraftEstimateService.re_DraftEstimate(JSON.stringify({ mode: 'dashboard', market })), 120000,
  ))
  if (typeof result.ResultJson !== 'string') throw new Error('The dashboard service returned an invalid response.')
  return parseDashboard(JSON.parse(result.ResultJson), market, owner)
}
