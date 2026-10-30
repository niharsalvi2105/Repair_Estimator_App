import { Re_DraftEstimateService } from '../generated/services/Re_DraftEstimateService'
import { unwrap, withTimeout } from './dataverseOperation'
import { serializeDraft } from './draftContract'
import { parseOpportunityValues, type OpportunityValues } from './requestClone'
import type { Market } from './estimateQuery'

export type OpportunityPreset = { id: string; name: string; opportunity: OpportunityValues }
export function parsePresetResponse(value: unknown): { presets: OpportunityPreset[]; nextToken?: string | null } {
  if (!value || typeof value !== 'object') throw new Error('Invalid preset service response.')
  const result = value as { mode?: unknown; presets?: unknown; nextToken?: unknown }
  if (result.mode !== 'presets' || !Array.isArray(result.presets) ||
    (result.nextToken != null && typeof result.nextToken !== 'string'))
    throw new Error('Opportunity presets require the updated draft API and private preset table. Contact your administrator.')
  return { nextToken: result.nextToken, presets: result.presets.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid saved preset.')
    const row = entry as Partial<OpportunityPreset>
    if (typeof row.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id) ||
      typeof row.name !== 'string' || !row.name.trim() || row.name.length > 100)
      throw new Error('Invalid saved preset.')
    return { id: row.id, name: row.name, opportunity: parseOpportunityValues(row.opportunity) }
  }) }
}
async function operation(input: object) {
  const result = unwrap(await withTimeout(Re_DraftEstimateService.re_DraftEstimate(serializeDraft(input))))
  if (typeof result?.ResultJson !== 'string') throw new Error('Opportunity preset service returned no response. Deploy the updated draft API.')
  return parsePresetResponse(JSON.parse(result.ResultJson))
}
export async function listOpportunityPresets(market: Market) {
  const rows: OpportunityPreset[] = []
  const tokens = new Set<string>()
  let nextToken: string | null | undefined
  do {
    const result = await operation({ mode: 'presetlist', market, nextToken })
    rows.push(...result.presets)
    nextToken = result.nextToken
    if (nextToken && tokens.has(nextToken)) throw new Error('Preset service returned a repeated paging token.')
    if (nextToken) tokens.add(nextToken)
  } while (nextToken)
  if (new Set(rows.map(row => row.id)).size !== rows.length || rows.some(row => row.opportunity.market !== market))
    throw new Error('Preset service returned duplicate records or a different market.')
  return rows
}
export async function saveOpportunityPreset(name: string, opportunity: OpportunityValues) {
  return operation({ mode: 'presetsave', presetName: name.trim(), opportunity: parseOpportunityValues(opportunity) })
}
export async function deleteOpportunityPreset(id: string) {
  return operation({ mode: 'presetdelete', id })
}
