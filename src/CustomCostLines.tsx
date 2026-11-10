import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type { DraftLabor, DraftMaterial } from './data/draftContract'
import type { Market } from './data/estimateQuery'
import type { CostRate } from './data/packageCosts'
import { getPartCatalog, type CatalogResult } from './data/partCatalogRepository'
import { MaterialPartSelect } from './MaterialPartSelect'
import { calculateCustomMaterialTotal, materialEntryError } from './data/customMaterialCosts'
import { LABOR_COLUMNS, editLaborGridHours, laborGridCost, laborGridRows } from './data/laborGrid'
import { RequestFields, type RequestInputs } from './RequestFields'
import { CustomCostExcelUpload } from './CustomCostExcelUpload'
import { MAX_DRAFT_CHILD_OPERATIONS } from './data/draftContract'

type Props = {
  language: 'en' | 'fr'
  labor: DraftLabor[]
  materials: DraftMaterial[]
  setLabor: Dispatch<SetStateAction<DraftLabor[]>>
  setMaterials: Dispatch<SetStateAction<DraftMaterial[]>>
  canAdd: boolean
  enabled: boolean
  readOnly?: boolean
  packages?: { id: string; name: string; customName?: string; scope?: string; equipmentNumbers?: string[] }[]
  childCount?: number
  validateImport?: (labor: DraftLabor[], materials: DraftMaterial[]) => void
  onPackageDetails?: (id: string, field: 'name' | 'scope', value: string) => void
  activePackageId?: string
  market: Market
  currency?: string
  rates?: CostRate[]
  requestInputs: RequestInputs
  updateRequestInput: (key: keyof RequestInputs, value: string) => void
}

