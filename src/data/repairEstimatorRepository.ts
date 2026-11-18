import { packageContextFilter } from './packageQuery'
import {
  Re_branchsService,
  Re_equipmentsService,
  Re_repairpackagesService,
  Re_repairestimatesService,
  Re_equipmenttypesService,
  Re_jobtypesService,
  Re_stateprovincesService,
  TransactioncurrenciesService,
  Re_laborratesService,
  Re_plannergroupsService,
} from '../generated'
import { unwrap, withTimeout } from './dataverseOperation'
import { createCustomerNameLoader } from './customerNames'
import { buildBranchQuery, buildEstimateQuery, type EstimateQuery } from './estimateQuery'
import type { Re_repairestimates } from '../generated/models/Re_repairestimatesModel'
import type { Re_branchs } from '../generated/models/Re_branchsModel'
import type { Re_equipments } from '../generated/models/Re_equipmentsModel'
import type { Re_repairpackages } from '../generated/models/Re_repairpackagesModel'
import type { IGetAllOptions } from '../generated/models/CommonModels'
import type { EquipmentSourceDetails } from './equipmentDisplay'
import { measureOperation } from './performance'
import { buildEquipmentScope, buildEquipmentScopeFilter, type EquipmentScope } from './equipmentScope'

export const getBranchCustomerNames = createCustomerNameLoader(Re_equipmentsService)
const equipmentScopeRequests = new Map<string, Promise<EquipmentScope>>()

async function getPlannerGroups(filter: string) {
  const records = []
  const seenTokens = new Set<string>()
  let skipToken: string | undefined
  do {
    const result = await withTimeout(Re_plannergroupsService.getAll({
      select: ['re_plannergroupid', 're_subbranchcode', 're_ismainbranch', '_re_mainbranch_value'],
      filter,
      orderBy: ['re_plannergroupid asc'],
      maxPageSize: 500,
      skipToken,
    }))
    records.push(...unwrap(result))
    skipToken = result.skipToken
    if (skipToken) {
      if (seenTokens.has(skipToken)) throw new Error('Dataverse returned a repeated Planner Group paging token.')
      seenTokens.add(skipToken)
    }
  } while (skipToken)
  return records
}

async function loadEquipmentScope(branchId: string): Promise<EquipmentScope> {
  const branch = unwrap(await withTimeout(Re_branchsService.get(branchId, { select: ['re_branchnumber'] })))
  if (!branch.re_branchnumber?.trim()) throw new Error('The selected branch has no branch number for Planner Group matching.')
  const escapedBranchNumber = branch.re_branchnumber.trim().replaceAll("'", "''")
  const matchingGroups = await getPlannerGroups(
    `statecode eq 0 and re_ismainbranch eq false and re_subbranchcode eq '${escapedBranchNumber}'`,
  )
  const selectedScope = buildEquipmentScope(branchId, branch.re_branchnumber, matchingGroups, matchingGroups)
  const parentId = selectedScope.branchIds.find((id) => id !== branchId)
  if (!parentId) return selectedScope

  const groupsForParent = await getPlannerGroups(
    `statecode eq 0 and re_ismainbranch eq false and _re_mainbranch_value eq ${parentId}`,
  )
  return buildEquipmentScope(branchId, branch.re_branchnumber, matchingGroups, groupsForParent)
}

function getEquipmentScope(branchId: string): Promise<EquipmentScope> {
  const cached = equipmentScopeRequests.get(branchId)
  if (cached) return cached
  const request = loadEquipmentScope(branchId)
  equipmentScopeRequests.set(branchId, request)
  void request.catch(() => {
    if (equipmentScopeRequests.get(branchId) === request) equipmentScopeRequests.delete(branchId)
  })
  return request
}

export async function getPackageCostRates(branchId: string) {
  const today = new Date().toISOString().slice(0, 10)
  const result = await withTimeout(Re_laborratesService.getAll({
    select: ['re_laborrole', 're_timecategory', 're_hourlycost'],
    filter: `statecode eq 0 and _re_branch_value eq ${branchId} and re_effectivefrom le ${today} and (re_effectiveto eq null or re_effectiveto ge ${today})`,
    top: 7, maxPageSize: 7,
  }))
  const rows = unwrap(result)
  if (result.skipToken || rows.length > 6) throw new Error('Branch labor cost rates are ambiguous.')
  return rows.map((row) => ({ role: row.re_laborrole, time: row.re_timecategory, rate: row.re_hourlycost }))
}

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

