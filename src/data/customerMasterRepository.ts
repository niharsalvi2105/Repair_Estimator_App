import { Re_DraftEstimateService } from '../generated/services/Re_DraftEstimateService'
import { unwrap, withTimeout } from './dataverseOperation'
import {
  parseAccountMasterOptions, parseContactMasterOptions, parseCustomerDefaults, type AccountMasterOption, type ContactMasterOption,
} from './customerMasterContract'
import type { Market } from './estimateQuery'
import { measureOperation } from './performance'

export { parseAccountMasterOptions, parseContactMasterOptions }
export type { AccountMasterOption, ContactMasterOption }

async function search(input: Record<string, string | number>) {
  const response = unwrap(await withTimeout(
    Re_DraftEstimateService.re_DraftEstimate(JSON.stringify(input)), 30000,
  ))
  if (typeof response.ResultJson !== 'string') throw new Error('Customer master search returned an invalid response.')
  return JSON.parse(response.ResultJson) as unknown
}

export async function searchAccountMasters(market: Market, text: string): Promise<AccountMasterOption[]> {
  return measureOperation('account-search', async () =>
    parseAccountMasterOptions(await search({ mode: 'accountsearch', market, search: text })))
}

export async function searchContactMasters(accountId: string, text: string): Promise<ContactMasterOption[]> {
  return measureOperation('contact-search', async () =>
    parseContactMasterOptions(await search({ mode: 'contactsearch', accountId, search: text })))
}

export async function getCustomerDefaults(accountId: string, branchId: string, market: Market) {
  return measureOperation('customer-defaults', async () =>
    parseCustomerDefaults(await search({ mode: 'contactsearch', accountId, branchId, market, search: '' })))
}
