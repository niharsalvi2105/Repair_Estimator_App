import type { Re_appuserpreferences, Re_appuserpreferencesBase } from '../generated/models/Re_appuserpreferencesModel'
import type { IGetAllOptions } from '../generated/models/CommonModels'
import type { IOperationResult } from '@microsoft/power-apps/data'
import { unwrap, withTimeout } from './dataverseOperation.ts'

export type UserPreferences = {
  language: 'en' | 'fr'
  locale: string
  theme: 'system' | 'dark' | 'light'
}
type Write = Omit<Re_appuserpreferencesBase, 're_appuserpreferenceid'>
type Transport = {
  getAll: (options: IGetAllOptions) => Promise<IOperationResult<Re_appuserpreferences[]>>
  create: (record: Write) => Promise<IOperationResult<Re_appuserpreferences>>
  update: (id: string, fields: Partial<Write>) => Promise<IOperationResult<Re_appuserpreferences>>
}

export function preferenceFields(value: UserPreferences) {
  return {
    re_preferredlanguage: value.language === 'fr' ? 126110001 as const : 126110000 as const,
    re_preferredlocale: value.locale,
    re_preferredtheme: value.theme === 'dark' ? 126110001 as const : value.theme === 'light' ? 126110002 as const : 126110000 as const,
  }
}

export function parsePreferences(row: Re_appuserpreferences): UserPreferences {
  if (row.re_preferredlanguage !== 126110000 && row.re_preferredlanguage !== 126110001) {
    throw new Error('The saved UI language is not supported.')
  }
  if (row.re_preferredtheme != null && ![126110000, 126110001, 126110002].includes(row.re_preferredtheme)) {
    throw new Error('The saved theme is not supported.')
  }
  const language = row.re_preferredlanguage === 126110001 ? 'fr' : 'en'
  return {
    language,
    locale: row.re_preferredlocale || (language === 'fr' ? 'fr-CA' : 'en-US'),
    theme: row.re_preferredtheme === 126110001 ? 'dark' : row.re_preferredtheme === 126110002 ? 'light' : 'system',
  }
}

export function createPreferenceRepository(transport: Transport) {
  const initializing = new Map<string, Promise<UserPreferences>>()
  function validateUser(userId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      throw new Error('A valid signed-in Dataverse user ID is required for preferences.')
    }
  }
  async function find(userId: string) {
    const result = await withTimeout(transport.getAll({
      select: ['re_appuserpreferenceid', 're_name', 're_preferredlanguage', 're_preferredlocale', 're_preferredtheme', 'statecode'],
      filter: `_re_user_value eq ${userId}`,
      top: 2,
      maxPageSize: 2,
    }))
    const rows = unwrap(result)
    if (rows.length > 1 || result.skipToken) throw new Error('Multiple preference records exist for this user.')
    if (rows[0]?.statecode !== undefined && rows[0].statecode !== 0) throw new Error('Your preference record is inactive. Contact an administrator.')
    return rows[0]
  }
  async function initialize(userId: string, displayName: string): Promise<UserPreferences> {
    const row = await find(userId)
    if (row) {
      const preferences = parsePreferences(row)
      if (!row.re_name || !row.re_preferredlocale || row.re_preferredtheme == null) {
        unwrap(await withTimeout(transport.update(row.re_appuserpreferenceid, {
          re_name: row.re_name || (displayName || userId).slice(0, 200),
          ...preferenceFields(preferences),
        })))
      }
      return preferences
    }
    const defaults: UserPreferences = { language: 'en', locale: 'en-US', theme: 'system' }
    unwrap(await withTimeout(transport.create({
      re_name: (displayName || userId).slice(0, 200),
      're_User@odata.bind': `/systemusers(${userId})`,
      statecode: 0,
      ...preferenceFields(defaults),
    })))
    return defaults
  }
  return {
    loadOrCreate(userId: string, displayName: string) {
      validateUser(userId)
      const pending = initializing.get(userId)
      if (pending) return pending
      const request = initialize(userId, displayName).finally(() => initializing.delete(userId))
      initializing.set(userId, request)
      return request
    },
    async save(userId: string, value: UserPreferences) {
      validateUser(userId)
      const row = await find(userId)
      if (!row) throw new Error('Your preference record no longer exists. Reload preferences before saving.')
      unwrap(await withTimeout(transport.update(row.re_appuserpreferenceid, preferenceFields(value))))
    },
  }
}
