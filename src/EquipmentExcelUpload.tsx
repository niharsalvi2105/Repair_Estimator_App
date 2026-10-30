import { useId, useRef, useState } from 'react'

export function EquipmentExcelUpload({ language, disabled, busy, onUpload }: {
  language: 'en' | 'fr'; disabled: boolean; busy: boolean; onUpload: (file: File) => Promise<void>
}) {
  const fr = language === 'fr'
  const [templateBusy, setTemplateBusy] = useState(false)
  const [error, setError] = useState('')
  const [filename, setFilename] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const helpId = useId()
  async function download() {
    setTemplateBusy(true); setError('')
    try {
      const { equipmentExcelTemplate } = await import('./data/equipmentExcel')
      const buffer = await equipmentExcelTemplate()
      const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }))
      const link = document.createElement('a')
      link.href = url; link.download = 'Equipment-Template.xlsx'
      document.body.append(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally { setTemplateBusy(false) }
  }
  return <section className="equipment-excel-upload" aria-label={fr ? 'Import Excel des équipements' : 'Equipment Excel import'}>
    <div className="equipment-excel-heading">
      <h3>{fr ? 'Importer des équipements depuis Excel' : 'Import equipment from Excel'}</h3>
      <span className="equipment-excel-format">.xlsx · {fr ? '5 Mo maximum' : '5 MB max'}</span>
    </div>
    <p className="equipment-excel-intro">{fr
      ? 'Ajoutez plusieurs équipements à l’aide du modèle, sans les saisir un par un.'
      : 'Use the template to add multiple equipment without entering each one manually.'}</p>
    <div className="equipment-excel-actions">
      <div className="equipment-excel-step">
        <p><span aria-hidden="true">1</span>{fr ? 'Préparer le fichier' : 'Prepare your file'}</p>
        <button className="button secondary" type="button" disabled={templateBusy || busy}
          aria-busy={templateBusy} onClick={() => void download()}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg>
          {templateBusy ? (fr ? 'Préparation du modèle…' : 'Preparing template…')
            : (fr ? 'Télécharger le modèle Excel' : 'Download Excel template')}
        </button>
      </div>
      <div className="equipment-excel-step">
        <p><span aria-hidden="true">2</span>{fr ? 'Importer les équipements' : 'Import your equipment'}</p>
        <button className="button primary" type="button" disabled={disabled || busy} aria-describedby={helpId}
          aria-busy={busy} onClick={() => fileInput.current?.click()}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5" /></svg>
          {busy ? (fr ? 'Importation en cours…' : 'Importing equipment…')
            : (fr ? 'Téléverser le fichier Excel' : 'Upload Excel file')}
        </button>
        <input ref={fileInput} type="file" accept=".xlsx" hidden
          aria-label={fr ? 'Téléverser le fichier Excel des équipements' : 'Upload equipment Excel file'}
          disabled={disabled || busy} onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) { setFilename(file.name); void onUpload(file) }
          }} />
      </div>
    </div>
    {filename && <p className="equipment-excel-filename">
      <strong>{fr ? 'Fichier sélectionné' : 'Selected file'}:</strong> {filename}
    </p>}
    <details className="equipment-excel-help" id={helpId}>
      <summary>{fr ? 'Format et règles du fichier' : 'File format and import rules'}</summary>
      <p>{fr ? 'Colonnes du modèle (conservez les en-têtes) :' : 'Template columns (keep these headers):'}</p>
      <ul className="equipment-excel-columns">
        {['Equipment Number', 'Equipment Name', 'Age', 'Location', 'Manufacturer'].map((column) =>
          <li key={column}>{column}</li>)}
      </ul>
      <p>{fr ? 'Numéro requis; autres détails facultatifs. Âge : entier de 0 à 200. Conservez les zéros initiaux en utilisant le format texte.'
        : 'Equipment number is required; other details are optional. Age: whole number from 0 to 200. Use text format to preserve leading zeros.'}</p>
      <p>{fr
        ? 'Les équipements existants conservent leurs détails Dataverse. Les autres sont ajoutés uniquement à ce devis avec le client de l’opportunité.'
        : 'Existing equipment keeps its Dataverse details. Unmatched equipment is added only to this estimate with the Opportunity customer.'}</p>
    </details>
    {error && <p className="error-box" role="alert">{error}</p>}
  </section>
}
