import type { IGetAllOptions } from '../generated/models/CommonModels'

export type Market = 126110000 | 126110001 | 126110002
export type EstimateQuery = { search: string; status: string; skipToken?: string; market?: Market }

export function buildBranchQuery(skipToken?: string): IGetAllOptions {
  return {
    select: ['re_branchid', 're_branchname', 're_branchnumber', 're_market', '_re_country_value',
      '_re_currency_value', '_re_stateprovince_value', 're_defaultusetax', 're_defaultfreight'],
    filter: 'statecode eq 0',
    orderBy: ['re_branchname asc', 're_branchid asc'],
    maxPageSize: 500,
    skipToken,
  }
}

export function buildEstimateQuery(options: EstimateQuery): IGetAllOptions {
  const filters = ['statecode eq 0']
  if (options.market !== undefined) {
    if (![126110000, 126110001, 126110002].includes(options.market)) {
      throw new Error('Unsupported estimate market filter.')
    }
    filters.push(`re_market eq ${options.market}`)
  }
  const search = options.search.trim().replaceAll("'", "''")
  if (search) {
    filters.push(`(startswith(re_name,'${search}') or startswith(re_customername,'${search}') or startswith(re_buildingname,'${search}'))`)
  }
  if (options.status) {
    if (!['126110000', '126110001', '126110002'].includes(options.status)) {
      throw new Error('Unsupported estimate status filter.')
    }
    filters.push(`re_estimatestatus eq ${options.status}`)
  }
  return {
    select: ['re_repairestimateid', 're_name', 're_estimatename', 're_customername',
      're_buildingname', 're_estimatestatus', 'createdon'],
    filter: filters.join(' and '),
    orderBy: ['createdon desc', 're_repairestimateid asc'],
    maxPageSize: 25,
    skipToken: options.skipToken,
  }
}
