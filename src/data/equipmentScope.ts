import type { Re_plannergroups } from '../generated/models/Re_plannergroupsModel'

export type EquipmentScope = {
  branchIds: string[]
  plannerGroupIds: string[]
}

type PlannerGroup = Pick<
  Re_plannergroups,
  're_plannergroupid' | 're_subbranchcode' | 're_ismainbranch' | '_re_mainbranch_value'
>

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function requireGuid(value: string | undefined, field: string): string {
  if (!value || !guidPattern.test(value)) throw new Error(`Planner Group ${field} is missing or invalid.`)
  return value
}

export function buildEquipmentScope(
  branchId: string,
  branchNumber: string,
  matchingGroups: PlannerGroup[],
  groupsForParent: PlannerGroup[],
): EquipmentScope {
  if (!guidPattern.test(branchId)) throw new Error('Select a valid branch for equipment.')
  if (!branchNumber.trim()) throw new Error('The selected branch has no branch number for Planner Group matching.')

  const subBranchGroups = matchingGroups.filter((group) =>
    group.re_subbranchcode.trim() === branchNumber.trim() && !group.re_ismainbranch)
  if (subBranchGroups.length === 0) return { branchIds: [branchId], plannerGroupIds: [] }

  const parentIds = new Set(subBranchGroups.map((group) =>
    requireGuid(group._re_mainbranch_value, 'Main Branch lookup')))
  if (parentIds.size !== 1) throw new Error('Planner Group mapping is ambiguous for the selected branch.')

  const parentId = [...parentIds][0]
  const plannerGroupIds = new Set<string>()
  const selectedGroupIds = new Set(subBranchGroups.map((group) =>
    requireGuid(group.re_plannergroupid, 'record ID')))
  for (const group of groupsForParent) {
    if (!group.re_ismainbranch && group._re_mainbranch_value?.toLowerCase() === parentId.toLowerCase())
      plannerGroupIds.add(requireGuid(group.re_plannergroupid, 'record ID'))
  }
  if ([...selectedGroupIds].some((id) => !plannerGroupIds.has(id)))
    throw new Error('Planner Group records changed while resolving the selected branch.')

  return { branchIds: [...new Set([branchId, parentId])], plannerGroupIds: [...plannerGroupIds] }
}

export function buildEquipmentScopeFilter(scope: EquipmentScope): string {
  const branchIds = [...new Set(scope.branchIds)]
  const plannerGroupIds = [...new Set(scope.plannerGroupIds)]
  if (branchIds.some((id) => !guidPattern.test(id)) || plannerGroupIds.some((id) => !guidPattern.test(id)))
    throw new Error('Equipment scope contains an invalid Dataverse ID.')

  const filters = [
    ...branchIds.map((id) => `_re_branch_value eq ${id}`),
    ...plannerGroupIds.map((id) => `_re_plannergroup_value eq ${id}`),
  ]
  if (filters.length === 0) throw new Error('Equipment scope is empty.')
  return `(${filters.join(' or ')})`
}
