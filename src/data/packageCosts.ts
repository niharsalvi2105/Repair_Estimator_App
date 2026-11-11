import type { RepairPackage } from './repairEstimatorRepository'
import type { DraftLabor, DraftMaterial } from './draftContract'
import { materialEntryError } from './customMaterialCosts.ts'

export type CostRate = { role: number; time: number; rate: number }
type CostPackage = Pick<RepairPackage, 're_mechanichours' | 're_materialmisctaxcost' | 're_materialbeforemarkup' | 're_iscustompackage' | 're_repairpackageid'>

function rateFor(rates: CostRate[], role: number, category: number) {
  const matches = rates.filter((r) => r.role === role && r.time === category)
  if (matches.length !== 1 || !Number.isFinite(matches[0].rate) || matches[0].rate < 0)
    throw new Error('Branch labor cost rate is missing or ambiguous.')
  return matches[0].rate
}

export function packageCost(hours: number, material: number, quantity: number, rate: number, tax: number, freight: number) {
  if (![hours, material, quantity, rate, tax, freight].every(Number.isFinite)
    || hours < 0 || material < 0 || quantity < 1 || rate < 0 || tax < 0 || tax > 100 || freight < 0 || freight > 100)
    throw new Error('Package cost inputs are missing or invalid.')
  const labor = hours * quantity * rate
  const materialTotal = material * quantity
  return { hours: hours * quantity, labor, material: materialTotal, total: labor + materialTotal * (1 + tax / 100 + freight / 100) }
}

export function calculateAdditionalCost(hours: number, material: number, miscellaneous: number,
  rates: CostRate[], time: number, tax: number, freight: number) {
  if (![hours, material, miscellaneous].every(value => Number.isFinite(value) && value >= 0))
    throw new Error('Additional cost inputs are missing or invalid.')
  const rate = rateFor(rates, 126110000, time)
  const cost = packageCost(hours, material + miscellaneous, 1, rate, tax, freight)
  if (!Number.isFinite(cost.total)) throw new Error('Additional cost total is invalid.')
  return { ...cost, rate, material, miscellaneous, tax, freight,
    taxAmount: (material + miscellaneous) * tax / 100,
    freightAmount: (material + miscellaneous) * freight / 100 }
}

function packageMaterialRates(p: CostPackage, tax: number, freight: number, materials: DraftMaterial[]) {
  const packagePriced = p.re_iscustompackage && materials.some((m) =>
    m.packageId === p.re_repairpackageid && m.pricingSource === 'package')
  if (packagePriced && (p.re_materialbeforemarkup == null || !Number.isFinite(p.re_materialbeforemarkup) || p.re_materialbeforemarkup < 0))
    throw new Error('Package Material Before Markup is missing or invalid.')
  return {
    material: packagePriced ? p.re_materialbeforemarkup ?? NaN : p.re_materialmisctaxcost ?? NaN,
    tax: p.re_iscustompackage ? packagePriced ? 0 : tax : 5,
    freight: p.re_iscustompackage ? packagePriced ? 0 : freight : 14,
    packagePriced,
  }
}

function predefinedPackageCost(p: CostPackage, quantity: number, rate: number, tax: number, freight: number, materials: DraftMaterial[]) {
  const applied = packageMaterialRates(p, tax, freight, materials)
  return packageCost(p.re_mechanichours ?? NaN, applied.material, quantity, rate, applied.tax, applied.freight)
}

export function calculatePackageUnitCost(p: CostPackage, rates: CostRate[], time: number, tax: number, freight: number, materials: DraftMaterial[]) {
  const rate = rateFor(rates, 126110000, time)
  const applied = packageMaterialRates(p, tax, freight, materials)
  const cost = packageCost(p.re_mechanichours ?? NaN, applied.material, 1, rate, applied.tax, applied.freight)
  return { ...cost, rate, tax: applied.tax, freight: applied.freight,
    taxAmount: cost.material * applied.tax / 100, freightAmount: cost.material * applied.freight / 100,
    packagePriced: applied.packagePriced }
}

