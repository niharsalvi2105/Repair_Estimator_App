import type { PricingRecord } from './pricingContract'

export function pricingComposition(row: PricingRecord) {
  const amounts = [row.re_packageestimatedcost, row.re_customlaborcost,
    row.re_custommaterialcost, row.re_totaladditionalcost, row.re_totaltruecost]
  if (amounts.some((amount) => amount == null || !Number.isFinite(amount) || amount < 0)) return null
  const [packages, labor, material, additional, total] = amounts.map((amount) => Math.round(amount! * 100))
  // Additional costs already include custom labor and material. Do not count them twice.
  const other = additional - labor - material
  if (other < 0 || Math.abs(packages + additional - total) > 1) return null
  const sum = packages + additional
  return [packages, labor, material, other].map((cents) => ({
    amount: cents / 100, share: sum > 0 ? cents / sum : 0,
  }))
}

export function cmiiGaugeShare(actual: number | null | undefined) {
  return actual == null || !Number.isFinite(actual) ? null : Math.max(0, Math.min(1, actual))
}
