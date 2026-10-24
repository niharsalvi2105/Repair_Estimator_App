import { useEffect, useRef, useState } from 'react'
import { Re_appuserpreferencesService } from './generated/services/Re_appuserpreferencesService'
import { createPreferenceRepository, type UserPreferences } from './data/userPreferences'
import type { AppSession } from './data/sessionRepository'

const repository = createPreferenceRepository(Re_appuserpreferencesService)
const defaults: UserPreferences = { language: 'en', locale: 'en-US', theme: 'system' }

export function useUserPreferences(session: AppSession | undefined) {
  const [value, setValue] = useState(defaults)
  const [loadedUser, setLoadedUser] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [unsaved, setUnsaved] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const pending = useRef<UserPreferences | undefined>(undefined)
  const saving = useRef(false)
  const userId = session?.userId
  const displayName = session?.displayName ?? ''
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void repository.loadOrCreate(userId, displayName).then((preferences) => {
      if (cancelled) return
      setValue(preferences)
      setLoadedUser(userId)
      setError('')
      setUnsaved(false)
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load user preferences.')
    })
    return () => { cancelled = true }
  }, [userId, displayName, attempt])

  async function save(next: UserPreferences) {
    if (!userId || loadedUser !== userId || saving.current) return
    saving.current = true
    setBusy(true)
    setError('')
    pending.current = next
    setUnsaved(true)
    setValue(next)
    try {
      await repository.save(userId, next)
      pending.current = undefined
      setUnsaved(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save user preferences.')
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  return {
    ...value,
    busy,
    ready: Boolean(userId && loadedUser === userId),
    error,
    unsaved,
    save,
    retry() {
      if (pending.current) void save(pending.current)
      else { setError(''); setAttempt((current) => current + 1) }
    },
  }
}
