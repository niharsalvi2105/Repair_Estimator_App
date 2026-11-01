import { useMemo, useState } from 'react'
import type { SelectedEquipment } from './App'
import type { RepairPackage } from './data/repairEstimatorRepository'
import type { DraftMaterial } from './data/draftContract'
import { calculatePackageUnitCost, type CostRate } from './data/packageCosts'
import { localizePackage } from './data/packageSearch'

const PAGE_SIZE = 20

export function EquipmentPackageCosts({ equipment, repairPackage, rates, time, tax, freight, materials, language, currency }: {
  equipment: SelectedEquipment[]; repairPackage: Omit<RepairPackage, 're_effectivefrom' | 're_effectiveto'>; rates: CostRate[]; time: number
  tax: number; freight: number; materials: DraftMaterial[]; language: 'en' | 'fr'; currency?: string
}) {
  const [equipmentPage, setEquipmentPage] = useState(0)
  const fr = language === 'fr'
  const result = useMemo(() => {
    try {
      return { cost: calculatePackageUnitCost(repairPackage, rates, time, tax, freight, materials), error: '' }
    } catch (reason) {
      return { cost: undefined, error: reason instanceof Error ? reason.message : String(reason) }
    }
  }, [repairPackage, rates, time, tax, freight, materials])
  const { cost, error } = result
  const currentEquipmentPage = Math.min(equipmentPage, Math.max(0, Math.ceil(equipment.length / PAGE_SIZE) - 1))
  const number = (amount: number) => amount.toLocaleString(fr ? 'fr-CA' : 'en-US',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const format = (amount: number) => `${number(amount)} ${currency}`
  function paging(count: number, page: number, update: (page: number) => void, label: string) {
    return count > PAGE_SIZE && <nav className="custom-line-actions" aria-label={label}>
      <button type="button" className="button secondary" disabled={page === 0} onClick={() => update(page - 1)}>
        {fr ? 'Précédent' : 'Previous'}
      </button>
      <span>{label}: {page + 1} / {Math.ceil(count / PAGE_SIZE)}</span>
      <button type="button" className="button secondary" disabled={(page + 1) * PAGE_SIZE >= count} onClick={() => update(page + 1)}>
        {fr ? 'Suivant' : 'Next'}
      </button>
    </nav>
  }
  const title = `${fr ? 'Détails du forfait par équipement' : 'Package per-equipment details'} — ${repairPackage.re_packagenumber}`
  return <section className="equipment-package-costs" aria-label={title}>
    <div className="section-heading">
      <span className="section-icon">EQ</span>
      <div>
        <h3>{title}</h3>
        <p>{fr
          ? 'Coût estimé de chaque forfait pour chaque numéro d’équipement, taxe et fret applicables inclus. Ce ne sont pas des prix de vente.'
          : 'Estimated cost of each package for each equipment number, including applicable tax and freight. These are not selling prices.'}</p>
      </div>
    </div>
    <p className="field-help">{fr
      ? 'La main-d’œuvre et les matériaux personnalisés, ainsi que les coûts supplémentaires, restent séparés au niveau du devis : ils ne sont pas répartis entre les équipements.'
      : 'Custom labor and material lines, and additional costs, remain separate at estimate level; they are not allocated among equipment.'}</p>
    {!currency && <p className="error-box" role="alert">{fr
      ? 'Devise indisponible. Rechargez les références de la succursale pour consulter les montants.'
      : 'Currency unavailable. Reload branch references before reviewing amounts.'}</p>}
    {error && <div className="error-box" role="alert">
      <strong>{fr ? 'Le coût par équipement est indisponible.' : 'Per-equipment cost is unavailable.'}</strong>
      <span>
        {repairPackage.re_packagenumber}: {fr ? 'Vérifiez les taux de main-d’œuvre, les montants du forfait, la taxe et le fret.' : error}
      </span>
    </div>}
    <div className="equipment-package-grid">
      {equipment.slice(currentEquipmentPage * PAGE_SIZE, (currentEquipmentPage + 1) * PAGE_SIZE).map((unit) =>
        <article className="equipment-package-card" key={unit.id}>
          <h4>{unit.number}</h4>
          {unit.name && <p>{unit.name}</p>}
          {!unit.matched && <span className="unbound-tag">{fr ? 'Non répertorié' : 'Unlisted'}</span>}
          <dl className="equipment-package-amounts">
            <div>
              <dt><strong>{repairPackage.re_packagenumber}</strong><span>{localizePackage(repairPackage, language)}</span></dt>
              <dd>
                {cost && currency ? <>
                  <dl className="equipment-package-breakdown">
                    <dt>{fr ? 'Nombre d’équipements' : 'Number of equipment'}</dt><dd>1</dd>
                    <dt>{fr ? 'Heures de main-d’œuvre' : 'Labor hours required'}</dt><dd>{number(cost.hours)}</dd>
                    <dt>{fr ? 'Taux de coût mécanicien' : 'Mechanic labor cost rate'}</dt><dd>{format(cost.rate)}</dd>
                    <dt>{fr ? 'Coût de main-d’œuvre' : 'Package labor cost'}</dt><dd>{format(cost.labor)}</dd>
                    <dt>{fr ? 'Matériaux (avant taxe et fret)' : 'Material (before tax and freight)'}</dt><dd>{format(cost.material)}</dd>
                    <dt>{fr ? 'Taxe (%)' : 'Tax (%)'}</dt><dd>{number(cost.tax)}%</dd>
                    <dt>{fr ? 'Montant de la taxe' : 'Tax amount'}</dt><dd>{format(cost.taxAmount)}</dd>
                    <dt>{fr ? 'Fret (%)' : 'Freight (%)'}</dt><dd>{number(cost.freight)}%</dd>
                    <dt>{fr ? 'Montant du fret' : 'Freight amount'}</dt><dd>{format(cost.freightAmount)}</dd>
                  </dl>
                  {cost.packagePriced && <p className="field-help">{fr
                    ? 'Pièces KONE : coût du forfait avant majoration, sans taxe ni fret supplémentaires.'
                    : 'KONE parts: package cost before markup, with no extra tax or freight.'}</p>}
                  <p className="field-help equipment-package-formula">{fr
                    ? 'Main-d’œuvre = heures × taux. Total = main-d’œuvre + matériaux + taxe + fret.'
                    : 'Labor = hours × rate. Total = labor + material + tax + freight.'}</p>
                  <p className="equipment-package-total-label">{fr ? 'Coût estimé du forfait par équipement' : 'Package estimated cost per equipment'}</p>
                  <p className="equipment-package-price">{format(cost.total)}</p>
                </> : <p className="package-cost-status">{fr ? 'Indisponible' : 'Unavailable'}</p>}
              </dd>
            </div>
          </dl>
        </article>)}
    </div>
    {paging(equipment.length, currentEquipmentPage, setEquipmentPage, fr ? 'Équipements' : 'Equipment')}
  </section>
}
