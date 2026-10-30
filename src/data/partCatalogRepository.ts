import { Re_DraftEstimateService } from '../generated/services/Re_DraftEstimateService'
import { unwrap, withTimeout } from './dataverseOperation'
import type { Market } from './estimateQuery'

export type CatalogPart = {
  id: string; number: string; description: string; partType: 'kone' | 'non-kone'
  unitCost: number; unitPrice?: number | null; uom: string
}
export type CatalogResult = {
  available: boolean; reason?: string; currency?: string; defaultMarkupPercent: number
  more: boolean; parts: CatalogPart[]
}

export function parsePartCatalog(value: unknown): CatalogResult {
  if (!value || typeof value !== 'object') throw new Error('Invalid parts catalog response.')
  const result = value as Partial<CatalogResult> & { mode?: string }
  if (result.mode !== 'partcatalog' || typeof result.available !== 'boolean' || !Array.isArray(result.parts) ||
    typeof result.more !== 'boolean' || !Number.isFinite(result.defaultMarkupPercent))
    throw new Error('The parts catalog service is not available in the deployed backend.')
  if (result.available && (!['USD', 'CAD'].includes(result.currency ?? '') ||
    (result.defaultMarkupPercent ?? -1) < 0 || (result.defaultMarkupPercent ?? 101) > 100))
    throw new Error('Invalid parts pricing configuration.')
  if (!result.available && (typeof result.reason !== 'string' || !result.reason.trim()))
    throw new Error('Parts catalog unavailable without a diagnostic.')
  for (const part of result.parts) {
    if (!part || typeof part.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part.id) ||
      typeof part.number !== 'string' || !part.number || typeof part.description !== 'string' || !part.description ||
      !['kone', 'non-kone'].includes(part.partType) || typeof part.uom !== 'string' || !part.uom ||
      !Number.isFinite(part.unitCost) || part.unitCost <= 0 ||
      (part.unitPrice != null && (!Number.isFinite(part.unitPrice) || part.unitPrice < 0)) ||
      (part.partType === 'kone' && !(part.unitPrice != null && part.unitPrice > 0)))
      throw new Error('The parts catalog returned an incomplete or invalid part.')
  }
  if (new Set(result.parts.map((part) => part.id)).size !== result.parts.length)
    throw new Error('The parts catalog returned duplicate IDs.')
  return result as CatalogResult
}

export async function getPartCatalog(market: Market, search?: string, partType?: 'kone' | 'non-kone'): Promise<CatalogResult> {
  const result = unwrap(await withTimeout(Re_DraftEstimateService.re_DraftEstimate(JSON.stringify({
    mode: search === undefined ? 'partcapabilities' : 'partcatalog', market, search, partType,
  }))))
  if (typeof result?.ResultJson !== 'string') throw new Error('The parts catalog service returned no response.')
  const parsed = parsePartCatalog(JSON.parse(result.ResultJson))
  if (parsed.available && parsed.currency !== (market === 126110000 ? 'USD' : 'CAD'))
    throw new Error('Parts catalog currency does not match the estimate market.')
  if (partType && parsed.parts.some((part) => part.partType !== partType))
    throw new Error('Parts catalog returned a different part classification.')
  return parsed
}
