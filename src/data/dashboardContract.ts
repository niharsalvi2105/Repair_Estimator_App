import type { Market } from './estimateQuery'

export type DashboardRecord = {
  mode: 'dashboard'; ownerId: string | null; market: Market; period: 'all-time'; generatedAt: string
  total: number; marginCount: number; averageCmii: number | null
  statuses: { status: number; count: number }[]
  jobTypes: { id: string | null; en: string | null; fr: string | null; count: number }[]
}

export function parseDashboard(value: unknown, market: Market, owner: string | null): DashboardRecord {
  const invalid = () => { throw new Error('Invalid dashboard response. Verify the updated Draft plug-in is deployed, then refresh.') }
  if (!value || typeof value !== 'object') return invalid()
  const row = value as Partial<DashboardRecord>
  const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
  const label = (v: unknown) => v === null || typeof v === 'string'
  if (row.mode !== 'dashboard'
    || (owner === null ? row.ownerId !== null
      : typeof row.ownerId !== 'string' || row.ownerId.toLowerCase() !== owner.toLowerCase())
    || row.market !== market || row.period !== 'all-time'
    || typeof row.generatedAt !== 'string' || !Number.isFinite(Date.parse(row.generatedAt))
    || !count(row.total) || !count(row.marginCount) || row.marginCount > row.total
    || (row.marginCount === 0 ? row.averageCmii !== null
      : typeof row.averageCmii !== 'number' || !Number.isFinite(row.averageCmii))
    || !Array.isArray(row.statuses) || !Array.isArray(row.jobTypes)) return invalid()
  if (row.statuses.some((s) => !s || ![126110000, 126110001, 126110002].includes(s.status) || !count(s.count))
    || new Set(row.statuses.map((s) => s.status)).size !== row.statuses.length
    || row.statuses.reduce((sum, s) => sum + s.count, 0) !== row.total
    || row.jobTypes.some((s) => !s || !count(s.count) || !label(s.id) || !label(s.en) || !label(s.fr)
      || (s.id != null && (!s.id || !s.en?.trim())))
    || new Set(row.jobTypes.map((s) => s.id)).size !== row.jobTypes.length
    || row.jobTypes.reduce((sum, s) => sum + s.count, 0) !== row.total) return invalid()
  return row as DashboardRecord
}
