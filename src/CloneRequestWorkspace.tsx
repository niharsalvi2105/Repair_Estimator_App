import { useEffect, useState } from 'react'
import { deleteOpportunityPreset, listOpportunityPresets, saveOpportunityPreset, type OpportunityPreset } from './data/opportunityPresetRepository'
import { parseOpportunityValues, type OpportunityValues } from './data/requestClone'
import type { Market } from './data/estimateQuery'
import { requestReuseErrorMessage } from './data/dataverseOperation'

export function CloneRequestWorkspace({ language, market, current, onUse, onRequests, busy, onBusyChange }: {
  language: 'en' | 'fr'; market: Market; current: OpportunityValues; busy: boolean
  onUse: (values: OpportunityValues) => Promise<void>; onRequests: () => void; onBusyChange: (busy: boolean) => void
}) {
  const fr = language === 'fr'
  const [records, setRecords] = useState<OpportunityPreset[]>()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [name, setName] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [working, setWorking] = useState(false)
  useEffect(() => {
    let active = true
    listOpportunityPresets(market).then(rows => { if (active) setRecords(rows) },
      (reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)) })
    return () => { active = false }
  }, [market, attempt])
  async function change(action: () => Promise<unknown>, message: string) {
    setWorking(true); onBusyChange(true); setError(''); setNotice('')
    try {
      await action()
      setNotice(message); setName('')
      setRecords(undefined); setAttempt(value => value + 1)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setWorking(false); onBusyChange(false) }
  }
  let validCurrent = true
  try { parseOpportunityValues(current) } catch { validCurrent = false }
  return <section className="page-content clone-workspace">
    <div className="page-heading"><div>
      <h1>{fr ? 'Cloner une demande' : 'Clone request'}</h1>
      <p>{fr ? 'Réutilisez vos détails d’opportunité privés ou copiez des sections d’une demande existante.'
        : 'Reuse your private Opportunity details or copy sections from an existing request.'}</p>
    </div></div>
    <section className="form-card">
      <h2>{fr ? 'Mes détails d’opportunité enregistrés' : 'My saved Opportunity details'}</h2>
      <p className="field-help">{fr
        ? 'Enregistrés dans Dataverse, réservés à votre compte et disponibles sur vos appareils. Utiliser un modèle ouvre une nouvelle demande non enregistrée.'
        : 'Saved in Dataverse, private to your account and available across devices. Using a preset opens a new, unsaved request.'}</p>
      {error && <div className="error-box" role="alert">
        <strong>{fr ? 'Impossible de charger ou modifier les modèles.' : 'Could not load or change presets.'}</strong>
        <span>{requestReuseErrorMessage(error, 'presets', language)}</span>
        <span>{fr ? 'Vérifiez les droits, la connexion et le déploiement du schéma et du serveur. Après une interruption, rechargez les modèles pour vérifier le résultat avant de réessayer une modification.'
          : 'Check permissions, connectivity and preset schema/backend deployment. After an interrupted operation, reload presets to check its outcome before retrying a change.'}</span>
        <button className="button secondary" disabled={working || busy} onClick={() => {
          setError(''); setRecords(undefined); setAttempt(value => value + 1)
        }}>{fr ? 'Réessayer' : 'Retry presets'}</button>
      </div>}
      {notice && <p className="draft-notice" role="status">{notice}</p>}
      {!records && !error && <p role="status">{fr ? 'Chargement des modèles…' : 'Loading presets…'}</p>}
      {records?.length === 0 && <p>{fr ? 'Aucun modèle pour ce marché.' : 'No saved presets for this market yet.'}</p>}
      <div className="clone-preset-list">
        {records?.map(record => <article className="clone-preset-card" key={record.id}>
          <div><h3>{record.name}</h3><p>{record.opportunity.customer} · {record.opportunity.building}</p></div>
          <div className="clone-preset-actions">
            <button type="button" className="button primary" disabled={working || busy} onClick={() => void onUse(record.opportunity)}>
              {fr ? 'Utiliser le modèle' : 'Use preset'}</button>
            <button type="button" className="button secondary" disabled={working || busy} aria-label={`${fr ? 'Supprimer' : 'Delete'} ${record.name}`}
              onClick={() => {
                if (window.confirm(fr ? `Supprimer le modèle « ${record.name} » ?` : `Delete preset "${record.name}"?`))
                  void change(() => deleteOpportunityPreset(record.id), fr ? 'Modèle supprimé.' : 'Preset deleted.')
              }}>{fr ? 'Supprimer' : 'Delete'}</button>
          </div>
        </article>)}
      </div>
    </section>
    <section className="form-card">
      <h2>{fr ? 'Enregistrer les détails actuels' : 'Save current Opportunity details'}</h2>
      <p className="field-help">{fr
        ? 'Remplissez les détails d’opportunité dans Nouvelle demande, puis donnez un nom à ce modèle. Équipements, forfaits, prix et approbations sont exclus.'
        : 'Fill Opportunity details in New Request, then name this preset. Equipment selections, packages, prices and approvals are excluded.'}</p>
      {validCurrent ? <p>{current.customer} · {current.building}</p> : <p>{fr ? 'Complétez d’abord les détails d’opportunité dans Nouvelle demande.' : 'Complete Opportunity details in New Request first.'}</p>}
      <label className="field-label">{fr ? 'Nom du modèle' : 'Preset name'}
        <input className="text-input" maxLength={100} value={name} disabled={working || busy} onChange={event => setName(event.target.value)} />
      </label>
      <button type="button" className="button primary" disabled={!records || !validCurrent || !name.trim() || working || busy}
        onClick={() => void change(() => saveOpportunityPreset(name, current), fr ? 'Modèle enregistré.' : 'Opportunity preset saved.')}>
        {fr ? 'Enregistrer les détails d’opportunité' : 'Save Opportunity details'}</button>
    </section>
    <section className="form-card">
      <h2>{fr ? 'Cloner une demande existante' : 'Clone an existing request'}</h2>
      <p>{fr ? 'Dans Demandes de réparation, sélectionnez Cloner, puis les sections à copier. La demande d’origine reste inchangée.'
        : 'In Repair Requests, select Clone and choose the sections to copy. The original request stays unchanged.'}</p>
      <button type="button" className="button secondary" disabled={busy || working} onClick={onRequests}>
        {fr ? 'Parcourir les demandes' : 'Browse repair requests'}</button>
    </section>
  </section>
}
