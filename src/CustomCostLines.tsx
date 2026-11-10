import { Fragment, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { DraftLabor, DraftMaterial } from './data/draftContract'
import type { Market } from './data/estimateQuery'
import { getPartCatalog, type CatalogResult } from './data/partCatalogRepository'
import { MaterialPartSelect } from './MaterialPartSelect'
import { calculateCustomMaterialTotal, materialEntryError } from './data/customMaterialCosts'
import { RequestFields, type RequestInputs } from './RequestFields'

type Props = {
  language: 'en' | 'fr'
  labor: DraftLabor[]
  materials: DraftMaterial[]
  setLabor: Dispatch<SetStateAction<DraftLabor[]>>
  setMaterials: Dispatch<SetStateAction<DraftMaterial[]>>
  canAdd: boolean
  enabled: boolean
  readOnly?: boolean
  packages?: { id: string; name: string; customName?: string; scope?: string; materialBeforeMarkup?: number; material?: number }[]
  onPackageDetails?: (id: string, field: 'name' | 'scope', value: string) => void
  activePackageId?: string
  market: Market
  currency?: string
  requestInputs: RequestInputs
  updateRequestInput: (key: keyof RequestInputs, value: string) => void
}

export function CustomCostLines({ language, labor, materials, setLabor, setMaterials, canAdd, enabled, readOnly = false,
  packages = [], onPackageDetails, activePackageId, market, currency, requestInputs, updateRequestInput }: Props) {
  const fr = language === 'fr'
  const [laborPage, setLaborPage] = useState(0)
  const [materialPage, setMaterialPage] = useState(0)
  const [collapsedRows, setCollapsedRows] = useState<Set<string>>(new Set())
  function toggleRow(key: string) {
    setCollapsedRows(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  function rowControls(kind: 'labor' | 'material', ids: string[]) {
    return ids.length > 0 && <div className="custom-grid-actions">
      <button type="button" className="button secondary small" onClick={() =>
        setCollapsedRows(current => new Set([...current].filter(key => !ids.some(id => key === `${kind}-${id}`))))}>
        {fr ? 'Tout développer' : 'Expand all'}
      </button>
      <button type="button" className="button secondary small" onClick={() =>
        setCollapsedRows(current => new Set([...current, ...ids.map(id => `${kind}-${id}`)]))}>
        {fr ? 'Tout réduire' : 'Collapse all'}
      </button>
    </div>
  }
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
  const visibleLabor = activePackageId ? labor.filter((line) => line.packageId === activePackageId) : labor
  const visibleMaterials = activePackageId ? materials.filter((line) => line.packageId === activePackageId) : materials
  const laborStart = Math.min(laborPage, Math.max(0, Math.ceil(visibleLabor.length / size) - 1)) * size
  const materialStart = Math.min(materialPage, Math.max(0, Math.ceil(visibleMaterials.length / size) - 1)) * size
  const money = (amount: number) => `${amount.toLocaleString(fr ? 'fr-CA' : 'en-US',
    { minimumFractionDigits: 2, maximumFractionDigits: 10 })}${currency ? ` ${currency}` : ''}`
  let materialTotal: number | undefined
  let materialTotalError = ''
  try {
    materialTotal = calculateCustomMaterialTotal(visibleMaterials)
  } catch (reason) {
    materialTotalError = fr ? 'Complétez les matériaux pour calculer le total. Les références KONE historiques restent tarifées au niveau du forfait.'
      : reason instanceof Error ? reason.message : String(reason)
  }
  return <section className="form-card custom-cost-lines">
    <h2>{fr ? 'Coûts personnalisés (CSTM)' : 'Custom costs (CSTM)'}</h2>
    {activePackageId && <h3>{packages.find((p) => p.id === activePackageId)?.name}</h3>}
    {packages.filter(p => !activePackageId || p.id === activePackageId).map(p => <div className="custom-package-details" key={p.id}>
      <label className="field-label" htmlFor={`custom-package-name-${p.id}`}>
        {fr ? 'Nom du forfait personnalisé' : 'Custom package name'}{!activePackageId && ` (${p.name})`}
        <input id={`custom-package-name-${p.id}`} className="text-input" maxLength={500}
          disabled={readOnly || !enabled} readOnly={!onPackageDetails} value={p.customName ?? ''}
          onChange={event => onPackageDetails?.(p.id, 'name', event.target.value)} />
      </label>
      <label className="field-label" htmlFor={`custom-package-scope-${p.id}`}>
        {fr ? 'Portée des travaux personnalisée' : 'Custom scope of work'}
        <textarea id={`custom-package-scope-${p.id}`} className="text-input request-textarea" maxLength={10000}
          disabled={readOnly || !enabled} readOnly={!onPackageDetails} value={p.scope ?? ''}
          onChange={event => onPackageDetails?.(p.id, 'scope', event.target.value)} />
      </label>
    </div>)}
    <p>{fr ? 'Main-d’œuvre et matériaux ajoutés une seule fois au devis. Matériau = somme des coûts unitaires × quantités, avant taxe et fret. Les pièces KONE proviennent du catalogue approuvé. Les taux sont déterminés par le serveur.'
      : 'Labor and materials are added once per estimate. Material = sum of unit cost × quantity, before tax and freight. KONE parts come from the approved catalog. Labor rates are resolved by the server.'}</p>
    {enabled && <RequestFields stage="materialrates" language={language} value={requestInputs}
      onChange={updateRequestInput} readOnly={readOnly} custom />}
    <p className="field-help">{fr ? 'Saisissez les taux exacts : 3 signifie 3 %, 12 signifie 12 %. Ces taux sont partagés par les forfaits CSTM et appliqués aux matériaux, pas à la main-d’œuvre.'
      : 'Enter exact percentage rates: 3 means 3%, 12 means 12%. These rates are shared by CSTM packages and apply to materials, not labor.'}</p>
    <label className="field-label">{fr ? 'Matériau' : 'Material'}
      <input className="text-input custom-material-total" readOnly aria-live="polite"
        value={materialTotal == null ? (fr ? 'Indisponible' : 'Unavailable') : money(materialTotal)} />
    </label>
    {materialTotalError && <p className="field-help" role="status">{materialTotalError}</p>}
    {!enabled && <p className="error-box" role="alert">{fr
      ? 'Ajoutez un forfait CSTM ou supprimez explicitement toutes les lignes personnalisées et le prix VK13 avant d’enregistrer.'
      : 'Add a CSTM package or explicitly remove all custom lines and the VK13 price before saving.'}</p>}
    <h3>{fr ? 'Main-d’œuvre' : 'Labor'} ({visibleLabor.length})</h3>
    {rowControls('labor', visibleLabor.map(line => line.id))}
    <div className="custom-grid-scroll" role="region" aria-label={fr ? 'Grille de main-d’œuvre' : 'Labor grid'} tabIndex={0}>
    <table className="custom-cost-grid">
      <caption>{fr ? 'Détail de main-d’œuvre' : 'Labor breakdown'}</caption>
      <thead><tr>{[fr ? 'Ligne' : 'Line', fr ? 'Forfait' : 'Package', fr ? 'Rôle' : 'Role',
        fr ? 'Temps' : 'Time', fr ? 'Heures' : 'Hours', fr ? 'Taux enregistré' : 'Saved rate'].map(label =>
        <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>
    {visibleLabor.slice(laborStart, laborStart + size).map((line, index) => {
      const number = laborStart + index + 1
      const key = `labor-${line.id}`
      const expanded = !collapsedRows.has(key)
      return <Fragment key={line.id}>
        <tr className="custom-grid-summary">
          <th scope="row"><button className="custom-row-toggle" type="button" aria-expanded={expanded}
            aria-controls={`custom-detail-${key}`} onClick={() => toggleRow(key)}>
            <span aria-hidden="true">{expanded ? '-' : '+'}</span> {fr ? 'Main-d’œuvre' : 'Labor'} {number}
          </button></th>
          <td>{packages.find(p => p.id === line.packageId)?.name || '—'}</td>
          <td>{(fr ? ['Mécanicien', 'Aide', 'Régleur'] : ['Mechanic', 'Helper', 'Adjuster'])[line.role - 126110000] ?? '—'}</td>
          <td>{line.time === 126110001 ? 'DT' : 'ST'}</td>
          <td className="custom-grid-number">{line.hours.toLocaleString(fr ? 'fr-CA' : 'en-US')}</td>
          <td className="custom-grid-number">{line.rate == null ? (fr ? 'À calculer' : 'Not calculated') : money(line.rate)}</td>
        </tr>
        <tr id={`custom-detail-${key}`} hidden={!expanded} className="custom-grid-detail"><td colSpan={6}>
        <fieldset className="custom-cost-line" disabled={readOnly} onInvalidCapture={() =>
          setCollapsedRows(current => new Set([...current].filter(id => id !== key)))}>
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
      </fieldset></td></tr>
      </Fragment>
    })}
      </tbody>
    </table>
    {visibleLabor.length === 0 && <p className="custom-grid-empty">{fr ? 'Aucune ligne de main-d’œuvre. Ajoutez une ligne pour commencer.' : 'No labor lines yet. Add a row to get started.'}</p>}
    </div>
    {pageControls(visibleLabor.length, laborPage, setLaborPage)}
    {!readOnly && enabled && <button type="button" className="button secondary" disabled={!canAdd}
      onClick={() => { setLaborPage(Math.floor(visibleLabor.length / size)); setLabor((rows) => [...rows, {
        id: crypto.randomUUID(), packageId: activePackageId ?? (packages.length === 1 ? packages[0].id : undefined),
        role: 126110000, time: 126110000, hours: 0,
      }]) }}>{fr ? 'Ajouter main-d’œuvre' : 'Add labor'}</button>}
    <h3>{fr ? 'Matériaux' : 'Materials'} ({visibleMaterials.length})</h3>
    {rowControls('material', visibleMaterials.map(line => line.id))}
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
    <div className="custom-grid-scroll" role="region" aria-label={fr ? 'Grille de matériaux' : 'Materials grid'} tabIndex={0}>
    <table className="custom-cost-grid custom-material-grid">
      <caption>{fr ? 'Détail des matériaux' : 'Material breakdown'}</caption>
      <thead><tr>{[fr ? 'Ligne' : 'Line', 'Description', fr ? 'Fournisseur' : 'Vendor', fr ? 'Pièce' : 'Part',
        fr ? 'Quantité' : 'Quantity', fr ? 'Coût unitaire' : 'Unit cost', fr ? 'Total avant taxe/fret' : 'Total before tax/freight'].map(label =>
        <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>
    {visibleMaterials.slice(materialStart, materialStart + size).map((line, index) => {
      const number = materialStart + index + 1
      function update(change: Partial<DraftMaterial>) {
        setMaterials((rows) => rows.map((r) => r.id === line.id ? { ...r, ...change } : r))
      }
      const sourcePackage = packages.find((p) => p.id === line.packageId)
      const packagePriced = line.pricingSource === 'package'
      const key = `material-${line.id}`
      const expanded = !collapsedRows.has(key)
      const validTotal = !materialEntryError(line, language) && !!line.description.trim() &&
        Number.isFinite(line.unitCost) && line.unitCost > 0
      return <Fragment key={line.id}>
        <tr className="custom-grid-summary">
          <th scope="row"><button className="custom-row-toggle" type="button" aria-expanded={expanded}
            aria-controls={`custom-detail-${key}`} onClick={() => toggleRow(key)}>
            <span aria-hidden="true">{expanded ? '-' : '+'}</span> {fr ? 'Matériau' : 'Material'} {number}
          </button></th>
          <td><span className="custom-grid-description">{line.description || '—'}</span></td>
          <td>{line.vendor || '—'}</td><td>{line.part || '—'}</td>
          <td className="custom-grid-number">{line.quantity.toLocaleString(fr ? 'fr-CA' : 'en-US')}</td>
          <td className="custom-grid-number">{packagePriced ? (fr ? 'Forfait' : 'Package priced') : money(line.unitCost)}</td>
          <td className="custom-grid-number">{packagePriced ? (fr ? 'Inclus au forfait' : 'Included in package')
            : validTotal ? money(line.unitCost * line.quantity) : (fr ? 'Incomplet' : 'Incomplete')}</td>
        </tr>
        <tr id={`custom-detail-${key}`} hidden={!expanded} className="custom-grid-detail"><td colSpan={7}>
        <fieldset className="custom-cost-line" disabled={readOnly} onInvalidCapture={() =>
          setCollapsedRows(current => new Set([...current].filter(id => id !== key)))}>
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
              {packagePriced && <option value="package">{fr ? 'KONE - montants du forfait (historique)' : 'KONE - package amounts (saved legacy)'}</option>}
            </select>
          </label>}
          <label className="field-label">{fr ? 'Description' : 'Description'}
            <textarea className="text-input" required maxLength={2000} value={line.description}
              readOnly={!!line.catalogPartId}
              onChange={(e) => update({ description: e.target.value })} />
          </label>
          {(line.pricingSource != null || line.partType == null) && <label className="field-label">{fr ? 'Numéro de pièce' : 'Part number'}
            <input className="text-input" required maxLength={100} readOnly={!!line.catalogPartId}
              value={line.part} onChange={(e) => update({ part: e.target.value })} />
          </label>}
          <label className="field-label">{packagePriced ? (fr ? 'Quantité (information seulement)' : 'Quantity (reference only)') : (fr ? 'Quantité' : 'Quantity')}
            <input className="text-input" type="number" required min={1} max={100000} step="1" value={line.quantity || ''}
              onChange={(e) => update({ quantity: Number(e.target.value) })} />
          </label>
          {!packagePriced && <label className="field-label">{fr ? 'Coût unitaire' : 'Unit cost'}
            <input className="text-input" type="number" required min={line.catalogPartId ? 0.0000000001 : 0.01} max={1000000000}
              step={line.catalogPartId ? 'any' : '0.01'} readOnly={!!line.catalogPartId || line.partType === 'kone'} value={line.unitCost}
              onChange={(e) => update({ unitCost: Number(e.target.value) })} />
          </label>}
          {line.pricingSource == null && line.partType != null && <label className="field-label">{fr ? 'Prix unitaire' : 'Unit price'}
            <input className="text-input" readOnly value={line.unitPrice == null ? (fr ? 'Indisponible' : 'Unavailable') : money(line.unitPrice)} />
          </label>}
        </div>
        {materialEntryError(line, language) && <p className="error-box" role="alert">{materialEntryError(line, language)}</p>}
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
      </fieldset></td></tr>
      </Fragment>
    })}
      </tbody>
    </table>
    {visibleMaterials.length === 0 && <p className="custom-grid-empty">{fr ? 'Aucun matériau. Ajoutez une ligne pour commencer.' : 'No material lines yet. Add a row to get started.'}</p>}
    </div>
    {pageControls(visibleMaterials.length, materialPage, setMaterialPage)}
    {!readOnly && enabled && <button type="button" className="button secondary" disabled={!canAdd}
      onClick={() => { setMaterialPage(Math.floor(visibleMaterials.length / size)); setMaterials((rows) => [...rows, {
        id: crypto.randomUUID(), packageId: activePackageId ?? (packages.length === 1 ? packages[0].id : undefined),
        description: '', vendor: '', part: '', quantity: 1, unitCost: 0, partType: 'kone',
      }]) }}>{fr ? 'Ajouter un matériau' : 'Add material'}</button>}
    {!readOnly && !canAdd && <p role="alert">{fr ? 'Limite technique atteinte. Divisez la demande.' : 'Technical processing budget reached. Split this request.'}</p>}
  </section>
}
