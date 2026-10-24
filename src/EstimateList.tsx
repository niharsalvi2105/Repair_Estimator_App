import { useEffect, useState } from 'react'
import { listEstimates, type EstimateSummary } from './data/repairEstimatorRepository'
import { DataverseError } from './data/dataverseOperation'
import type { Market } from './data/estimateQuery'

const text = {
  en: {
    search: 'Search request ID, customer or building (starts with)',
    status: 'Status', all: 'All statuses', loading: 'Loading requests...',
    empty: 'No accessible requests match these filters.',
    error: 'Could not load repair requests.', denied: 'Dataverse denied access to these requests.',
    retry: 'Retry', previous: 'Previous', next: 'Next', page: 'Page',
    request: 'Request', customer: 'Customer', building: 'Building', created: 'Created',
    draft: 'Draft', pending: 'Pending', submitted: 'Submitted', unknown: 'Unknown status',
    scope: 'Only records allowed by your Dataverse permissions are returned. Read-only view.',
  },
  fr: {
    search: 'Rechercher par début de numéro, client ou immeuble',
    status: 'État', all: 'Tous les états', loading: 'Chargement des demandes…',
    empty: 'Aucune demande accessible ne correspond aux filtres.',
    error: 'Impossible de charger les demandes.', denied: 'Dataverse a refusé l’accès à ces demandes.',
    retry: 'Réessayer', previous: 'Précédent', next: 'Suivant', page: 'Page',
    request: 'Demande', customer: 'Client', building: 'Immeuble', created: 'Création',
    draft: 'Brouillon', pending: 'En attente', submitted: 'Envoyée', unknown: 'État inconnu',
    scope: 'Seules les demandes autorisées par Dataverse sont affichées. Consultation uniquement.',
  },
}

export function EstimateList({ language, market }: { language: 'en' | 'fr'; market: Market }) {
  const t = text[language]
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [tokens, setTokens] = useState<(string | undefined)[]>([undefined])
  const [nextToken, setNextToken] = useState<string>()
  const [records, setRecords] = useState<EstimateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ message: string; denied: boolean }>()
  const [retry, setRetry] = useState(0)
  const skipToken = tokens[tokens.length - 1]

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      setError(undefined)
      void listEstimates({ search, status, skipToken, market })
        .then((page) => {
          if (cancelled) return
          setRecords(page.records)
          setNextToken(page.skipToken)
        })
        .catch((reason: unknown) => {
          if (cancelled) return
          setError({
            message: reason instanceof Error ? reason.message : 'Unexpected Dataverse error.',
            denied: reason instanceof DataverseError && reason.status === 403,
          })
        })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [search, status, skipToken, retry, market])

  function resetPage() {
    setLoading(true)
    setNextToken(undefined)
    setTokens([undefined])
  }

  const statuses: Record<number, string> = {
    126110000: t.draft, 126110001: t.pending, 126110002: t.submitted,
  }

  return (
    <div className="estimate-list">
      <p className="field-help">{t.scope}</p>
      <div className="request-filters">
        <label className="field-label">
          {t.search}
          <input className="text-input" value={search} onChange={(event) => {
            setSearch(event.target.value); resetPage()
          }} type="search" maxLength={150} />
        </label>
        <label className="field-label">
          {t.status}
          <select className="text-input" value={status} onChange={(event) => {
            setStatus(event.target.value); resetPage()
          }}>
            <option value="">{t.all}</option>
            {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      {loading ? <p className="inline-state" role="status">{t.loading}</p> : error ? (
        <div className="error-box" role="alert">
          <strong>{error.denied ? t.denied : t.error}</strong>
          <span>{error.message}</span>
          <button className="button secondary" onClick={() => {
            setLoading(true); setRetry((value) => value + 1)
          }}>{t.retry}</button>
        </div>
      ) : (
        <>
          {records.length === 0 ? <p className="inline-state">{t.empty}</p> : (
            <div className="request-records">
              {records.map((record) => (
                <article className="request-record" key={record.re_repairestimateid}>
                  <div className="request-record-heading">
                    <h3>{record.re_name || record.re_estimatename}</h3>
                    <span className="preview-badge">{statuses[record.re_estimatestatus] ?? t.unknown}</span>
                  </div>
                  <dl className="request-record-details">
                    <div><dt>{t.request}</dt><dd>{record.re_estimatename || '—'}</dd></div>
                    <div><dt>{t.customer}</dt><dd>{record.re_customername || '—'}</dd></div>
                    <div><dt>{t.building}</dt><dd>{record.re_buildingname || '—'}</dd></div>
                    <div><dt>{t.created}</dt><dd>{record.createdon
                      ? new Intl.DateTimeFormat(language === 'fr' ? 'fr-CA' : 'en-US', { dateStyle: 'medium' }).format(new Date(record.createdon))
                      : '—'}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          )}
          <div className="request-pagination">
            <button className="button secondary" disabled={tokens.length === 1} onClick={() => {
              setLoading(true); setTokens((current) => current.slice(0, -1))
            }}>{t.previous}</button>
            <span>{t.page} {tokens.length}</span>
            <button className="button secondary" disabled={!nextToken} onClick={() => {
              if (!nextToken) return
              setLoading(true); setTokens((current) => [...current, nextToken])
            }}>{t.next}</button>
          </div>
        </>
      )}
    </div>
  )
}
