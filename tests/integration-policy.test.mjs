import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveAppRole, parseRoleResponse, hasPrivilege, getEstimatePrivilegeNames, isDevelopmentAdminOverride, APP_ROLE_NAMES } from '../src/data/accessPolicy.ts'
import { buildBranchQuery, buildEstimateQuery } from '../src/data/estimateQuery.ts'
import { unwrap, withTimeout, DataverseError } from '../src/data/dataverseOperation.ts'

test('branch queries select actual columns, not generated formatted choice-label properties', () => {
  const query = buildBranchQuery('branch-page')
  assert.deepEqual(query.select, [
    're_branchid', 're_branchname', 're_branchnumber', 're_market', '_re_country_value',
    '_re_currency_value', '_re_stateprovince_value', 're_defaultusetax', 're_defaultfreight',
  ])
  assert.equal(query.select.includes('re_marketname'), false)
  assert.equal(query.top, undefined)
  assert.equal(query.maxPageSize, 500)
  assert.equal(query.skipToken, 'branch-page')
  assert.deepEqual(query.orderBy, ['re_branchname asc', 're_branchid asc'])
})

test('estimate privileges use exact metadata names, not constructed logical names', () => {
  for (const types of [[2, 1], ['Read', 'Create']]) {
    assert.deepEqual(getEstimatePrivilegeNames({ Privileges: [
      { PrivilegeType: types[0], Name: 'prvReadActualSchemaName' },
      { PrivilegeType: types[1], Name: 'prvCreateActualSchemaName' },
    ] }), { read: 'prvReadActualSchemaName', create: 'prvCreateActualSchemaName' })
  }
})

test('missing, duplicate or malformed privilege metadata fails without guessing a name', () => {
  for (const metadata of [undefined, {}, { Privileges: [] }, { Privileges: [null] },
    { Privileges: [{ PrivilegeType: 2, Name: '' }] },
    { Privileges: [{ PrivilegeType: 2, Name: 'a' }, { PrivilegeType: 2, Name: 'b' }] }]) {
    assert.throws(() => getEstimatePrivilegeNames(metadata), /privilege/)
  }
})

test('temporary admin override requires development mode and an explicit true string', () => {
  assert.equal(isDevelopmentAdminOverride(true, 'true'), true)
  assert.equal(isDevelopmentAdminOverride(false, 'true'), false)
  for (const setting of [undefined, '', 'false', 'TRUE', true]) {
    assert.equal(isDevelopmentAdminOverride(true, setting), false)
    assert.equal(isDevelopmentAdminOverride(false, setting), false)
  }
})

test('role lookup accepts raw arrays and the Dataverse OData collection envelope', () => {
  const roles = [{ name: APP_ROLE_NAMES.estimator, roleid: 'test-id' }]
  assert.deepEqual(parseRoleResponse(roles), roles)
  assert.deepEqual(parseRoleResponse({ '@odata.context': 'metadata', value: roles }), roles)
  assert.equal(resolveAppRole(parseRoleResponse({ value: roles })), 'estimator')
  assert.equal(resolveAppRole(parseRoleResponse({ value: [] })), null)
  assert.equal(resolveAppRole(parseRoleResponse([])), null)
})

test('malformed role responses fail explicitly, including malformed rows', () => {
  for (const response of [null, undefined, {}, { value: null }, { value: {} },
    [null], [1], [{}], [{ name: 1 }], { value: [null] }, { value: [{ name: 1 }] }]) {
    assert.throws(() => parseRoleResponse(response), /unexpected role response/)
  }
})

test('unassigned and unrelated administrator roles never grant app access', () => {
  for (const names of [[], ['Admin'], ['System Administrator'], ['Estimator'], ['repair estimator - admin']]) {
    assert.equal(resolveAppRole(names.map((name) => ({ name }))), null)
  }
})

