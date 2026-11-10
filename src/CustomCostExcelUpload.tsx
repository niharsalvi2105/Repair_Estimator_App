import { useEffect, useRef, useState } from 'react'
import type { DraftLabor, DraftMaterial } from './data/draftContract'
import { getPartCatalog } from './data/partCatalogRepository'
import type { Market } from './data/estimateQuery'

type Props = {
  kind: 'labor' | 'material'; language: 'en' | 'fr'; disabled: boolean
  packageId: string; equipmentNumbers: string[]; maxLines: number; market: Market
  revision: unknown
  onImport: (rows: DraftLabor[] | DraftMaterial[]) => void
}

export function CustomCostExcelUpload(props: Props) {
  const { kind, language, disabled, packageId, equipmentNumbers, maxLines, market } = props
  const fr = language === 'fr'
  const labor = kind === 'labor'
  const label = labor ? (fr ? 'main-d’œuvre' : 'labor') : (fr ? 'matériaux' : 'materials')
  const [busy, setBusy] = useState(false)
  const [templateBusy, setTemplateBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const current = useRef(props)
  useEffect(() => {
    current.current = props
    return () => { current.current = { ...props, disabled: true } }
  })
  async function download() {
    setTemplateBusy(true); setError('')
    try {
      const { customCostExcelTemplate } = await import('./data/customCostExcel')
      const buffer = await customCostExcelTemplate(kind, equipmentNumbers)
      const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }))
      const link = document.createElement('a')
      link.href = url; link.download = labor ? 'Labor-Template.xlsx' : 'Material-Template.xlsx'
      document.body.append(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setTemplateBusy(false) }
  }
  async function upload(file: File) {
    setBusy(true); setError(''); setNotice('')
    const snapshot = current.current
    try {
      if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 5 * 1024 * 1024)
        throw new Error(fr ? 'Utilisez un fichier .xlsx de 5 Mo maximum.' : 'Use an .xlsx file of 5 MB or less.')
      const { readCustomCostExcel } = await import('./data/customCostExcel')
      const rows = await readCustomCostExcel(await file.arrayBuffer(), kind, language, packageId, equipmentNumbers, maxLines)
      if (!labor) {
        const parts = rows as DraftMaterial[]
        const resolved = new Map<string, Partial<DraftMaterial>>()
        for (const row of parts.filter(p => p.partType === 'kone')) {
          if (!resolved.has(row.part)) {
            const result = await getPartCatalog(market, row.part, 'kone')
            const matches = result.parts.filter(part => part.number === row.part)
            if (!result.available || result.more || matches.length !== 1)
              throw new Error(fr ? `Pièce KONE introuvable ou ambiguë dans le catalogue : ${row.part}.`
                : `KONE part is unavailable or ambiguous in the approved catalog: ${row.part}.`)
            const part = matches[0]
            resolved.set(row.part, { catalogPartId: part.id, unitCost: part.unitCost,
              unitPrice: part.unitPrice, markupPercent: result.defaultMarkupPercent, uom: part.uom,
              description: part.description, partType: 'kone', refreshPart: true })
          }
          Object.assign(row, resolved.get(row.part))
        }
      }
      const latest = current.current
      if (latest.disabled || latest.packageId !== packageId || latest.market !== market ||
        latest.revision !== snapshot.revision || latest.equipmentNumbers.join('\n') !== equipmentNumbers.join('\n'))
        throw new Error(fr ? 'Le devis a changé. Réimportez le fichier.' : 'The estimate changed. Upload the file again.')
      if (!window.confirm(fr
        ? `Remplacer les lignes de ${label} de ce forfait CSTM par ${rows.length} lignes du fichier ? Les autres forfaits ne changent pas.`
        : `Replace this CSTM package’s ${label} with ${rows.length} imported rows? Other packages will not change.`)) {
        setNotice(fr ? 'Importation annulée. Aucune ligne modifiée.' : 'Import cancelled. No rows changed.')
        return
      }
      latest.onImport(rows)
      setNotice(fr ? `${rows.length} lignes importées. Enregistrez le devis pour les conserver.`
        : `${rows.length} rows imported. Save the estimate to keep them.`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  return <section className="equipment-excel-upload" aria-label={`${labor ? (fr ? 'Main-d’œuvre' : 'Labor') : (fr ? 'Matériaux' : 'Materials')} Excel import`}>
    <div className="equipment-excel-heading">
      <h3>{fr ? `Importer : ${label}` : `Import ${label} from Excel`}</h3>
      <span className="equipment-excel-format">.xlsx · {fr ? '5 Mo maximum' : '5 MB max'}</span>
    </div>
    <p className="equipment-excel-intro">{fr
      ? 'Le fichier remplace uniquement les lignes de ce forfait, après confirmation. Les exemples sont dans la feuille Instructions.'
      : 'The file replaces only this package’s rows, after confirmation. Examples are on the Instructions sheet.'}</p>
    <div className="equipment-excel-actions">
      <div className="equipment-excel-step">
        <p><span aria-hidden="true">1</span>{fr ? 'Préparer le fichier' : 'Prepare your file'}</p>
        <button type="button" className="button secondary" disabled={busy || templateBusy}
          aria-busy={templateBusy} onClick={() => void download()}>
          {fr ? 'Télécharger le modèle Excel' : 'Download Excel template'}
        </button>
      </div>
      <div className="equipment-excel-step">
        <p><span aria-hidden="true">2</span>{fr ? 'Importer les lignes' : 'Import your rows'}</p>
        <button type="button" className="button primary" disabled={disabled || busy || equipmentNumbers.length === 0}
          aria-busy={busy} onClick={() => fileInput.current?.click()}>
          {busy ? (fr ? 'Importation…' : 'Importing…') : (fr ? 'Téléverser le fichier Excel' : 'Upload Excel file')}
        </button>
        <input ref={fileInput} hidden type="file" accept=".xlsx" disabled={disabled || busy}
          aria-label={labor ? (fr ? 'Fichier Excel de main-d’œuvre' : 'Labor Excel file') : (fr ? 'Fichier Excel de matériaux' : 'Materials Excel file')}
          onChange={event => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file && !disabled && !busy) void upload(file)
          }} />
      </div>
    </div>
    <details className="equipment-excel-help">
      <summary>{fr ? 'Format et règles du fichier' : 'File format and import rules'}</summary>
      <p>{labor
        ? fr ? 'Numéro d’équipement et six colonnes : Mechanic ST/DT, Helper ST/DT, Adjuster ST/DT. Les heures vides ou nulles sont ignorées; taux et totaux calculés par le serveur.'
          : 'Equipment Number plus six hours columns: Mechanic ST/DT, Helper ST/DT, Adjuster ST/DT. Blank/zero hours are skipped; rates and totals are server-calculated.'
        : fr ? 'Equipment Number, Material Description, Vendor Name, Part Mfg, Part #, Quantity, Unit Cost. Part Mfg : KONE ou Non-KONE. Pour KONE, laissez le coût vide : le catalogue fournit les prix et la description.'
          : 'Equipment Number, Material Description, Vendor Name, Part Mfg, Part #, Quantity, Unit Cost. Part Mfg: KONE or Non-KONE. For KONE, leave cost blank: the catalog supplies prices and description.'}</p>
      <p>{fr ? 'Utilisez uniquement les équipements affectés à ce forfait. Conservez les zéros initiaux au format texte. Aucune formule ni aucun total importé.'
        : 'Use only equipment assigned to this package. Keep leading zeros using text format. No formulas or imported totals.'}</p>
    </details>
    {notice && <p role="status" className="draft-notice">{notice}</p>}
    {error && <p role="alert" className="error-box">{error}</p>}
  </section>
}
