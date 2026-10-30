import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { DraftLabor, DraftMaterial } from './data/draftContract'
import type { Market } from './data/estimateQuery'
import { getPartCatalog, type CatalogResult } from './data/partCatalogRepository'
import { MaterialPartSelect } from './MaterialPartSelect'

type Props = {
  language: 'en' | 'fr'
  labor: DraftLabor[]
  materials: DraftMaterial[]
  setLabor: Dispatch<SetStateAction<DraftLabor[]>>
  setMaterials: Dispatch<SetStateAction<DraftMaterial[]>>
  canAdd: boolean
  enabled: boolean
  readOnly?: boolean
  packages?: { id: string; name: string; materialBeforeMarkup?: number; material?: number }[]
  activePackageId?: string
  market: Market
}

export function CustomCostLines({ language, labor, materials, setLabor, setMaterials, canAdd, enabled, readOnly = false,
  packages = [], activePackageId, market }: Props) {
  const fr = language === 'fr'
  const [laborPage, setLaborPage] = useState(0)
  const [materialPage, setMaterialPage] = useState(0)
  const size = 10
  const [capabilityState, setCapabilityState] = useState<{ market: Market; result?: CatalogResult; error?: string }>()
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const hasCatalogLines = materials.some((line) => line.pricingSource == null && line.partType != null)
  useEffect(() => {
    if (!enabled || !hasCatalogLines) return
    let active = true
    getPartCatalog(market).then(
      (result) => { if (active) setCapabilityState({ market, result }) },
      (reason: unknown) => { if (active) setCapabilityState({ market, error: reason instanceof Error ? reason.message : String(reason) }) },
    )
    return () => { active = false }
  }, [enabled, hasCatalogLines, market, catalogAttempt])
  const catalogState = capabilityState?.market === market ? capabilityState : undefined
  const capability = catalogState?.result
  function pageControls(count: number, page: number, setPage: (page: number) => void) {
    const current = Math.min(page, Math.max(0, Math.ceil(count / size) - 1))
    return count > size && <div className="custom-line-actions">
      <button type="button" className="button secondary small" disabled={current === 0}
        onClick={() => setPage(current - 1)}>{fr ? 'Précédent' : 'Previous'}</button>
      <span>{current + 1} / {Math.ceil(count / size)}</span>
      <button type="button" className="button secondary small" disabled={(current + 1) * size >= count}
        onClick={() => setPage(current + 1)}>{fr ? 'Suivant' : 'Next'}</button>
    </div>
  }
  const laborStart = Math.min(laborPage, Math.max(0, Math.ceil(labor.length / size) - 1)) * size
  const materialStart = Math.min(materialPage, Math.max(0, Math.ceil(materials.length / size) - 1)) * size
  return <section className="form-card custom-cost-lines">
    <h2>{fr ? 'Coûts personnalisés (CSTM)' : 'Custom costs (CSTM)'}</h2>
    <p>{fr ? 'Main-d’œuvre et matériaux non-KONE ajoutés une seule fois au devis. Les pièces KONE utilisent les montants du forfait une fois par équipement, sans majoration, taxe ou fret supplémentaires. Les taux sont déterminés par le serveur.'
      : 'Labor and non-KONE materials are added once per estimate. KONE parts use the package amounts once per equipment, with no extra markup, tax or freight. Labor rates are resolved by the server.'}</p>
    {!enabled && <p className="error-box" role="alert">{fr
      ? 'Ajoutez un forfait CSTM ou supprimez explicitement toutes les lignes personnalisées et le prix VK13 avant d’enregistrer.'
      : 'Add a CSTM package or explicitly remove all custom lines and the VK13 price before saving.'}</p>}
    <h3>{fr ? 'Main-d’œuvre' : 'Labor'} ({labor.length})</h3>
    {labor.slice(laborStart, laborStart + size).map((line, index) => {
      const number = laborStart + index + 1
      return <fieldset className="custom-cost-line" key={line.id} disabled={readOnly}>
        <legend>{fr ? 'Main-d’œuvre' : 'Labor'} {number}</legend>
        <div className="input-grid">
          <label className="field-label">{fr ? 'Rôle' : 'Role'}
            <select className="text-input" value={line.role} onChange={(e) => setLabor((rows) => rows.map((r) =>
              r.id === line.id ? { ...r, role: Number(e.target.value), rate: undefined } : r))}>
              {[fr ? 'Mécanicien' : 'Mechanic', fr ? 'Aide' : 'Helper', fr ? 'Régleur' : 'Adjuster'].map((role, i) =>
                <option key={role} value={126110000 + i}>{role}</option>)}
            </select>
          </label>
          <label className="field-label">{fr ? 'Catégorie de temps' : 'Time category'}
            <select className="text-input" value={line.time} onChange={(e) => setLabor((rows) => rows.map((r) =>
              r.id === line.id ? { ...r, time: Number(e.target.value), rate: undefined } : r))}>
              <option value={126110000}>{fr ? 'Temps normal' : 'Straight Time'}</option>
              <option value={126110001}>{fr ? 'Temps double' : 'Double Time'}</option>
            </select>
          </label>
          <label className="field-label">{fr ? 'Heures' : 'Hours'}
            <input className="text-input" type="number" required min={0.01} max={100000} step="0.01" value={line.hours}
              onChange={(e) => setLabor((rows) => rows.map((r) => r.id === line.id ? { ...r, hours: Number(e.target.value) } : r))} />
          </label>
          <label className="field-label">{fr ? 'Forfait CSTM' : 'CSTM package'}
            <select className="text-input" required value={line.packageId ?? ''} onChange={(e) =>
              setLabor((rows) => rows.map((r) => r.id === line.id ? { ...r, packageId: e.target.value } : r))}>
              <option value="">{fr ? 'Choisir un forfait' : 'Select a package'}</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
        <p>{fr ? 'Taux enregistré' : 'Saved rate'}: {line.rate == null ? (fr ? 'Enregistrez pour calculer' : 'Save to calculate')
          : line.rate.toLocaleString(fr ? 'fr-CA' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        {!readOnly && <button type="button" className="button tertiary small" onClick={() => setLabor((rows) => rows.filter((r) => r.id !== line.id))}>
          {fr ? 'Supprimer la main-d’œuvre' : 'Remove labor'} {number}</button>}
      </fieldset>
    })}
    {pageControls(labor.length, laborPage, setLaborPage)}
    {!readOnly && enabled && <button type="button" className="button secondary" disabled={!canAdd}
      onClick={() => { setLaborPage(Math.floor(labor.length / size)); setLabor((rows) => [...rows, {
        id: crypto.randomUUID(), packageId: activePackageId ?? (packages.length === 1 ? packages[0].id : undefined),
        role: 126110000, time: 126110000, hours: 0,
      }]) }}>{fr ? 'Ajouter main-d’œuvre' : 'Add labor'}</button>}
    <h3>{fr ? 'Matériaux' : 'Materials'} ({materials.length})</h3>
    {enabled && hasCatalogLines && !capability?.available && <div className="draft-notice" role="status">
      <p>{!catalogState ? (fr ? 'Vérification du catalogue de pièces…' : 'Checking spare-parts catalog…')
        : (fr ? 'Catalogue indisponible : le schéma, le serveur et les données approuvées doivent être déployés. La saisie manuelle existante reste disponible.'
          : 'Catalog unavailable: schema, backend and approved data must be deployed. Existing manual entry remains available.')}</p>
      {catalogState?.error && <p>{catalogState.error}</p>}
      {catalogState?.result?.reason && <p>{catalogState.result.reason}</p>}
      {catalogState && <button className="button secondary small" type="button" onClick={() => {
        setCapabilityState(undefined); setCatalogAttempt((current) => current + 1)
      }}>{fr ? 'Réessayer' : 'Retry catalog'}</button>}
    </div>}
    {materials.slice(materialStart, materialStart + size).map((line, index) => {
      const number = materialStart + index + 1
      function update(change: Partial<DraftMaterial>) {
        setMaterials((rows) => rows.map((r) => r.id === line.id ? { ...r, ...change } : r))
      }
      const sourcePackage = packages.find((p) => p.id === line.packageId)
      const packagePriced = line.pricingSource === 'package'
      return <fieldset className="custom-cost-line" key={line.id} disabled={readOnly}>
        <legend>{fr ? 'Matériau' : 'Material'} {number}</legend>
        <div className="input-grid">
          <label className="field-label">{fr ? 'Forfait CSTM' : 'CSTM package'}
            <select className="text-input" required value={line.packageId ?? ''} onChange={(e) => update({ packageId: e.target.value })}>
              <option value="">{fr ? 'Choisir un forfait' : 'Select a package'}</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          {line.pricingSource == null && line.partType != null ? <MaterialPartSelect line={line} update={update} market={market} language={language}
            capability={capability} readOnly={readOnly || !enabled} /> : <label className="field-label">
            {fr ? 'Type de pièce' : 'Part type'}
            <select className="text-input" value={line.pricingSource ?? 'legacy'}
              onChange={(event) => {
                const pricingSource = event.target.value === 'package' ? 'package' : 'manual'
                update({ pricingSource, partType: pricingSource === 'package' ? 'kone' : 'non-kone',
                  unitCost: 0, unitPrice: undefined, markupPercent: undefined, uom: undefined, refreshPart: false })
              }}>
              {line.pricingSource == null && <option value="legacy">{fr ? 'Saisie manuelle existante' : 'Existing manual entry'}</option>}
              <option value="manual">{fr ? 'Non-KONE - saisie manuelle' : 'Non-KONE - manual entry'}</option>
              <option value="package">{fr ? 'KONE - montants du forfait' : 'KONE - package amounts'}</option>
            </select>
          </label>}
          <label className="field-label">{fr ? 'Description' : 'Description'}
            <textarea className="text-input" required maxLength={2000} value={line.description}
              readOnly={!!line.catalogPartId}
              onChange={(e) => update({ description: e.target.value })} />
          </label>
          <label className="field-label">{fr ? 'Fournisseur' : 'Vendor'}
            <input className="text-input" maxLength={100} readOnly={!!line.catalogPartId}
              value={line.vendor} onChange={(e) => update({ vendor: e.target.value })} />
          </label>
          <label className="field-label">{fr ? 'Numéro de pièce' : 'Part number'}
            <input className="text-input" maxLength={100} readOnly={!!line.catalogPartId}
              value={line.part} onChange={(e) => update({ part: e.target.value })} />
          </label>
          <label className="field-label">{packagePriced ? (fr ? 'Quantité (information seulement)' : 'Quantity (reference only)') : (fr ? 'Quantité' : 'Quantity')}
            <input className="text-input" type="number" required min={0.01} max={100000} step="0.01" value={line.quantity}
              onChange={(e) => update({ quantity: Number(e.target.value) })} />
          </label>
          {!packagePriced && <label className="field-label">{fr ? 'Coût unitaire' : 'Unit cost'}
            <input className="text-input" type="number" required min={line.catalogPartId ? 0.0000000001 : 0.01} max={1000000000}
              step={line.catalogPartId ? 'any' : '0.01'} readOnly={!!line.catalogPartId || line.partType === 'kone'} value={line.unitCost}
              onChange={(e) => update({ unitCost: Number(e.target.value) })} />
          </label>}
        </div>
        {packagePriced && <div className="draft-notice" role="status">
          <p>{fr ? 'Les numéros de pièce et quantités sont descriptifs. Plusieurs lignes KONE ne répètent pas le montant du forfait.'
            : 'Part numbers and quantities are descriptive. Multiple KONE lines do not repeat the package amount.'}</p>
          {sourcePackage?.materialBeforeMarkup == null || sourcePackage?.material == null
            ? <p className="error-box">{fr ? 'Montants du forfait manquants. Vérifiez le forfait avant d’enregistrer.' : 'Package amounts are missing. Check the package before saving.'}</p>
            : <p>{fr ? 'Par équipement - coût avant majoration' : 'Per equipment - cost before markup'}: {sourcePackage.materialBeforeMarkup.toLocaleString(fr ? 'fr-CA' : 'en-US')}
              {' · '}{fr ? 'Montant final' : 'Final amount'}: {sourcePackage.material.toLocaleString(fr ? 'fr-CA' : 'en-US')}</p>}
        </div>}
        {!readOnly && <button type="button" className="button tertiary small" onClick={() => setMaterials((rows) => rows.filter((r) => r.id !== line.id))}>
          {fr ? 'Supprimer le matériau' : 'Remove material'} {number}</button>}
      </fieldset>
    })}
    {pageControls(materials.length, materialPage, setMaterialPage)}
    {!readOnly && enabled && <button type="button" className="button secondary" disabled={!canAdd}
      onClick={() => { setMaterialPage(Math.floor(materials.length / size)); setMaterials((rows) => [...rows, {
        id: crypto.randomUUID(), packageId: activePackageId ?? (packages.length === 1 ? packages[0].id : undefined),
        description: '', vendor: '', part: '', quantity: 1, unitCost: 0, pricingSource: 'manual', partType: 'non-kone',
      }]) }}>{fr ? 'Ajouter un matériau' : 'Add material'}</button>}
    {!readOnly && !canAdd && <p role="alert">{fr ? 'Limite technique atteinte. Divisez la demande.' : 'Technical processing budget reached. Split this request.'}</p>}
  </section>
}
