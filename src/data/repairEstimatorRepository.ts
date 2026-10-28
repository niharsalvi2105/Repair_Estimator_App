import {
  Re_branchsService,
  Re_equipmentsService,
  Re_repairpackagesService,
  Re_repairestimatesService,
  Re_equipmenttypesService,
  Re_jobtypesService,
  Re_stateprovincesService,
  TransactioncurrenciesService,
} from '../generated'
import { unwrap, withTimeout } from './dataverseOperation'
import { buildBranchQuery, buildEstimateQuery, type EstimateQuery } from './estimateQuery'
import type { Re_repairestimates } from '../generated/models/Re_repairestimatesModel'
import type { Re_branchs } from '../generated/models/Re_branchsModel'
import type { Re_equipments } from '../generated/models/Re_equipmentsModel'
import type { Re_repairpackages } from '../generated/models/Re_repairpackagesModel'
import type { IGetAllOptions } from '../generated/models/CommonModels'

export type Branch = Pick<
  Re_branchs,
  | 're_branchid'
  | 're_branchname'
  | 're_branchnumber'
  | 're_market'
  | '_re_country_value'
  | '_re_currency_value'
  | '_re_stateprovince_value'
  | 're_defaultusetax'
  | 're_defaultfreight'
>

export type Equipment = Pick<
  Re_equipments,
  | 're_equipmentid'
  | 're_equipment'
  | 're_equipmentname'
  | 're_functionallocation'
  | 're_soldtoname'
  | 're_oem'
  | 're_equipmentage'
>

export type RepairPackage = Pick<
  Re_repairpackages,
  | 're_repairpackageid'
  | 're_packagenumber'
  | 're_packagenameen'
  | 're_packagenamefr'
  | 're_proposalscopeen'
  | 're_proposalscopefr'
  | 're_mechanichours'
  | 're_effectivefrom'
  | 're_effectiveto'
  | 're_iscustompackage'
  | 're_istimematerial'
>

export type ReferenceOption = { id: string; en: string; fr?: string }

export type DraftReferences = {
  states: { id: string; en: string; fr?: string; countryId: string; frenchRequired: boolean }[]
  currencies: { id: string; code: string }[]
}

export async function getDraftReferences(): Promise<DraftReferences> {
  const [states, currencies] = await Promise.all([
    withTimeout(Re_stateprovincesService.getAll({
      select: ['re_stateprovinceid', 're_nameen', 're_namefr', '_re_country_value', 're_frenchrequired'],
      filter: 'statecode eq 0', orderBy: ['re_nameen asc'], maxPageSize: 500,
    })),
    withTimeout(TransactioncurrenciesService.getAll({
      select: ['transactioncurrencyid', 'isocurrencycode'], filter: 'statecode eq 0', maxPageSize: 500,
    })),
  ])
  if (states.skipToken || currencies.skipToken) throw new Error('Location/currency reference paging exceeds the supported size.')
  return {
    states: unwrap(states).map((s) => ({ id: s.re_stateprovinceid, en: s.re_nameen, fr: s.re_namefr,
      countryId: s._re_country_value ?? '', frenchRequired: s.re_frenchrequired })),
    currencies: unwrap(currencies).map((c) => ({ id: c.transactioncurrencyid, code: c.isocurrencycode })),
  }
}

export async function getRequestReferences(): Promise<{
  equipmentTypes: ReferenceOption[]; jobTypes: ReferenceOption[]
}> {
  const [equipmentTypes, jobTypes] = await Promise.all([
    withTimeout(Re_equipmenttypesService.getAll({
      select: ['re_equipmenttypeid', 're_nameen', 're_namefr'],
      filter: 'statecode eq 0', orderBy: ['re_nameen asc'], maxPageSize: 500,
    })),
    withTimeout(Re_jobtypesService.getAll({
      select: ['re_jobtypeid', 're_jobtypeen', 're_jobtypefr'],
      filter: 'statecode eq 0', orderBy: ['re_jobtypeen asc'], maxPageSize: 500,
    })),
  ])
  const equipmentRecords = unwrap(equipmentTypes)
  const jobRecords = unwrap(jobTypes)
  if (equipmentTypes.skipToken || jobTypes.skipToken) {
    throw new Error('The reference list exceeds the supported page size. Reference-data paging must be configured.')
  }
  return {
    equipmentTypes: equipmentRecords.map((row) => ({ id: row.re_equipmenttypeid, en: row.re_nameen, fr: row.re_namefr })),
    jobTypes: jobRecords.map((row) => ({ id: row.re_jobtypeid, en: row.re_jobtypeen, fr: row.re_jobtypefr })),
  }
}