export function CustomCostLines({ language, labor, materials, setLabor, setMaterials, canAdd, enabled, readOnly = false,
  packages = [], childCount = MAX_DRAFT_CHILD_OPERATIONS, validateImport, onPackageDetails, activePackageId,
  market, currency, rates = [], requestInputs, updateRequestInput }: Props) {
  const fr = language === 'fr'
  const locked = readOnly || !enabled
  const [capabilityState, setCapabilityState] = useState<{ market: Market; result?: CatalogResult; error?: string }>()
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const hasCatalogLines = materials.some(line => line.pricingSource == null && line.partType != null)
  useEffect(() => {
    if (!enabled || !hasCatalogLines) return
    let active = true
    getPartCatalog(market).then(
      result => { if (active) setCapabilityState({ market, result }) },
      (reason: unknown) => { if (active) setCapabilityState({ market, error: reason instanceof Error ? reason.message : String(reason) }) },
    )
    return () => { active = false }
  }, [enabled, hasCatalogLines, market, catalogAttempt])
  const catalogState = capabilityState?.market === market ? capabilityState : undefined
  const capability = catalogState?.result
  const visibleLabor = activePackageId ? labor.filter(line => line.packageId === activePackageId) : labor
  const visibleMaterials = activePackageId ? materials.filter(line => line.packageId === activePackageId) : materials
  const matrix = laborGridRows(visibleLabor)
  const importRevision = useMemo(() => ({ labor, materials, requestInputs }), [labor, materials, requestInputs])
  const activeEquipment = packages.find(p => p.id === activePackageId)?.equipmentNumbers ?? []
  const money = (amount: number | undefined) => amount == null ? (fr ? 'Indisponible' : 'Unavailable') :
    `${amount.toLocaleString(fr ? 'fr-CA' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 10 })}${currency ? ` ${currency}` : ''}`
  function equipmentField(line: DraftLabor | DraftMaterial, update: (number: string) => void) {
    const numbers = packages.find(p => p.id === line.packageId)?.equipmentNumbers ?? []
    return <select className="text-input" aria-label={fr ? 'Numéro d’équipement' : 'Equipment Number'}
      value={line.equipmentNumber ?? ''} disabled={locked} onChange={event => update(event.target.value)}>
      <option value="">{fr ? 'Répartir sur le forfait' : 'Share across package'}</option>
      {line.equipmentNumber && !numbers.includes(line.equipmentNumber) &&
        <option value={line.equipmentNumber}>{line.equipmentNumber} ({fr ? 'non affecté' : 'not assigned'})</option>}
      {numbers.map(number => <option key={number} value={number}>{number}</option>)}
    </select>
  }
  function packageField(packageId: string | null | undefined, update: (id: string) => void) {
    if (activePackageId) return null
    return <select className="text-input" aria-label={fr ? 'Forfait CSTM' : 'CSTM package'}
      required disabled={locked} value={packageId ?? ''} onChange={event => update(event.target.value)}>
      <option value="">{fr ? 'Choisir un forfait' : 'Select a package'}</option>
      {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  }
  function importPanel(kind: 'labor' | 'material') {
    if (locked || !activePackageId || !validateImport) return null
    return <CustomCostExcelUpload key={`${activePackageId}-${kind}`} kind={kind} language={language}
      disabled={locked} packageId={activePackageId} equipmentNumbers={activeEquipment}
      revision={importRevision} market={market}
      maxLines={MAX_DRAFT_CHILD_OPERATIONS - childCount + (kind === 'labor' ? visibleLabor.length : visibleMaterials.length)}
      onImport={rows => {
        const nextLabor = kind === 'labor' ? [...labor.filter(l => l.packageId !== activePackageId), ...rows as DraftLabor[]] : labor
        const nextMaterials = kind === 'material' ? [...materials.filter(m => m.packageId !== activePackageId), ...rows as DraftMaterial[]] : materials
        validateImport(nextLabor, nextMaterials)
        if (kind === 'labor') setLabor(nextLabor)
        else setMaterials(nextMaterials)
      }} />
  }
  let materialTotal: number | undefined
  let materialTotalError = ''
  try { materialTotal = calculateCustomMaterialTotal(visibleMaterials) }
  catch (reason) {
    materialTotalError = fr ? 'Complétez les matériaux pour calculer le total. Les références KONE historiques restent tarifées au niveau du forfait.'
      : reason instanceof Error ? reason.message : String(reason)
  }
  const roles = fr ? ['Mécanicien', 'Aide', 'Régleur'] : ['Mechanic', 'Helper', 'Adjuster']
  return <section className="form-card custom-cost-lines">
    <h2>{fr ? 'Coûts personnalisés (CSTM)' : 'Custom costs (CSTM)'}</h2>
    {activePackageId && <h3>{packages.find(p => p.id === activePackageId)?.name}</h3>}
    {packages.filter(p => !activePackageId || p.id === activePackageId).map(p => <div className="custom-package-details" key={p.id}>
      <label className="field-label" htmlFor={`custom-package-name-${p.id}`}>
        {fr ? 'Nom du forfait personnalisé' : 'Custom package name'}{!activePackageId && ` (${p.name})`}
        <input id={`custom-package-name-${p.id}`} className="text-input" maxLength={500}
          disabled={locked} readOnly={!onPackageDetails} value={p.customName ?? ''}
          onChange={event => onPackageDetails?.(p.id, 'name', event.target.value)} />
      </label>
      <label className="field-label" htmlFor={`custom-package-scope-${p.id}`}>
        {fr ? 'Portée des travaux personnalisée' : 'Custom scope of work'}
        <textarea id={`custom-package-scope-${p.id}`} className="text-input request-textarea" maxLength={10000}
          disabled={locked} readOnly={!onPackageDetails} value={p.scope ?? ''}
          onChange={event => onPackageDetails?.(p.id, 'scope', event.target.value)} />
      </label>
    </div>)}
    <p>{fr ? 'Saisissez les heures et matériaux directement dans les cellules. Les taux de main-d’œuvre et les prix KONE sont vérifiés par le serveur.'
      : 'Enter hours and materials directly in the cells. Labor rates and KONE prices are verified by the server.'}</p>
    {enabled && <RequestFields stage="materialrates" language={language} value={requestInputs}
      onChange={updateRequestInput} readOnly={readOnly} custom />}
    <label className="field-label">{fr ? 'Matériau' : 'Material'}
      <input className="text-input custom-material-total" readOnly aria-live="polite" value={money(materialTotal)} />
    </label>
    {materialTotalError && <p className="field-help" role="status">{materialTotalError}</p>}
    {!enabled && <p className="error-box" role="alert">{fr
      ? 'Ajoutez un forfait CSTM ou supprimez explicitement toutes les lignes personnalisées et le prix VK13 avant d’enregistrer.'
      : 'Add a CSTM package or explicitly remove all custom lines and the VK13 price before saving.'}</p>}
    <h3>{fr ? 'Main-d’œuvre' : 'Labor'} ({matrix.length})</h3>
    {importPanel('labor')}
    <div className="custom-grid-scroll" role="region" aria-label={fr ? 'Grille de main-d’œuvre' : 'Labor grid'} tabIndex={0}>
      <table className="custom-cost-grid custom-labor-grid">
        <caption>{fr ? 'Détail des heures de main-d’œuvre' : 'Labor Hours Breakdown'}</caption>
        <thead>
          <tr><th rowSpan={2} scope="col">{fr ? 'Équipement' : 'Equipment'}</th>
            {roles.map(role => <th key={role} colSpan={2} scope="colgroup">{role}</th>)}
            <th rowSpan={2} scope="col">{fr ? 'Coût total' : 'Total Cost'}</th></tr>
          <tr>{LABOR_COLUMNS.map((column, i) => <th key={i} scope="col">{column.time === 126110000 ? 'ST' : 'DT'}</th>)}</tr>
        </thead>
        <tbody>{matrix.map((row, index) => {
          const ids = new Set(row.lines.map(line => line.id))
          function update(change: Partial<DraftLabor>) {
            setLabor(lines => lines.map(line => ids.has(line.id) ? { ...line, ...change } : line))
          }
          return <tr key={row.key} className="custom-labor-row" aria-label={`${fr ? 'Main-d’œuvre' : 'Labor'} ${index + 1}`}>
            <td>{equipmentField(row.lines[0], equipmentNumber => update({ equipmentNumber }))}
              {packageField(row.lines[0].packageId, packageId => update({ packageId }))}
              {!readOnly && <button type="button" className="button tertiary small" onClick={() =>
                setLabor(lines => lines.filter(line => !ids.has(line.id)))}>
                {fr ? 'Supprimer la main-d’œuvre' : 'Remove labor'} {index + 1}</button>}</td>
            {LABOR_COLUMNS.map((column, slot) => {
              const line = row.lines.find(line => line.role === column.role && line.time === column.time)
              return <td key={slot}><input type="number" className="text-input" min={0} max={100000} step="0.01"
                aria-label={`${roles[Math.floor(slot / 2)]} ${slot % 2 ? 'DT' : 'ST'}`}
                title={line?.rate == null ? (fr ? 'Taux de la succursale; vérifié à l’enregistrement' : 'Branch rate; verified on Save')
                  : `${fr ? 'Taux enregistré' : 'Saved rate'}: ${money(line.rate)}`}
                value={line?.hours || ''} disabled={locked || (!line && !canAdd && !row.lines.every(line => line.hours === 0))}
                onChange={event => setLabor(lines => editLaborGridHours(lines, row, slot, Number(event.target.value)))} /></td>
            })}
            <td className="custom-grid-number"><output>{money(laborGridCost(row.lines, rates))}</output></td>
          </tr>
        })}</tbody>
        <tfoot><tr><th scope="row">{fr ? 'Totaux' : 'Totals'}</th>
          {LABOR_COLUMNS.map((column, i) => <td key={i} className="custom-grid-number">
            {visibleLabor.filter(line => line.role === column.role && line.time === column.time)
              .reduce((sum, line) => sum + line.hours, 0).toLocaleString(fr ? 'fr-CA' : 'en-US')}
          </td>)}<td className="custom-grid-number">{money(laborGridCost(visibleLabor, rates))}</td></tr></tfoot>
      </table>
      {!matrix.length && <p className="custom-grid-empty">{fr ? 'Ajoutez une ligne de main-d’œuvre.' : 'Add a labor row to begin.'}</p>}
    </div>
    <p className="field-help">{fr ? 'ST : temps normal. DT : temps double. Heures vides ou nulles ignorées; chaque ligne doit contenir des heures positives. Les totaux utilisent les taux enregistrés, sinon les taux disponibles de la succursale.'
      : 'ST: straight time. DT: double time. Blank/zero cells are skipped; each row needs positive hours. Totals use saved rates, otherwise available branch rates.'}</p>
    {!readOnly && enabled && <button type="button" className="button secondary" disabled={!canAdd}
      onClick={() => setLabor(lines => [...lines, { id: crypto.randomUUID(),
        packageId: activePackageId ?? (packages.length === 1 ? packages[0].id : undefined),
        role: 126110000, time: 126110000, hours: 0 }])}>{fr ? 'Ajouter main-d’œuvre' : 'Add labor'}</button>}
    <h3>{fr ? 'Matériaux' : 'Materials'} ({visibleMaterials.length})</h3>
    {importPanel('material')}
    {enabled && hasCatalogLines && !capability?.available && <div className="draft-notice" role="status">
      <p>{!catalogState ? (fr ? 'Vérification du catalogue de pièces…' : 'Checking spare-parts catalog…')
        : fr ? 'Catalogue indisponible. La saisie manuelle Non-KONE reste disponible.'
          : 'Catalog unavailable. Manual Non-KONE entry remains available.'}</p>
      {catalogState?.error && <p role="alert">{catalogState.error}</p>}
      {catalogState?.result?.reason && <p>{catalogState.result.reason}</p>}
      {catalogState && <button className="button secondary small" type="button" onClick={() => {
        setCapabilityState(undefined); setCatalogAttempt(current => current + 1)
      }}>{fr ? 'Réessayer' : 'Retry catalog'}</button>}
    </div>}
    <div className="custom-grid-scroll" role="region" aria-label={fr ? 'Grille de matériaux' : 'Materials grid'} tabIndex={0}>
      <table className="custom-cost-grid custom-material-grid">
        <caption>{fr ? 'Détail des matériaux' : 'Material Breakdown'}</caption>
        <thead><tr>{[fr ? 'Numéro d’équipement' : 'Equipment Number', fr ? 'Description du matériau' : 'Material Description',
          fr ? 'Nom du fournisseur' : 'Vendor Name', fr ? 'Fabricant de pièce' : 'Part Mfg', fr ? 'N° de pièce' : 'Part #',
          fr ? 'Quantité' : 'Quantity', fr ? 'Coût unitaire' : 'Unit Cost'].map(label =>
          <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{visibleMaterials.map((line, index) => {
          const packagePriced = line.pricingSource === 'package'
          const catalog = line.pricingSource == null && line.partType != null
          function update(change: Partial<DraftMaterial>) {
            setMaterials(lines => lines.map(row => row.id === line.id ? { ...row, ...change } : row))
          }
          const partSelect = (field: 'type' | 'part' | 'details') => <MaterialPartSelect line={line} update={update}
            market={market} language={language} capability={capability} readOnly={locked} field={field} />
          return <tr key={line.id} className="custom-material-row" aria-label={`${fr ? 'Matériau' : 'Material'} ${index + 1}`}>
            <td>{equipmentField(line, equipmentNumber => update({ equipmentNumber }))}
              {packageField(line.packageId, packageId => update({ packageId }))}
              {!readOnly && <button type="button" className="button tertiary small"
                onClick={() => setMaterials(lines => lines.filter(row => row.id !== line.id))}>
                {fr ? 'Supprimer le matériau' : 'Remove material'} {index + 1}</button>}</td>
            <td><textarea className="text-input" aria-label="Description"
              required maxLength={2000} value={line.description} disabled={locked} readOnly={!!line.catalogPartId}
              onChange={event => update({ description: event.target.value })} /></td>
            <td><input className="text-input" aria-label={fr ? 'Nom du fournisseur' : 'Vendor Name'} maxLength={100}
              value={line.vendor} disabled={locked} readOnly={!!line.catalogPartId}
              onChange={event => update({ vendor: event.target.value })} /></td>
            <td>{catalog ? partSelect('type') : <select className="text-input" aria-label={fr ? 'Type de pièce' : 'Part type'}
              value={line.pricingSource ?? 'legacy'} disabled={locked} onChange={event => {
                if (event.target.value === 'kone') update({ partType: 'kone', pricingSource: undefined, catalogPartId: undefined,
                  part: '', description: '', vendor: '', unitCost: 0, unitPrice: undefined, markupPercent: capability?.defaultMarkupPercent,
                  uom: undefined, refreshPart: false })
                else update({ partType: 'non-kone', pricingSource: 'manual', catalogPartId: undefined,
                  unitCost: 0, unitPrice: undefined, markupPercent: undefined, uom: undefined, refreshPart: false })
              }}>
              {line.pricingSource == null && <option value="legacy">{fr ? 'Saisie existante' : 'Existing manual entry'}</option>}
              <option value="manual">Non-KONE</option><option value="kone">KONE</option>
              {packagePriced && <option value="package">{fr ? 'KONE (forfait historique)' : 'KONE (legacy package)'}</option>}
            </select>}</td>
            <td>{catalog ? partSelect('part') : <input className="text-input" aria-label={fr ? 'Numéro de pièce' : 'Part number'}
              required maxLength={100} value={line.part} disabled={locked}
              onChange={event => update({ part: event.target.value })} />}</td>
            <td><input className="text-input" type="number" aria-label={fr ? 'Quantité' : 'Quantity'}
              required min={1} max={100000} step={1} value={line.quantity || ''} disabled={locked}
              onChange={event => update({ quantity: Number(event.target.value) })} />
              {materialEntryError(line, language) && <p className="error-box" role="alert">{materialEntryError(line, language)}</p>}</td>
            <td>{packagePriced ? <span>{fr ? 'Inclus au forfait' : 'Included in package'}</span> :
              <input className="text-input" type="number" aria-label={fr ? 'Coût unitaire' : 'Unit cost'} required
                min={line.catalogPartId ? 0.0000000001 : 0.01} max={1000000000} step={line.catalogPartId ? 'any' : '0.01'}
                value={line.unitCost} disabled={locked} readOnly={!!line.catalogPartId || line.partType === 'kone'}
                onChange={event => update({ unitCost: Number(event.target.value) })} />}
              {catalog && <div className="custom-cell-pricing">
                {partSelect('details')}
                <label className="field-label">{fr ? 'Prix unitaire' : 'Unit price'}
                <input className="text-input" readOnly value={money(line.unitPrice ?? undefined)} />
                </label>
              </div>}
            </td>
          </tr>
        })}</tbody>
      </table>
      {!visibleMaterials.length && <p className="custom-grid-empty">{fr ? 'Ajoutez une ligne de matériau.' : 'Add a material row to begin.'}</p>}
    </div>
    {!readOnly && enabled && <button type="button" className="button secondary" disabled={!canAdd}
      onClick={() => setMaterials(lines => [...lines, { id: crypto.randomUUID(),
        packageId: activePackageId ?? (packages.length === 1 ? packages[0].id : undefined),
        description: '', vendor: '', part: '', quantity: 1, unitCost: 0, partType: 'kone' }])}>
      {fr ? 'Ajouter un matériau' : 'Add material'}</button>}
  </section>
}
