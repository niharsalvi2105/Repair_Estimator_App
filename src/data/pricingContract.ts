export const pricingAmounts = [
  're_totaltruecost', 're_sellprice', 're_suggestedprice', 're_amincentive', 're_bdincentive',
  're_basetargetcmii', 're_recommendedcmii', 're_actualcmii', 're_cmiivariance',
] as const

export type PricingRecord = {
  versionnumber: number
  re_calculationversion?: string | null
  re_calculatedon?: string | null
  _transactioncurrencyid_value: string
} & Partial<Record<typeof pricingAmounts[number], number | null>>

export function parsePricing(value: unknown, version: string): PricingRecord {
  if (!value || typeof value !== 'object') throw new Error('Invalid pricing response.')
  const row = value as Partial<PricingRecord>
  if (!Number.isSafeInteger(row.versionnumber) || String(row.versionnumber) !== version)
    throw new Error('Pricing belongs to a different saved version. Reload the draft before reviewing pricing.')
  if (typeof row._transactioncurrencyid_value !== 'string' || !row._transactioncurrencyid_value
    || (row.re_calculationversion != null && typeof row.re_calculationversion !== 'string')
    || (row.re_calculatedon != null && (typeof row.re_calculatedon !== 'string'
      || !Number.isFinite(Date.parse(row.re_calculatedon))))
    || pricingAmounts.some((key) => row[key] != null && (typeof row[key] !== 'number' || !Number.isFinite(row[key]))))
    throw new Error('The pricing service returned incomplete or invalid values.')
  if (row.re_calculationversion && row.re_calculationversion !== 'unavailable'
    && (!row.re_calculatedon || row.re_totaltruecost == null || row.re_suggestedprice == null
      || row.re_recommendedcmii == null))
    throw new Error('The saved pricing calculation is incomplete. Reload or contact your administrator.')
  return row as PricingRecord
}
