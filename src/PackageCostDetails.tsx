import type { RepairPackage } from './data/repairEstimatorRepository'
import type { DraftLabor, DraftMaterial } from './data/draftContract'
import { calculatePackageCost, packageCost, type CostRate } from './data/packageCosts'

export function PackageCostDetails({ repairPackage, quantity, rates, time, tax, freight, labor, materials, language, currency }: {
  repairPackage: Pick<RepairPackage, 're_mechanichours' | 're_materialmisctaxcost' | 're_iscustompackage' | 're_repairpackageid'>; quantity: number; rates: CostRate[]; time: number
  tax: number; freight: number; labor: DraftLabor[]; materials: DraftMaterial[]; language: 'en' | 'fr'; currency?: string
}) {
  const fr = language === 'fr'
  let cost: ReturnType<typeof calculatePackageCost>
  try { cost = calculatePackageCost(repairPackage, quantity, rates, time, 0, 0, labor, materials) }
  catch (reason) { return <p className="package-cost-status" role="status">{fr ? 'Aperçu indisponible' : 'Preview unavailable'}: {reason instanceof Error ? reason.message : String(reason)}</p> }
  const number = (value: number) => value.toLocaleString(fr ? 'fr-CA' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const money = (value: number) => `${number(value)}${currency ? ` ${currency}` : ''}`
  let total: string
  let totalUnavailable = false
  try { total = money(cost.labor + packageCost(0, cost.material, 1, 0, tax, freight).total) }
  catch {
    totalUnavailable = true
    total = fr ? 'Saisissez une taxe et un fret valides dans Coûts et portée.' : 'Enter valid tax and freight in Costs & scope.'
  }
  return <dl className="package-cost-details">
    <dt>{fr ? 'Heures de main-d’œuvre' : 'Labor hours required'}</dt><dd>{number(cost.hours)}</dd>
    <dt>{fr ? 'Taux de coût mécanicien' : 'Mechanic labor cost rate'}</dt><dd>{money(cost.rate)}</dd>
    <dt>{fr ? 'Coût de main-d’œuvre' : 'Package labor cost'}</dt><dd>{money(cost.labor)}</dd>
    <dt>{fr ? 'Matériaux (avant taxe et fret)' : 'Material (before tax and freight)'}</dt><dd>{money(cost.material)}</dd>
    <dt className={`package-cost-total${totalUnavailable ? ' package-cost-pending-label' : ''}`}>{fr ? 'Coût estimé du forfait' : 'Package estimated cost'}</dt>
    <dd className={totalUnavailable ? 'package-cost-pending' : 'package-cost-total'}>{total}</dd>
  </dl>
}
