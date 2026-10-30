import type { IOperationResult } from '@microsoft/power-apps/data'

export class DataverseError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'DataverseError'
    this.status = status
  }
}

export function requestReuseErrorMessage(reason: unknown, feature: 'clone' | 'presets', language: 'en' | 'fr'): string {
  const detail = reason instanceof Error ? reason.message : String(reason)
  let serverMessage = detail
  if (detail.trim().startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(detail)
      if (parsed && typeof parsed === 'object' && 'error' in parsed &&
        parsed.error && typeof parsed.error === 'object' && 'message' in parsed.error &&
        typeof parsed.error.message === 'string') serverMessage = parsed.error.message
    } catch {
      // SDK errors can contain plain text or incomplete JSON; retain the original diagnostic.
    }
  }
  if (!serverMessage.includes('Unsupported draft operation.')) return detail
  const operation = feature === 'clone' ? 'clonesource' : 'presetlist / presetsave / presetdelete'
  if (language === 'fr')
    return `Le serveur Dataverse déployé ne prend pas encore en charge cette fonctionnalité (${operation}). ` +
      'Un administrateur doit mettre à jour l’assembly existant RepairEstimator.Drafts associé à re_DraftEstimate, ' +
      (feature === 'presets' ? 'puis déployer et publier la table privée re_opportunitypreset et ses autorisations. ' : 'puis recharger l’application. ') +
      'Aucune copie ni modification n’a été effectuée par cette opération refusée. Détail serveur : Unsupported draft operation.'
  return `The deployed Dataverse backend does not support this feature yet (${operation}). ` +
    'An administrator must update the existing RepairEstimator.Drafts assembly linked to re_DraftEstimate, ' +
    (feature === 'presets' ? 'then deploy and publish the private re_opportunitypreset table and its permissions. ' : 'then reload the app. ') +
    'This rejected operation did not create a copy or change any data. Server detail: Unsupported draft operation.'
}

export function unwrap<T>(result: IOperationResult<T>): T {
  if (!result.success) {
    const error = result.error
    throw new DataverseError(
      error?.message ?? 'The Dataverse request failed.',
      error && 'status' in error ? error.status : undefined,
    )
  }
  return result.data
}

export async function withTimeout<T>(request: Promise<T>, milliseconds = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new DataverseError(
          'The Power Apps request timed out. Open this app in the authenticated Power Apps player and retry.',
          408,
        )), milliseconds)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
