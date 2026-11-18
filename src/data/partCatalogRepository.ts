import { Re_DraftEstimateService } from '../generated/services/Re_DraftEstimateService'
import { unwrap, withTimeout } from './dataverseOperation'
import type { Market } from './estimateQuery'
import { parsePartCatalog, type CatalogResult } from './partCatalogContract'
export { parsePartCatalog, type CatalogDetails, type CatalogIssue, type CatalogPart, type CatalogResult } from './partCatalogContract'

export async function getPartCatalog(
  market: Market, search?: string, page?: number, cursor?: string,
): Promise<CatalogResult> {
  const result = unwrap(await withTimeout(Re_DraftEstimateService.re_DraftEstimate(JSON.stringify({
    mode: search === undefined ? 'partcapabilities' : 'partcatalog', market,
    ...(search === undefined ? {} : { search }),
    ...(page === undefined ? {} : { partPage: page }),
    ...(cursor === undefined ? {} : { catalogCursor: cursor }),
  }))))
  if (typeof result?.ResultJson !== 'string') throw new Error('The parts catalog service returned no response.')
  const parsed = parsePartCatalog(JSON.parse(result.ResultJson))
  if (parsed.available && parsed.currency !== (market === 126110000 ? 'USD' : 'CAD'))
    throw new Error('Parts catalog currency does not match the estimate market.')
  return parsed
}
