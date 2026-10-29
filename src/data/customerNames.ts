import type { IOperationResult } from '@microsoft/power-apps/data'
import type { IGetAllOptions } from '../generated/models/CommonModels'
import { unwrap, withTimeout } from './dataverseOperation.ts'

type CustomerRow = { re_equipmentid: string; re_soldtoname?: string }
type Transport = { getAll: (options: IGetAllOptions) => Promise<IOperationResult<CustomerRow[]>> }

export function createCustomerNameLoader(transport: Transport) {
  return async function getBranchCustomerNames(branchId: string): Promise<string[]> {
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(branchId))
      throw new Error('A valid branch is required to load customer names.')
    const names = new Map<string, string>()
    const tokens = new Set<string>()
    let skipToken: string | undefined
    do {
      const result = await withTimeout(transport.getAll({
        select: ['re_equipmentid', 're_soldtoname'],
        filter: `statecode eq 0 and _re_branch_value eq ${branchId} and re_soldtoname ne null`,
        orderBy: ['re_soldtoname asc', 're_equipmentid asc'],
        maxPageSize: 500,
        skipToken,
      }))
      for (const row of unwrap(result)) {
        const name = row.re_soldtoname?.trim()
        if (name && !names.has(name.toLocaleLowerCase('en-US')))
          names.set(name.toLocaleLowerCase('en-US'), name)
      }
      skipToken = result.skipToken
      if (skipToken) {
        if (tokens.has(skipToken)) throw new Error('Dataverse returned a repeated customer-name paging token.')
        tokens.add(skipToken)
      }
    } while (skipToken)
    return [...names.values()].sort((a, b) => a.localeCompare(b))
  }
}
