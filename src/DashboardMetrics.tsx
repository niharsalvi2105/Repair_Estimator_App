import { useEffect, useState } from 'react'
import { getDashboard } from './data/dashboardRepository'
import type { DashboardRecord } from './data/dashboardContract'
import type { Market } from './data/estimateQuery'
import { formatReportingTime } from './data/reportingTime'

export function DashboardMetrics({ market, owner, language }: {
  market: Market; owner: string | null; language: 'en' | 'fr'
}) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ market: Market; owner: string | null; data?: DashboardRecord; error?: string }>()
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    getDashboard(market, owner).then(
      (data) => { if (active) { setResult({ market, owner, data }); setLoading(false) } },
      (reason: unknown) => {
        if (active) {
          setResult({ market, owner, error: reason instanceof Error ? reason.message : String(reason) })
          setLoading(false)
        }
      },
    )
    return () => { active = false }
  }, [market, owner, attempt])
  const fr = language === 'fr'
  const t = fr ? {
    title: 'Indicateurs réels', scope: `${owner === null ? 'Devis actifs accessibles' : 'Mes devis actifs'} · marché sélectionné · toutes les dates de création`,
    draft: 'Brouillons', totalEstimates: 'Total des devis', submitted: 'Soumis', allStatuses: 'Tous les statuts',
    avg: 'CMII réel moyen', status: 'Répartition par statut', types: 'Répartition par type de travail',
    refresh: 'Actualiser', loading: 'Chargement des indicateurs…', error: 'Impossible de charger les indicateurs.',
    empty: 'Aucun devis pour ce marché.', noMargin: 'Aucun calcul admissible',
    eligible: 'calculs admissibles', definition: 'Moyenne simple des CMII réels calculés avec un prix de vente positif.',
    unassigned: 'Non renseigné', updated: 'Mis à jour', total: 'Total', statusHint: 'Brouillons et devis soumis uniquement. Les devis en attente sont exclus.',
    chartEmpty: 'Aucun brouillon ni devis soumis pour ce marché.',
  } : {
    title: 'Live metrics', scope: `${owner === null ? 'Accessible active estimates' : 'My active estimates'} · selected market · all creation dates`,
    draft: 'Draft', totalEstimates: 'Total estimates', submitted: 'Submitted', allStatuses: 'All statuses',
    avg: 'Average actual CMII', status: 'Status distribution', types: 'Job type distribution',
    refresh: 'Refresh', loading: 'Loading dashboard metrics…', error: 'Dashboard metrics could not be loaded.',
    empty: 'No estimates for this market.', noMargin: 'No eligible calculations',
    eligible: 'eligible calculations', definition: 'Simple average of successfully calculated actual CMII with a positive selling price.',
    unassigned: 'Not specified', updated: 'Updated', total: 'Total', statusHint: 'Draft and Submitted only. Pending estimates are excluded.',
    chartEmpty: 'No Draft or Submitted estimates for this market.',
  }
  const current = result?.market === market && result.owner === owner ? result : undefined
  const data = current?.data
  const busy = loading || !current
  const locale = fr ? 'fr-CA' : 'en-US'
  const number = new Intl.NumberFormat(locale)
  const statusLabels = [t.draft, t.totalEstimates, t.submitted]
  const counts = [126110000, 126110001, 126110002].map((status) =>
    data?.statuses.find((s) => s.status === status)?.count ?? 0)
  const chartIndices = [0, 2]
  const chartTotal = counts[0] + counts[2]
  const icons = [
    'M5 17 17 5M5 5h12v12',
    'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
    'm3 11 18-8-8 18-2-8-8-2Zm8 2 10-10',
    'M5 20V10M12 20V4M19 20v-7',
  ]
  return <section className="dashboard-metrics" aria-label={t.title}>
    <div className="dashboard-metrics-toolbar">
      <p>{t.scope}</p>
      <button className="button metric-refresh" disabled={busy} onClick={() => {
        setLoading(true); setResult(undefined); setAttempt((n) => n + 1)
      }}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3" /></svg>
        {t.refresh}</button>
    </div>
    {busy ? <p role="status">{t.loading}</p>
      : current.error ? <div className="error-box" role="alert"><strong>{t.error}</strong><p>{current.error}</p></div>
        : data && <>
          <div className="dashboard-stats">
            {[1, 0, 2, 3].map((index) => <article className={`dashboard-stat metric-tone-${index}`} key={index}>
              <div className="dashboard-stat-copy"><span>{index === 3 ? t.avg : statusLabels[index]}</span>
                <strong>{index < 3 ? number.format(index === 1 ? data.total : counts[index]) : data.averageCmii == null ? '—'
                  : new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(data.averageCmii)}</strong>
                <small>{index === 1 ? t.allStatuses : index < 3 ? `${number.format(data.total)} ${fr ? 'devis' : 'estimates'}`
                  : data.marginCount ? `${number.format(data.marginCount)} ${t.eligible}` : t.noMargin}</small>
              </div>
              <span className={`dashboard-stat-icon tone-${index}`} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={icons[index]} />
                </svg>
              </span>
            </article>)}
          </div>
          {data.total === 0 ? <p className="inline-state">{t.empty}</p>
            : <div className="dashboard-grid">
              <section className="dashboard-card status-chart-card">
                <div className="dashboard-card-heading"><div><h2>{t.status}</h2><p>{t.statusHint}</p></div></div>
                <div className="status-chart-layout">
                  <div className="status-donut" aria-hidden="true">
                    <svg viewBox="0 0 120 120">
                      <circle className="donut-track" cx="60" cy="60" r="46" fill="none" strokeWidth="20" />
                      {chartTotal > 0 && chartIndices.map((i, index) => <circle key={i} className={`donut-segment segment-${i}`}
                        cx="60" cy="60" r="46" fill="none" strokeWidth="20" pathLength="100"
                        strokeDasharray={`${counts[i] / chartTotal * 100} ${100 - counts[i] / chartTotal * 100}`}
                        strokeDashoffset={-chartIndices.slice(0, index).reduce((sum, previous) => sum + counts[previous], 0) / chartTotal * 100}
                        transform="rotate(-90 60 60)" />)}
                    </svg>
                    <div className="donut-total"><strong>{number.format(chartTotal)}</strong><span>{t.total}</span></div>
                  </div>
                  <ul className="status-legend">{chartIndices.map((i) =>
                    <li key={i}><span className={`legend-swatch segment-${i}`} aria-hidden="true" />
                      <span>{statusLabels[i]}</span><strong>{number.format(counts[i])}</strong>
                      <meter className="status-accessible-meter" min={0} max={chartTotal || 1} value={counts[i]} aria-label={statusLabels[i]} />
                    </li>)}
                  </ul>
                </div>
                {chartTotal === 0 && <p className="inline-state">{t.chartEmpty}</p>}
              </section>
              <section className="dashboard-card job-chart-card">
                <div className="dashboard-card-heading"><div><h2>{t.types}</h2><p>{t.scope}</p></div></div>
                <ul className="metric-bars">{[...data.jobTypes].sort((a, b) => b.count - a.count).map((type) => {
                  const label = type.id == null ? t.unassigned : (fr && type.fr?.trim() ? type.fr : type.en)!
                  return <li key={type.id ?? 'unassigned'}><span>{label}</span>
                    <strong>{new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(type.count / data.total)}
                      <small> ({number.format(type.count)})</small></strong>
                    <meter min={0} max={data.total} value={type.count} aria-label={label} /></li>
                })}</ul>
              </section>
            </div>}
          <p className="field-help">{t.definition}</p>
          <p className="field-help">{t.updated}: {formatReportingTime(data.generatedAt, locale)}</p>
        </>}
  </section>
}