export function calculatePackageCost(p: CostPackage,
  quantity: number, rates: CostRate[], time: number, tax: number, freight: number, labor: DraftLabor[], materials: DraftMaterial[]) {
  const rate = rateFor(rates, 126110000, time)
  if (!p.re_iscustompackage)
    return { ...predefinedPackageCost(p, quantity, rate, tax, freight, materials), rate }
  const lines = labor.filter((l) => l.packageId === p.re_repairpackageid)
  const parts = materials.filter((m) => m.packageId === p.re_repairpackageid)
  const packagePriced = parts.some((m) => m.pricingSource === 'package')
  if (!lines.length || !parts.length || lines.some((l) => !(l.hours > 0) || !Number.isFinite(l.hours))
    || parts.some((m) => materialEntryError(m, 'en') || !m.description.trim() || !(m.quantity > 0) ||
      (m.pricingSource === 'package' ? m.unitCost !== 0 || m.partType !== 'kone' : !(m.unitCost > 0))
      || !Number.isFinite(m.quantity) || !Number.isFinite(m.unitCost)))
    throw new Error('Complete the CSTM labor and material entries.')
  const laborCost = lines.reduce((sum, l) => sum + l.hours * (l.rate ?? rateFor(rates, l.role, l.time)), 0)
  if (!Number.isFinite(laborCost) || laborCost < 0) throw new Error('Custom labor cost rate is invalid.')
  const material = parts.reduce((sum, m) => sum + m.quantity * m.unitCost, 0)
  const predefined = predefinedPackageCost(p, quantity, rate, tax, freight, materials)
  const adjusted = packageCost(0, material, 1, 0, tax, freight)
  return { hours: predefined.hours + lines.reduce((sum, l) => sum + l.hours, 0), rate,
    labor: predefined.labor + laborCost, material: predefined.material + material, total: predefined.total + laborCost + adjusted.total,
    ...(packagePriced ? { koneFinal: packageCost(0, p.re_materialmisctaxcost ?? NaN, quantity, 0, 0, 0).total } : {}) }
}

export function calculateEquipmentPackageCost(p: CostPackage, quantity: number, rates: CostRate[], time: number,
  tax: number, freight: number, labor: DraftLabor[], materials: DraftMaterial[], equipmentNumber?: string) {
  const unit = calculatePackageUnitCost(p, rates, time, tax, freight, materials)
  if (!p.re_iscustompackage) return unit
  const total = calculatePackageCost(p, quantity, rates, time, tax, freight, labor, materials)
  if (equipmentNumber != null) {
    const share = (line: { equipmentNumber?: string | null }) =>
      !line.equipmentNumber ? 1 / quantity : line.equipmentNumber === equipmentNumber ? 1 : 0
    const lines = labor.filter(line => line.packageId === p.re_repairpackageid)
    const parts = materials.filter(line => line.packageId === p.re_repairpackageid)
    const hours = unit.hours + lines.reduce((sum, line) => sum + line.hours * share(line), 0)
    const laborCost = unit.labor + lines.reduce((sum, line) =>
      sum + line.hours * (line.rate ?? rateFor(rates, line.role, line.time)) * share(line), 0)
    const material = parts.reduce((sum, line) => sum + line.quantity * line.unitCost * share(line), 0)
    const taxAmount = unit.taxAmount + material * tax / 100
    const freightAmount = unit.freightAmount + material * freight / 100
    return { ...unit, hours, labor: laborCost, material: unit.material + material,
      rate: hours > 0 ? laborCost / hours : unit.rate,
      tax: material > 0 ? tax : unit.tax, freight: material > 0 ? freight : unit.freight,
      taxAmount, freightAmount, total: laborCost + unit.material + material + taxAmount + freightAmount }
  }
  const customMaterial = materials.filter(m => m.packageId === p.re_repairpackageid)
    .reduce((sum, m) => sum + m.quantity * m.unitCost, 0)
  return {
    ...unit,
    hours: total.hours / quantity,
    labor: total.labor / quantity,
    material: total.material / quantity,
    total: total.total / quantity,
    rate: total.hours > 0 ? total.labor / total.hours : unit.rate,
    tax: customMaterial > 0 ? tax : unit.tax,
    freight: customMaterial > 0 ? freight : unit.freight,
    taxAmount: unit.taxAmount + customMaterial * tax / 100 / quantity,
    freightAmount: unit.freightAmount + customMaterial * freight / 100 / quantity,
  }
}
