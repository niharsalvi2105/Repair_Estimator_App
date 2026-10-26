import { Re_repairestimatesService } from '../generated/services/Re_repairestimatesService'
import { unwrap, withTimeout } from './dataverseOperation'
import { parsePricing, pricingAmounts } from './pricingContract'

export async function getSavedPricing(id: string, version: string) {
  const row = unwrap(await withTimeout(Re_repairestimatesService.get(id, {
    select: ['versionnumber', 're_calculationversion', 're_calculatedon',
      '_transactioncurrencyid_value', ...pricingAmounts],
  })))
  return parsePricing(row, version)
}
