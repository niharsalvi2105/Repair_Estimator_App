import type { RepairPackage } from './repairEstimatorRepository'
import type { DraftLabor, DraftMaterial } from './draftContract'

export type CostRate = { role: number; time: number; rate: number }

export function packageCost(hours: number, material: number, quantity: number, rate: number, tax: number, freight: number) {
  if (![hours, material, quantity, rate, tax, freight].every(Number.isFinite)
    || hours < 0 || material < 0 || quantity < 1 || rate < 0 || tax < 0 || tax > 100 || freight < 0 || freight > 100)
    throw new Error('Package cost inputs are missing or invalid.')
  const labor = hours * quantity * rate
  const materialTotal = material * quantity
  return { hours: hours * quantity, labor, material: materialTotal, total: labor + materialTotal * (1 + tax / 100 + freight / 100) }
}

export function calculatePackageCost(p: Pick<RepairPackage, 're_mechanichours' | 're_materialmisctaxcost' | 're_iscustompackage' | 're_repairpackageid'>,
  quantity: number, rates: CostRate[], time: number, tax: number, freight: number, labor: DraftLabor[], materials: DraftMaterial[]) {
  const rateFor = (role: number, category: number) => {
    const matches = rates.filter((r) => r.role === role && r.time === category)
    if (matches.length !== 1 || !Number.isFinite(matches[0].rate) || matches[0].rate < 0)
      throw new Error('Branch labor cost rate is missing or ambiguous.')
    return matches[0].rate
  }
  const rate = rateFor(126110000, time)
  if (!p.re_iscustompackage)
    return { ...packageCost(p.re_mechanichours ?? NaN, p.re_materialmisctaxcost ?? NaN, quantity, rate, 5, 14), rate }
  const lines = labor.filter((l) => l.packageId === p.re_repairpackageid)
  const parts = materials.filter((m) => m.packageId === p.re_repairpackageid)
  if (!lines.length || !parts.length || lines.some((l) => !(l.hours > 0) || !Number.isFinite(l.hours))
    || parts.some((m) => !m.description.trim() || !(m.quantity > 0) || !(m.unitCost > 0)
      || !Number.isFinite(m.quantity) || !Number.isFinite(m.unitCost)))
    throw new Error('Complete the CSTM labor and material entries.')
  const laborCost = lines.reduce((sum, l) => sum + l.hours * (l.rate ?? rateFor(l.role, l.time)), 0)
  if (!Number.isFinite(laborCost) || laborCost < 0) throw new Error('Custom labor cost rate is invalid.')
  const material = parts.reduce((sum, m) => sum + m.quantity * m.unitCost, 0)
  const predefined = packageCost(p.re_mechanichours ?? NaN, p.re_materialmisctaxcost ?? NaN, quantity, rate, tax, freight)
  const adjusted = packageCost(0, material, 1, 0, tax, freight)
  return { hours: predefined.hours + lines.reduce((sum, l) => sum + l.hours, 0), rate,
    labor: predefined.labor + laborCost, material: predefined.material + material, total: predefined.total + laborCost + adjusted.total }
}
