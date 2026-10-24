import { getContext } from '@microsoft/power-apps/app'
import { RetrieveAadUserRolesService } from '../generated/services/RetrieveAadUserRolesService'
import { RetrieveUserPrivilegeByPrivilegeNameService } from '../generated/services/RetrieveUserPrivilegeByPrivilegeNameService'
import { getEstimatePrivilegeNames, hasPrivilege, isDevelopmentAdminOverride, parseRoleResponse, resolveAppRole, type AppRole } from './accessPolicy'
import { Re_repairestimatesService } from '../generated/services/Re_repairestimatesService'
import { unwrap, withTimeout } from './dataverseOperation'

export type AppSession = {
  displayName: string
  userId: string
  role: AppRole | null
  canReadEstimates: boolean
  canStartEstimate: boolean
  developmentAdminOverride: boolean
}

export async function loadSession(): Promise<AppSession> {
  const context = await withTimeout(getContext())
  const { objectId, systemUserId, fullName } = context.user
  if (!objectId || !systemUserId) {
    throw new Error('The Power Apps player did not provide a linked Dataverse user identity.')
  }
  const developmentAdminOverride = isDevelopmentAdminOverride(
    import.meta.env.DEV, import.meta.env.VITE_DEV_ADMIN_OVERRIDE,
  )
  const role = developmentAdminOverride ? 'admin' : resolveAppRole(
    parseRoleResponse(unwrap(await withTimeout(
      RetrieveAadUserRolesService.RetrieveAadUserRoles(objectId),
    ))),
  )
  if (!role) {
    return { displayName: fullName ?? '', userId: systemUserId, role, canReadEstimates: false, canStartEstimate: false, developmentAdminOverride }
  }

  const privilegeNames = getEstimatePrivilegeNames(unwrap(await withTimeout(
    Re_repairestimatesService.getMetadata({ metadata: ['Privileges'] }),
  )))
  const [read, create] = await Promise.all([
    withTimeout(RetrieveUserPrivilegeByPrivilegeNameService.RetrieveUserPrivilegeByPrivilegeName(
      systemUserId, privilegeNames.read, false,
    )),
    withTimeout(RetrieveUserPrivilegeByPrivilegeNameService.RetrieveUserPrivilegeByPrivilegeName(
      systemUserId, privilegeNames.create, false,
    )),
  ])
  const canReadEstimates = hasPrivilege(unwrap(read))
  return {
    displayName: fullName ?? '',
    userId: systemUserId,
    role,
    developmentAdminOverride,
    canReadEstimates,
    canStartEstimate: canReadEstimates && hasPrivilege(unwrap(create)),
  }
}
