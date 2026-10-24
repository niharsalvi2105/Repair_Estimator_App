import type { IOperationResult } from '@microsoft/power-apps/data'

export class DataverseError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'DataverseError'
    this.status = status
  }
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