export type Equipment = EquipmentSourceDetails & Pick<
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
  | 're_materialmisctaxcost'
  | 're_materialbeforemarkup'
  | 're_effectivefrom'
  | 're_effectiveto'
  | 're_iscustompackage'
  | 're_istimematerial'
> & { equipmentNumbers?: string[] | null }

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
  return measureOperation('equipment-search', async () => {
    const scope = await getEquipmentScope(branchId)
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
        're_description',
        're_manufacturer',
        're_constructionyear',
      ],
      filter: `statecode eq 0 and ${buildEquipmentScopeFilter(scope)}${escapedSearch ? ` and (startswith(re_equipment,'${escapedSearch}') or startswith(re_equipmentname,'${escapedSearch}'))` : ''}`,
      orderBy: ['re_equipment asc'],
      top: 20,
      maxPageSize: 20,
    }))

    return unwrap(result)
  })
}

export async function findEquipmentByNumbers(branchId: string, numbers: string[]): Promise<Equipment[]> {
  if (numbers.length === 0) return []
  return measureOperation('equipment-details', async () => {
    const scope = await getEquipmentScope(branchId)
    const matches = numbers.map((number) => `re_equipment eq '${number.replaceAll("'", "''")}'`).join(' or ')
    const result = await withTimeout(Re_equipmentsService.getAll({
      select: [
        're_equipmentid',
        're_equipment',
        're_equipmentname',
        're_functionallocation',
        're_soldtoname',
        're_oem',
        're_equipmentage',
        're_description',
        're_manufacturer',
        're_constructionyear',
      ],
      filter: `statecode eq 0 and ${buildEquipmentScopeFilter(scope)} and (${matches})`,
      orderBy: ['re_equipment asc', 're_equipmentid asc'],
      maxPageSize: 500,
    }))
    return unwrap(result)
  })
}

export async function listPackages(branchCountryId: string, branchCurrencyId: string): Promise<RepairPackage[]> {
  const records: RepairPackage[] = []
  const seenTokens = new Set<string>()
  let skipToken: string | undefined
  do {
    const result = await withTimeout(Re_repairpackagesService.getAll(buildPackageQuery(branchCountryId, branchCurrencyId, skipToken)))
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

function buildPackageQuery(branchCountryId: string, branchCurrencyId: string, skipToken?: string): IGetAllOptions {
  return {
    select: [
      're_repairpackageid',
      're_packagenumber',
      're_packagenameen',
      're_packagenamefr',
      're_proposalscopeen',
      're_proposalscopefr',
      're_mechanichours',
      're_materialmisctaxcost',
      're_materialbeforemarkup',
      're_effectivefrom',
      're_effectiveto',
      're_iscustompackage',
      're_istimematerial',
    ],
    filter: packageContextFilter(branchCountryId, branchCurrencyId),
    orderBy: ['re_packagenumber asc', 're_repairpackageid asc'],
    maxPageSize: 500,
    skipToken,
  }
}

export type EstimateSummary = Pick<Re_repairestimates,
  're_repairestimateid' | 're_name' | 're_estimatename' | 're_customername'
  | 're_buildingname' | 're_estimatestatus' | 'createdon'> & { exportRequestId?: string }

export async function listEstimates(options: EstimateQuery): Promise<{ records: EstimateSummary[]; skipToken?: string }> {
  const result = await withTimeout(Re_repairestimatesService.getAll(buildEstimateQuery(options)))
  const records = unwrap(result).map(row => {
    const request = '_re_exportrequest_value' in row ? row._re_exportrequest_value : undefined
    if (request != null && (typeof request !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(request)))
      throw new Error('Invalid submission request reference in estimate list.')
    return { ...row, exportRequestId: typeof request === 'string' ? request : undefined }
  })
  return { records, skipToken: result.skipToken }
}
