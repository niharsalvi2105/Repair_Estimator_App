import type { DraftLabor } from './draftContract'
import type { CostRate } from './packageCosts'

export const LABOR_COLUMNS = [
  { role: 126110000, time: 126110000 },
  { role: 126110000, time: 126110001 },
  { role: 126110001, time: 126110000 },
  { role: 126110001, time: 126110001 },
  { role: 126110002, time: 126110000 },
  { role: 126110002, time: 126110001 },
]
export type LaborGridRow = { key: string; lines: DraftLabor[] }

export function laborGridRows(lines: DraftLabor[]): LaborGridRow[] {
  const rows: LaborGridRow[] = []
  for (const line of lines) {
    const row = rows.find(row => row.lines[0].packageId === line.packageId &&
      (row.lines[0].equipmentNumber || '') === (line.equipmentNumber || '') &&
      !row.lines.some(existing => existing.role === line.role && existing.time === line.time))
    if (row) row.lines.push(line)
    else rows.push({ key: JSON.stringify([line.packageId, line.equipmentNumber || '',
      rows.filter(row => row.lines[0].packageId === line.packageId &&
        (row.lines[0].equipmentNumber || '') === (line.equipmentNumber || '')).length]), lines: [line] })
  }
  return rows
}

export function editLaborGridHours(lines: DraftLabor[], row: LaborGridRow, column: number, hours: number): DraftLabor[] {
  const slot = LABOR_COLUMNS[column]
  const existing = row.lines.find(line => line.role === slot.role && line.time === slot.time)
  const ids = new Set(row.lines.map(line => line.id))
  const updated = row.lines.filter(line => line.hours !== 0 || line === existing)
  if (existing) {
    const index = updated.findIndex(line => line.id === existing.id)
    updated[index] = { ...existing, hours }
  } else if (hours !== 0) {
    updated.push({ id: crypto.randomUUID(), packageId: row.lines[0].packageId,
      equipmentNumber: row.lines[0].equipmentNumber, ...slot, hours })
  }
  const nonzero = updated.filter(line => line.hours !== 0)
  const replacement = nonzero.length ? nonzero : [{ ...row.lines[0], hours: 0 }]
  const first = lines.findIndex(line => ids.has(line.id))
  return [...lines.slice(0, first), ...replacement, ...lines.slice(first).filter(line => !ids.has(line.id))]
}

export function laborGridCost(lines: DraftLabor[], rates: CostRate[]): number | undefined {
  let total = 0
  for (const line of lines) {
    if (!Number.isFinite(line.hours) || line.hours < 0 || line.hours > 100000) return undefined
    if (line.hours === 0) continue
    const matches = rates.filter(rate => rate.role === line.role && rate.time === line.time)
    const rate = line.rate ?? (matches.length === 1 ? matches[0].rate : undefined)
    if (rate == null || !Number.isFinite(rate) || rate < 0) return undefined
    const amount = line.hours * rate
    total += Math.round((amount + Number.EPSILON * Math.max(1, amount)) * 100) / 100
  }
  return total
}
