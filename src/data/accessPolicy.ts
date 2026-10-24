export type AppRole = 'estimator' | 'admin'

export function isDevelopmentAdminOverride(development: boolean, setting: unknown): boolean {
  return development && setting === 'true'
}

export const APP_ROLE_NAMES = {
  estimator: 'Repair Estimator - Estimator',
  admin: 'Repair Estimator - Admin',
} as const

export function parseRoleResponse(response: unknown): Record<string, unknown>[] {
  const roles = typeof response === 'object' && response !== null && 'value' in response
    ? response.value
    : response
  if (!Array.isArray(roles)) {
    throw new Error('Dataverse returned an unexpected role response.')
  }
  return roles.map((role: unknown) => {
    if (typeof role !== 'object' || role === null
      || !('name' in role) || typeof role.name !== 'string') {
      throw new Error('Dataverse returned an unexpected role response.')
    }
    return role
  })
}

export function resolveAppRole(roles: readonly Record<string, unknown>[]): AppRole | null {
  if (roles.some((role) => role.name === APP_ROLE_NAMES.admin)) return 'admin'
  if (roles.some((role) => role.name === APP_ROLE_NAMES.estimator)) return 'estimator'
  return null
}

export function getEstimatePrivilegeNames(metadata: unknown): { read: string; create: string } {
  if (typeof metadata !== 'object' || metadata === null
    || !('Privileges' in metadata) || !Array.isArray(metadata.Privileges)) {
    throw new Error('Dataverse did not return the estimate table privilege metadata.')
  }
  const privileges: unknown[] = metadata.Privileges
  function findName(type: number, label: string): string {
    const matches = privileges.filter((entry) => typeof entry === 'object' && entry !== null
        && 'PrivilegeType' in entry && (entry.PrivilegeType === type || entry.PrivilegeType === label))
    const entry: unknown = matches[0]
    if (matches.length !== 1 || typeof entry !== 'object' || entry === null
      || !('Name' in entry) || typeof entry.Name !== 'string' || !entry.Name.trim()) {
      throw new Error(`Dataverse did not return a unique ${label} privilege for the estimate table.`)
    }
    return entry.Name
  }
  return { read: findName(2, 'Read'), create: findName(1, 'Create') }
}

export function hasPrivilege(response: Record<string, unknown>): boolean {
  if (!Array.isArray(response.RolePrivileges)) {
    throw new Error('Dataverse returned an unexpected privilege response.')
  }
  for (const privilege of response.RolePrivileges) {
    if (typeof privilege !== 'object' || privilege === null
      || !('PrivilegeId' in privilege) || typeof privilege.PrivilegeId !== 'string'
      || !privilege.PrivilegeId
      || !('Depth' in privilege)
      || ![0, 1, 2, 3, 'Basic', 'Local', 'Deep', 'Global'].includes(privilege.Depth)) {
      throw new Error('Dataverse returned an unexpected privilege entry.')
    }
  }
  return response.RolePrivileges.length > 0
}
