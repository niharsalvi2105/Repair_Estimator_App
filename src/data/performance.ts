type Operation =
  | 'session-startup'
  | 'power-apps-request'
  | 'account-search'
  | 'contact-search'
  | 'customer-defaults'
  | 'equipment-search'
  | 'equipment-details'
  | 'saved-pricing'
  | 'draft-save'
  | 'draft-submit'
  | 'draft-load'
  | 'draft-clonesource'

export async function measureOperation<T>(operation: Operation, run: () => Promise<T>): Promise<T> {
  const start = performance.now()
  let outcome = 'failed'
  try {
    const result = await run()
    outcome = 'completed'
    return result
  } finally {
    const name = `repair-estimator:${operation}`
    if (performance.getEntriesByName(name, 'measure').length >= 100) performance.clearMeasures(name)
    performance.measure(name, { start, end: performance.now(), detail: { outcome } })
  }
}
