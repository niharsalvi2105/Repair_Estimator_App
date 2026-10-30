import { useEffect, useRef, useState } from 'react'
import type { CloneSections } from './data/requestClone'
import { DEFAULT_CLONE_SECTIONS } from './data/requestClone'

export function CloneRequestDialog({ language, busy, sourceName, error, onCancel, onClone }: {
  language: 'en' | 'fr'; busy: boolean; sourceName: string; error: string
  onCancel: () => void; onClone: (sections: CloneSections) => Promise<void>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [sections, setSections] = useState(DEFAULT_CLONE_SECTIONS)
  const fr = language === 'fr'
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  const labels: Record<keyof CloneSections, string> = {
    opportunity: fr ? 'Détails d’opportunité et contacts' : 'Opportunity details and contacts',
    equipment: fr ? 'Sélection des équipements' : 'Equipment selection',
    packages: fr ? 'Sélection des forfaits' : 'Package selection',
    custom: fr ? 'Main-d’œuvre, matériaux et portée personnalisés' : 'Custom labor, materials and scope',
    notes: fr ? 'Plan de facturation et notes CTT' : 'Billing plan and CTT notes',
  }
  return <dialog ref={dialog} className="clone-dialog" aria-labelledby="clone-dialog-title" onCancel={event => {
    event.preventDefault()
    if (!busy) onCancel()
  }}>
    <h2 id="clone-dialog-title">{fr ? 'Cloner la demande' : 'Clone request'}</h2>
    <p>{sourceName}</p>
    <p className="field-help">{fr
      ? 'Une nouvelle demande non enregistrée sera ouverte. Numéro, prix de vente, approbations et historique ne sont jamais copiés. Les données de référence sont vérifiées; les coûts sont recalculés à l’enregistrement.'
      : 'Opens a new, unsaved request. Request number, selling price, approvals and history are never copied. Master data is checked; costs are recalculated when saved.'}</p>
    <fieldset disabled={busy} className="clone-section-options"><legend>{fr ? 'Sections à copier' : 'Sections to copy'}</legend>
      {(Object.keys(labels) as (keyof CloneSections)[]).map(key => <label key={key}>
        <input type="checkbox" checked={sections[key]} onChange={event => {
          const checked = event.target.checked
          setSections(current => ({ ...current, [key]: checked,
            ...(key === 'custom' && checked ? { packages: true } : {}),
            ...(key === 'packages' && !checked ? { custom: false } : {}) }))
        }} />{labels[key]}
      </label>)}
    </fieldset>
    <p className="field-help">{fr ? 'La succursale source est conservée pour vérifier les équipements et forfaits, même sans les autres détails d’opportunité.'
      : 'The source branch is retained to validate equipment and packages, even without other Opportunity details.'}</p>
    {error && <p className="error-box" role="alert">{error}</p>}
    <div className="clone-preset-actions">
      <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>{fr ? 'Annuler' : 'Cancel'}</button>
      <button type="button" className="button primary" disabled={busy || !Object.values(sections).some(Boolean)}
        onClick={() => void onClone(sections)}>{busy ? (fr ? 'Vérification…' : 'Checking…') : (fr ? 'Ouvrir une nouvelle copie' : 'Open new copy')}</button>
    </div>
  </dialog>
}
