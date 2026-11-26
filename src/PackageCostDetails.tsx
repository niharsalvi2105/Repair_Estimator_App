import type { RepairPackage } from './data/repairEstimatorRepository'
import type { DraftLabor, DraftMaterial } from './data/draftContract'
import { calculatePackageCost, type CostRate } from './data/packageCosts'

export function PackageCostDetails({ repairPackage, quantity, rates, time, tax, freight, labor, materials, language, currency }: {
  repairPackage: Pick<RepairPackage, 're_mechanichours' | 're_materialmisctaxcost' | 're_materialbeforemarkup' | 're_iscustompackage' | 're_repairpackageid'>; quantity: number; rates: CostRate[]; time: number
  tax: number; freight: number; labor: DraftLabor[]; materials: DraftMaterial[]; language: 'en' | 'fr'; currency?: string
}) {
  const fr = language === 'fr'
  const number = (value: number) => value.toLocaleString(fr ? 'fr-CA' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const money = (value: number) => `${number(value)}${currency ? ` ${currency}` : ''}`
  const equipmentDetails = <>
    <dt>{fr ? 'Nombre d’équipements' : 'Number of equipment'}</dt>
    <dd>{quantity.toLocaleString(fr ? 'fr-CA' : 'en-US')}</dd>
  </>
  let cost: ReturnType<typeof calculatePackageCost>
  try { cost = calculatePackageCost(repairPackage, quantity, rates, time, 0, 0, labor, materials) }
  catch (reason) {
    return <>
      <dl className="package-cost-details">{equipmentDetails}</dl>
      <p className="package-cost-status" role="status">{fr ? 'Aperçu indisponible' : 'Preview unavailable'}: {reason instanceof Error ? reason.message : String(reason)}</p>
    </>
  }
  let total: string
  let totalUnavailable = false
  try { total = money(calculatePackageCost(repairPackage, quantity, rates, time, tax, freight, labor, materials).total) }
  catch {
    totalUnavailable = true
    total = fr ? 'Saisissez une taxe et un fret valides dans Tarification et marge.' : 'Enter valid tax and freight in Pricing & margin.'
  }
  return <dl className="package-cost-details">
    {equipmentDetails}
    <dt>{fr ? 'Heures de main-d’œuvre' : 'Labor hours required'}</dt><dd>{number(cost.hours)}</dd>
    <dt>{fr ? 'Taux de coût mécanicien' : 'Mechanic labor cost rate'}</dt><dd>{money(cost.rate)}</dd>
    <dt>{fr ? 'Coût de main-d’œuvre' : 'Package labor cost'}</dt><dd>{money(cost.labor)}</dd>
    <dt>{fr ? 'Matériaux (avant taxe et fret)' : 'Material (before tax and freight)'}</dt><dd>{money(cost.material)}</dd>
    {cost.koneFinal != null && <>
      <dt>{fr ? 'Montant final KONE du forfait' : 'Package KONE final amount'}</dt><dd>{money(cost.koneFinal)}</dd>
      <dt>{fr ? 'Tarification KONE' : 'KONE pricing'}</dt>
      <dd>{fr ? 'Une fois par équipement, sans majoration, taxe ou fret supplémentaires.' : 'Once per equipment; no extra markup, tax or freight.'}</dd>
    </>}
    <dt className={`package-cost-total${totalUnavailable ? ' package-cost-pending-label' : ''}`}>{fr ? 'Coût estimé du forfait' : 'Package estimated cost'}</dt>
    <dd className={totalUnavailable ? 'package-cost-pending' : 'package-cost-total'}>{total}</dd>
  </dl>
}