export async function getBranches(): Promise<Branch[]> {
  const records: Branch[] = []
  const seenTokens = new Set<string>()
  let skipToken: string | undefined
  do {
    const result = await withTimeout(Re_branchsService.getAll(buildBranchQuery(skipToken)))
    records.push(...unwrap(result))
    skipToken = result.skipToken
    if (skipToken) {
      if (seenTokens.has(skipToken)) throw new Error('Dataverse returned a repeated branch paging token.')
      seenTokens.add(skipToken)
    }
  } while (skipToken)
  return records
}

export async function searchEquipment(
  branchId: string,
  searchText: string,
): Promise<Equipment[]> {
  const escapedSearch = searchText.replaceAll("'", "''")
  const result = await withTimeout(Re_equipmentsService.getAll({
    select: [
      're_equipmentid',
      're_equipment',
      're_equipmentname',
      're_functionallocation',
      're_soldtoname',
      're_oem',
      're_equipmentage',
    ],
    filter: `statecode eq 0 and _re_branch_value eq ${branchId}${escapedSearch ? ` and (startswith(re_equipment,'${escapedSearch}') or startswith(re_equipmentname,'${escapedSearch}'))` : ''}`,
    orderBy: ['re_equipment asc'],
    top: 20,
    maxPageSize: 20,
  }))

  return unwrap(result)
}

export async function listPackages(branchCountryId: string): Promise<RepairPackage[]> {
  const records: RepairPackage[] = []
  const seenTokens = new Set<string>()
  let skipToken: string | undefined
  do {
    const result = await withTimeout(Re_repairpackagesService.getAll(buildPackageQuery(branchCountryId, skipToken)))
    records.push(...unwrap(result))
    skipToken = result.skipToken
    if (skipToken) {
      if (seenTokens.has(skipToken)) throw new Error('Dataverse returned a repeated package paging token.')
      seenTokens.add(skipToken)
    }
  } while (skipToken)

  const today = new Date().toISOString().slice(0, 10)
  return records.filter((repairPackage) => {
    const startsOn = repairPackage.re_effectivefrom.slice(0, 10)
    const endsOn = repairPackage.re_effectiveto?.slice(0, 10)
    return startsOn <= today && (!endsOn || endsOn >= today)
  })
}

function buildPackageQuery(branchCountryId: string, skipToken?: string): IGetAllOptions {
  return {
    select: [
      're_repairpackageid',
      're_packagenumber',
      're_packagenameen',
      're_packagenamefr',
      're_proposalscopeen',
      're_proposalscopefr',
      're_mechanichours',
      're_effectivefrom',
      're_effectiveto',
      're_iscustompackage',
      're_istimematerial',
    ],
    filter: `statecode eq 0 and (_re_country_value eq ${branchCountryId} or _re_country_value eq null)`,
    orderBy: ['re_packagenumber asc', 're_repairpackageid asc'],
    maxPageSize: 500,
    skipToken,
  }
}

export type EstimateSummary = Pick<Re_repairestimates,
  're_repairestimateid' | 're_name' | 're_estimatename' | 're_customername'
  | 're_buildingname' | 're_estimatestatus' | 'createdon'>

export async function listEstimates(options: EstimateQuery): Promise<{ records: EstimateSummary[]; skipToken?: string }> {
  const result = await withTimeout(Re_repairestimatesService.getAll(buildEstimateQuery(options)))
  return { records: unwrap(result), skipToken: result.skipToken }
}
