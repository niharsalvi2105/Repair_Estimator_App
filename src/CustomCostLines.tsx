import { useState, type Dispatch, type SetStateAction } from 'react'
import type { DraftLabor, DraftMaterial } from './data/draftContract'

type Props = {
  language: 'en' | 'fr'
  labor: DraftLabor[]
  materials: DraftMaterial[]
  setLabor: Dispatch<SetStateAction<DraftLabor[]>>
  setMaterials: Dispatch<SetStateAction<DraftMaterial[]>>
  canAdd: boolean
  enabled: boolean
  readOnly?: boolean
}

export function CustomCostLines({ language, labor, materials, setLabor, setMaterials, canAdd, enabled, readOnly = false }: Props) {
  const fr = language === 'fr'
  const [laborPage, setLaborPage] = useState(0)
  const [materialPage, setMaterialPage] = useState(0)
  const size = 10
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
    <p>{fr ? 'Totaux pour le devis entier, ajoutés une seule fois aux forfaits et aux autres coûts supplémentaires. Taxe et fret appliqués aux matériaux. Les taux sont déterminés par le serveur.'
      : 'Totals for the entire estimate, added once alongside packages and other additional costs. Tax and freight apply to materials. Labor rates are resolved by the server.'}</p>
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
            <input className="text-input" type="number" min={0} max={100000} step="0.01" value={line.hours}
              onChange={(e) => setLabor((rows) => rows.map((r) => r.id === line.id ? { ...r, hours: Number(e.target.value) } : r))} />
          </label>
        </div>
        <p>{fr ? 'Taux enregistré' : 'Saved rate'}: {line.rate == null ? (fr ? 'Enregistrez pour calculer' : 'Save to calculate')
          : line.rate.toLocaleString(fr ? 'fr-CA' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        {!readOnly && <button type="button" className="button tertiary small" onClick={() => setLabor((rows) => rows.filter((r) => r.id !== line.id))}>
          {fr ? 'Supprimer la main-d’œuvre' : 'Remove labor'} {number}</button>}
      </fieldset>
    })}
    {pageControls(labor.length, laborPage, setLaborPage)}
    {!readOnly && <button type="button" className="button secondary" disabled={!enabled || !canAdd}
      onClick={() => { setLaborPage(Math.floor(labor.length / size)); setLabor((rows) => [...rows, {
        id: crypto.randomUUID(), role: 126110000, time: 126110000, hours: 0,
      }]) }}>{fr ? 'Ajouter main-d’œuvre' : 'Add labor'}</button>}
    <h3>{fr ? 'Matériaux' : 'Materials'} ({materials.length})</h3>
    {materials.slice(materialStart, materialStart + size).map((line, index) => {
      const number = materialStart + index + 1
      function update(change: Partial<DraftMaterial>) {
        setMaterials((rows) => rows.map((r) => r.id === line.id ? { ...r, ...change } : r))
      }
      return <fieldset className="custom-cost-line" key={line.id} disabled={readOnly}>
        <legend>{fr ? 'Matériau' : 'Material'} {number}</legend>
        <div className="input-grid">
          <label className="field-label">{fr ? 'Description' : 'Description'}
            <textarea className="text-input" required maxLength={2000} value={line.description}
              onChange={(e) => update({ description: e.target.value })} />
          </label>
          <label className="field-label">{fr ? 'Fournisseur' : 'Vendor'}
            <input className="text-input" maxLength={100} value={line.vendor} onChange={(e) => update({ vendor: e.target.value })} />
          </label>
          <label className="field-label">{fr ? 'Numéro de pièce' : 'Part number'}
            <input className="text-input" maxLength={100} value={line.part} onChange={(e) => update({ part: e.target.value })} />
          </label>
          <label className="field-label">{fr ? 'Quantité' : 'Quantity'}
            <input className="text-input" type="number" min={0} max={100000} step="0.01" value={line.quantity}
              onChange={(e) => update({ quantity: Number(e.target.value) })} />
          </label>
          <label className="field-label">{fr ? 'Coût unitaire' : 'Unit cost'}
            <input className="text-input" type="number" min={0} max={1000000000} step="0.01" value={line.unitCost}
              onChange={(e) => update({ unitCost: Number(e.target.value) })} />
          </label>
        </div>
        {!readOnly && <button type="button" className="button tertiary small" onClick={() => setMaterials((rows) => rows.filter((r) => r.id !== line.id))}>
          {fr ? 'Supprimer le matériau' : 'Remove material'} {number}</button>}
      </fieldset>
    })}
    {pageControls(materials.length, materialPage, setMaterialPage)}
    {!readOnly && <button type="button" className="button secondary" disabled={!enabled || !canAdd}
      onClick={() => { setMaterialPage(Math.floor(materials.length / size)); setMaterials((rows) => [...rows, {
        id: crypto.randomUUID(), description: '', vendor: '', part: '', quantity: 1, unitCost: 0,
      }]) }}>{fr ? 'Ajouter un matériau' : 'Add material'}</button>}
    {!readOnly && !canAdd && <p role="alert">{fr ? 'Limite technique atteinte. Divisez la demande.' : 'Technical processing budget reached. Split this request.'}</p>}
  </section>
}