test('only the dedicated estimator and admin roles are recognized; admin takes precedence', () => {
  assert.equal(resolveAppRole([{ name: APP_ROLE_NAMES.estimator }]), 'estimator')
  assert.equal(resolveAppRole([{ name: APP_ROLE_NAMES.admin }]), 'admin')
  assert.equal(resolveAppRole([{ name: APP_ROLE_NAMES.estimator }, { name: APP_ROLE_NAMES.admin }]), 'admin')
})

test('empty effective privileges deny access and Basic depth zero is valid', () => {
  assert.equal(hasPrivilege({ RolePrivileges: [] }), false)
  for (const Depth of [0, 1, 2, 3, 'Basic', 'Local', 'Deep', 'Global']) {
    assert.equal(hasPrivilege({ RolePrivileges: [{ PrivilegeId: 'privilege-id', Depth }] }), true)
  }
})

test('malformed privilege responses fail explicitly rather than grant permissions', () => {
  for (const response of [{}, { RolePrivileges: null }, { RolePrivileges: [{}] },
    { RolePrivileges: [{ PrivilegeId: 'id', Depth: -1 }] }]) {
    assert.throws(() => hasPrivilege(response), /unexpected privilege/)
  }
})

test('request queries select only summary fields and use bounded server paging', () => {
  const query = buildEstimateQuery({ search: '', status: '', skipToken: 'opaque-token' })
  assert.equal(query.maxPageSize, 25)
  assert.equal(query.skipToken, 'opaque-token')
  assert.equal(query.top, undefined)
  assert.equal(query.filter, 'statecode eq 0')
  assert.deepEqual(query.orderBy, ['createdon desc', 're_repairestimateid asc'])
  assert.ok(!query.select.includes('re_customeremail'))
  assert.ok(!query.select.includes('re_sellprice'))
  assert.ok(!query.select.includes('re_amincentive'))
})

test('request search escapes apostrophes and filters status on the server', () => {
  const query = buildEstimateQuery({ search: " O'Brien ", status: '126110000' })
  assert.match(query.filter, /startswith\(re_customername,'O''Brien'\)/)
  assert.match(query.filter, /and re_estimatestatus eq 126110000$/)
  assert.throws(() => buildEstimateQuery({ search: '', status: '0 or true' }), /Unsupported/)
})

test('header markets scope request queries on the server without losing other filters or paging', () => {
  for (const market of [126110000, 126110001, 126110002]) {
    const query = buildEstimateQuery({ search: "O'Brien", status: '126110000', market, skipToken: 'market-page' })
    assert.ok(query.filter.includes(`statecode eq 0 and re_market eq ${market} and (`))
    assert.match(query.filter, /startswith\(re_customername,'O''Brien'\)/)
    assert.match(query.filter, /and re_estimatestatus eq 126110000$/)
    assert.equal(query.skipToken, 'market-page')
    assert.equal(query.maxPageSize, 25)
  }
  for (const market of [0, '126110000 or true', null]) {
    assert.throws(() => buildEstimateQuery({ search: '', status: '', market }), /Unsupported estimate market/)
  }
})

test('operation errors preserve permission status and successful results preserve data', () => {
  assert.deepEqual(unwrap({ success: true, data: [{ id: 1 }] }), [{ id: 1 }])
  assert.throws(() => unwrap({ success: false, error: { message: 'Denied', status: 403 } }),
    (error) => error instanceof DataverseError && error.status === 403 && error.message === 'Denied')
  assert.throws(() => unwrap({ success: false }), /Dataverse request failed/)
})

test('host requests time out explicitly and do not turn failures into empty data', async () => {
  assert.equal(await withTimeout(Promise.resolve('ready'), 100), 'ready')
  await assert.rejects(withTimeout(Promise.reject(new Error('failure')), 100), /failure/)
  await assert.rejects(withTimeout(new Promise(() => {}), 5),
    (error) => error instanceof DataverseError && error.status === 408)
})
