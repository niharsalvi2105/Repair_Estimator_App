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
    scope: 'Only records allowed by your Dataverse permissions are returned.',
    open: 'Open draft',
  },
  fr: {
    search: 'Rechercher par début de numéro, client ou immeuble',
    status: 'État', all: 'Tous les états', loading: 'Chargement des demandes…',
    empty: 'Aucune demande accessible ne correspond aux filtres.',
    error: 'Impossible de charger les demandes.', denied: 'Dataverse a refusé l’accès à ces demandes.',
    retry: 'Réessayer', previous: 'Précédent', next: 'Suivant', page: 'Page',
    request: 'Demande', customer: 'Client', building: 'Immeuble', created: 'Création',
    draft: 'Brouillon', pending: 'En attente', submitted: 'Envoyée', unknown: 'État inconnu',
    scope: 'Seules les demandes autorisées par Dataverse sont affichées.',
    open: 'Ouvrir le brouillon',
  },
}

export function EstimateList(props: {
  language: 'en' | 'fr'; market: Market; onOpen?: (id: string) => void; busy?: boolean; search?: string; recent?: boolean
}) {
  const [status, setStatus] = useState('')
  return <PagedEstimateList key={`${props.market}:${props.search ?? ''}:${status}`} {...props}
    status={status} onStatusChange={setStatus} />
}

function PagedEstimateList({ language, market, onOpen, busy = false, search = '', status, onStatusChange, recent = false }: {
  language: 'en' | 'fr'; market: Market; onOpen?: (id: string) => void; busy?: boolean; search?: string
  status: string; onStatusChange: (value: string) => void
  recent?: boolean
}) {
  const t = text[language]
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

  const statuses: Record<number, string> = {
    126110000: t.draft, 126110001: t.pending, 126110002: t.submitted,
  }

  return (
    <div className={`estimate-list${recent ? ' recent-estimate-list' : ''}`}>
      {!recent && <><p className="field-help">{t.scope}</p>
      <div className="request-filters">
        {search && <p className="field-help">{t.search}: <strong>{search}</strong></p>}
        <label className="field-label">
          {t.status}
          <select className="text-input" value={status} onChange={(event) => {
            onStatusChange(event.target.value)
          }}>
            <option value="">{t.all}</option>
            {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div></>}
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
              {recent && <div className="recent-column-headings" aria-hidden="true">
                <span>{t.request}</span><span>{t.customer}</span><span>{t.building}</span>
                <span>{t.created}</span><span>{t.status}</span><span>Action</span>
              </div>}
              {(recent ? records.slice(0, 5) : records).map((record) => (
                <article className="request-record" key={record.re_repairestimateid}>
                  <div className="request-record-heading">
                    <h3>{record.re_name || record.re_estimatename}
                      {recent && record.re_name && <small>{record.re_estimatename}</small>}
                    </h3>
                    <div className="request-record-actions">
                      <span className="preview-badge">{statuses[record.re_estimatestatus] ?? t.unknown}</span>
                      {record.re_estimatestatus === 126110000 && onOpen && (
                        <button className="button secondary" disabled={busy}
                          onClick={() => onOpen(record.re_repairestimateid)}>{t.open}</button>
                      )}
                    </div>
                  </div>
                  <dl className="request-record-details">
                    {!recent && <div><dt>{t.request}</dt><dd>{record.re_estimatename || '—'}</dd></div>}
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
          {!recent && <div className="request-pagination">
            <button className="button secondary" disabled={tokens.length === 1} onClick={() => {
              setLoading(true); setTokens((current) => current.slice(0, -1))
            }}>{t.previous}</button>
            <span>{t.page} {tokens.length}</span>
            <button className="button secondary" disabled={!nextToken} onClick={() => {
              if (!nextToken) return
              setLoading(true); setTokens((current) => [...current, nextToken])
            }}>{t.next}</button>
          </div>}
        </>
      )}
    </div>
  )
}
