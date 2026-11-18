import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEquipmentScope, buildEquipmentScopeFilter } from '../src/data/equipmentScope.ts'

const branchId = '11111111-1111-4111-8111-111111111111'
const parentId = '22222222-2222-4222-8222-222222222222'
const selectedGroupId = '33333333-3333-4333-8333-333333333333'
const siblingGroupId = '44444444-4444-4444-8444-444444444444'
const unrelatedGroupId = '55555555-5555-4555-8555-555555555555'

const group = (id, code, parent, isMain = false) => ({
  re_plannergroupid: id,
  re_subbranchcode: code,
  re_ismainbranch: isMain,
  _re_mainbranch_value: parent,
})

test('equipment scope includes the parent branch and all active subbranches in its Planner Group', () => {
  const matching = [group(selectedGroupId, 'SUB-1', parentId)]
  const family = [
    ...matching,
    group(siblingGroupId, 'SUB-2', parentId),
    group(unrelatedGroupId, 'OTHER', '66666666-6666-4666-8666-666666666666'),
    group('77777777-7777-4777-8777-777777777777', 'MAIN', parentId, true),
  ]
  const scope = buildEquipmentScope(branchId, 'SUB-1', matching, family)

  assert.deepEqual(scope.branchIds, [branchId, parentId])
  assert.deepEqual(new Set(scope.plannerGroupIds), new Set([selectedGroupId, siblingGroupId]))
  assert.equal(buildEquipmentScopeFilter(scope),
    `(_re_branch_value eq ${branchId} or _re_branch_value eq ${parentId} or ` +
    `_re_plannergroup_value eq ${selectedGroupId} or _re_plannergroup_value eq ${siblingGroupId})`)
})

test('equipment scope stays branch-only when no active Planner Group mapping exists', () => {
  const scope = buildEquipmentScope(branchId, 'BR-1', [], [])
  assert.deepEqual(scope, { branchIds: [branchId], plannerGroupIds: [] })
  assert.equal(buildEquipmentScopeFilter(scope), `(_re_branch_value eq ${branchId})`)
})

test('equipment scope rejects ambiguous or incomplete Planner Group mappings', () => {
  assert.throws(() => buildEquipmentScope(branchId, 'SUB-1', [
    group(selectedGroupId, 'SUB-1', parentId),
    group(siblingGroupId, 'SUB-1', unrelatedGroupId),
  ], []), /ambiguous/)
  assert.throws(() => buildEquipmentScope(branchId, 'SUB-1',
    [group(selectedGroupId, 'SUB-1', parentId)], []), /changed while resolving/)
  assert.throws(() => buildEquipmentScope(branchId, 'SUB-1',
    [group(selectedGroupId, 'SUB-1', undefined)], []), /Main Branch lookup/)
})
