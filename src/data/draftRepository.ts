import { Re_DraftEstimateService } from '../generated/services/Re_DraftEstimateService'
import { unwrap, withTimeout } from './dataverseOperation'
import { parseDraft, type DraftRecord } from './draftContract'

export { draftInputs, type DraftRecord } from './draftContract'

export async function draftOperation(input: DraftRecord | { mode: 'load'; id: string }): Promise<DraftRecord> {
  const result = unwrap(await withTimeout(
    Re_DraftEstimateService.re_DraftEstimate(JSON.stringify(input)), 120000,
  ))
  if (typeof result?.ResultJson !== 'string') throw new Error('The draft service returned an invalid response.')
  return parseDraft(JSON.parse(result.ResultJson))
}
