import { Re_DraftEstimateService } from '../generated/services/Re_DraftEstimateService'
import { createDraftChoiceLoader } from './draftChoiceLoader'
import { getGlobalOptionSet, getStringMaps } from './stringMapService'

export const getDraftChoices = createDraftChoiceLoader({
  stringMaps: getStringMaps,
  optionSet: getGlobalOptionSet,
  draftApi: (input) => Re_DraftEstimateService.re_DraftEstimate(input),
})
