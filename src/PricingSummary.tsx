import { useEffect, useState } from 'react'
import { getSavedPricing } from './data/pricingRepository'
import type { PricingRecord } from './data/pricingContract'
import { formatReportingTime } from './data/reportingTime'
import { pricingUnavailableMessage } from './data/requestValidation'
import { cmiiGaugeShare, pricingComposition } from './data/pricingPresentation'

const pricingIconPaths = {
  overview: 'M4 6c0-4 16-4 16 0s-16 4-16 0m0 0v12c0 4 16 4 16 0V6M4 12c0 4 16 4 16 0',
  tag: 'M3 11V3h8l10 10-8 8L3 11Zm4-4h.01',
  layers: 'm12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5',
  calculator: 'M5 3h14v18H5V3Zm3 4h8M8 11h1m3 0h1m3 0h.01M8 15h1m3 0h1m3 0h.01M8 18h1m3 0h1m3 0h.01',
  target: 'M20 12a8 8 0 1 1-8-8m5 8a5 5 0 1 1-5-5m0 5 9-9m-5 0h5v5',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z',
  chart: 'M4 20v-6h4v6H4Zm6 0V9h4v11h-4Zm6 0V4h4v16h-4Z',
  gift: 'M3 8h18v5H3V8Zm2 5v8h14v-8M12 8v13M12 8C1 8 7-2 12 8Zm0 0C23 8 17-2 12 8Z',
  people: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9v-3c0-5 14-5 14 0v3H2Zm15-16a3 3 0 0 1 0 6m2 3c3 0 3 3 3 6h-3',
  handshake: 'm2 8 4-4 5 2 3-2 8 4-3 9-4 3-5-2-5-5-3-5Zm6 1 4-3 5 4-3 3-3-2m-5 4 5 4m-2-6 7 6',
} as const

function PricingIcon({ name }: { name: keyof typeof pricingIconPaths }) {
  return <span className="pricing-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={pricingIconPaths[name]} />
  </svg></span>
}

type Props = {
  id: string
  version: string | null
  dirty: boolean
  language: 'en' | 'fr'
  currencies: { id: string; code: string }[]
  submitted?: boolean
  calculate: () => Promise<void>
  calculating: boolean
  canCalculate: boolean
  calculationError?: string
  loadPricing?: (id: string, version: string, refresh?: boolean) => Promise<PricingRecord>
}

export function PricingSummary({ id, version, dirty, language, currencies, submitted = false,
  calculate, calculating, canCalculate, calculationError, loadPricing = getSavedPricing }: Props) {
  const [result, setResult] = useState<{ id: string; version: string; row?: PricingRecord; error?: string }>()
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!version) return
    let active = true
    loadPricing(id, version, retry > 0).then(
      (row) => { if (active) setResult({ id, version, row }) },
      (reason: unknown) => {
        if (active) setResult({ id, version, error: reason instanceof Error ? reason.message : String(reason) })
      },
    )
    return () => { active = false }
  }, [id, version, retry, loadPricing])
  const fr = language === 'fr'
  const t = fr ? {
    title: 'Résumé des prix et du CMII', subtitle: 'Résultats enregistrés du calcul Dataverse. Aucun calcul dans le navigateur.',
    unsaved: 'Cliquez sur Calculer pour obtenir les prix et le CMII.',
    stale: 'Modifications non enregistrées : résultats obsolètes. Cliquez sur Recalculer pour utiliser les valeurs actuelles.',
    calculate: 'Calculer', recalculate: 'Recalculer', calculating: 'Calcul en cours…',
    calculateHelp: 'Le calcul enregistre le brouillon et utilise les règles de tarification Dataverse. Il ne soumet pas le devis.',
    required: 'Complétez les champs obligatoires avant de calculer.',
    loading: 'Chargement des prix enregistrés…', retry: 'Réessayer',
    unavailable: 'Calcul des prix indisponible. Vérifiez les données et la configuration avec votre administrateur.',
    notCalculated: 'Aucun calcul enregistré. Cliquez sur Recalculer pour lancer le calcul.',
    error: 'Impossible de charger les prix. Le brouillon enregistré n’est pas modifié.',
    calculationFailed: 'Le calcul n’a pas abouti. Corrigez le problème ci-dessous, puis réessayez.',
    cost: 'Coût réel total', sell: 'Prix de vente saisi', suggested: 'Prix de vente suggéré',
    base: 'CMII cible de base', recommended: 'CMII recommandé', actual: 'CMII réel',
    variance: 'Écart de CMII', am: 'Prime AM', bd: 'Prime BD',
    negative: 'Le prix de vente est inférieur au coût. Vérifiez le prix et justifiez la marge avant toute soumission.',
    footer: 'Calcul enregistré', draft: 'Brouillon uniquement — ni devis approuvé ni soumission.',
    currency: 'La devise du calcul est inconnue. Rechargez les références avant de consulter les montants.',
    overview: 'Vue d’ensemble des prix et des marges', composition: 'Composition du coût',
    compositionHelp: 'Répartition du coût réel total enregistré', breakdown: 'Détail des coûts',
    performance: 'Performance du CMII', performanceHelp: 'Analyse de la marge contributive sur améliorations installées (CMII)',
    incentives: 'Primes', kone: 'Prix suggéré avec pièces KONE',
    package: 'Forfaits', labor: 'Main-d’œuvre', material: 'Matériaux', other: 'Autres ajouts',
    chartHelp: 'Les autres ajouts excluent la main-d’œuvre et les matériaux personnalisés, déjà présentés séparément. La taxe et le fret sont inclus dans leurs coûts enregistrés respectifs.',
    chartUnavailable: 'Répartition indisponible : les composantes enregistrées sont incomplètes ou ne concordent pas avec le coût total.',
    zeroCost: 'Aucun coût à répartir.', gaugeLimit: 'L’arc est limité de 0 à 100 %. La valeur réelle enregistrée est affichée sans limite.',
    noActual: 'Saisissez un prix de vente et recalculez pour obtenir le CMII réel.',
  } : {
    title: 'Pricing & CMII summary', subtitle: 'Saved Dataverse calculation results. No browser-side pricing.',
    unsaved: 'Select Calculate to get pricing and CMII.',
    stale: 'Unsaved changes: results are out of date. Select Recalculate to use your current inputs.',
    calculate: 'Calculate', recalculate: 'Recalculate', calculating: 'Calculating…',
    calculateHelp: 'Calculating saves your draft and uses Dataverse pricing rules. It does not submit the estimate.',
    required: 'Complete the required fields before calculating.',
    loading: 'Loading saved pricing…', retry: 'Retry',
    unavailable: 'Pricing is unavailable. Ask your administrator to check the inputs and configuration.',
    notCalculated: 'No saved calculation. Select Recalculate to run pricing.',
    error: 'Pricing could not be loaded. Your saved draft is unchanged.',
    calculationFailed: 'Calculation did not complete. Resolve the issue below, then try again.',
    cost: 'Total true cost', sell: 'Entered selling price', suggested: 'Suggested selling price',
    base: 'Base target CMII', recommended: 'Recommended CMII', actual: 'Actual CMII',
    variance: 'CMII variance', am: 'AM incentive', bd: 'BD incentive',
    negative: 'Selling price is below cost. Review the price and provide margin justification before submission.',
    footer: 'Saved calculation', draft: 'Draft only — not an approved quote or submission.',
    currency: 'The calculation currency is unknown. Reload reference data before reviewing amounts.',
    overview: 'Pricing & Margin Overview', composition: 'Price Composition',
    compositionHelp: 'Cost build-up for the saved estimate', breakdown: 'Cost Breakdown',
    performance: 'CMII Performance', performanceHelp: 'Contribution Margin on Installed Improvement (CMII) analysis',
    incentives: 'Incentives', kone: 'Suggested price with KONE material',
    package: 'Package', labor: 'Labor', material: 'Material', other: 'Other additional costs',
    chartHelp: 'Other additional costs exclude custom labor and material, shown separately. Tax and freight remain within their respective saved costs.',
    chartUnavailable: 'Composition unavailable: saved components are incomplete or do not reconcile with the total cost.',
    zeroCost: 'No cost to distribute.', gaugeLimit: 'The arc is limited to 0–100%. The actual saved value is displayed without a limit.',
    noActual: 'Enter a selling price and recalculate to obtain actual CMII.',
  }
  const current = result?.id === id && result.version === version ? result : undefined
  const row = current?.row
  const currency = currencies.find((c) => c.id === row?._transactioncurrencyid_value)?.code
  const available = row?.re_calculationversion && row.re_calculationversion !== 'unavailable'
  const locale = fr ? 'fr-CA' : 'en-US'
  const money = (value: number | null | undefined) => value == null ? '—'
    : new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
  const percent = (value: number | null | undefined) => value == null ? '—'
    : new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(value)
  const composition = row ? pricingComposition(row) : null
  const gauge = cmiiGaugeShare(row?.re_actualcmii)
  const compositionLabels = [t.package, t.labor, t.material, t.other]
  function reload() { setResult(undefined); setRetry((n) => n + 1) }
  return <section className="form-card pricing-summary" aria-label={t.title}>
    <div className="pricing-overview-heading">
      <PricingIcon name="overview" /><div><h2>{t.overview}</h2><p>{t.subtitle}</p></div>
      <span className="pricing-draft-badge">{submitted
        ? fr ? 'Devis soumis' : 'Submitted estimate'
        : fr ? 'Calcul du brouillon uniquement — aucune soumission' : 'Draft calculation only — does not submit the estimate'}</span>
    </div>
    <p className="pricing-summary-caption">{t.title}</p>
    {!submitted && <div className="pricing-actions">
      <button type="button" className="button primary pricing-calculate-action"
        disabled={calculating || !canCalculate} aria-busy={calculating}
        aria-describedby="pricing-calculate-help" onClick={() => void calculate()}>
        {calculating ? t.calculating : version ? t.recalculate : t.calculate}
      </button>
      <p className="field-help" id="pricing-calculate-help">{t.calculateHelp}
        {!canCalculate && !calculating && ` ${t.required}`}</p>
    </div>}
    {calculationError && <div className="error-box pricing-calculation-error" role="alert">
      <strong>{t.calculationFailed}</strong>
      <span>{calculationError}</span>
    </div>}
    {dirty && version && <p className="draft-notice" role="status">{t.stale}</p>}
    {!version ? !calculationError && <p className="inline-state" role={calculating ? 'status' : undefined}>
      {calculating ? t.calculating : t.unsaved}
    </p>
      : !current ? <p role="status">{t.loading}</p>
        : current.error ? <div role="alert"><p>{t.error}</p><p>{current.error}</p>
          <button type="button" className="button secondary" onClick={reload}>{t.retry}</button></div>
          : !available ? <p role={row?.re_calculationversion === 'unavailable' ? 'alert' : 'status'}>{row?.re_calculationversion === 'unavailable' ? pricingUnavailableMessage(language) : t.notCalculated}</p>
            : !currency ? <p role="alert">{t.currency}</p>
              : <>
                <dl className="pricing-totals">
                  {([
                    [t.suggested, row.re_suggestedprice, 'tag', 'suggested'],
                    [t.kone, row.re_suggestedpricewithkonematerial, 'layers', 'kone'],
                    [t.cost, row.re_totaltruecost, 'calculator', 'cost'],
                    [t.sell, row.re_sellprice, 'tag', 'entered'],
                  ] as const).map(([label, value, icon, tone]) => <div className={`pricing-kpi pricing-kpi-${tone}`} key={label}>
                    <dt><PricingIcon name={icon} /><span>{label}</span></dt><dd>{money(value)}</dd>
                  </div>)}
                </dl>
                <div className="pricing-dashboard">
                  <section className="pricing-panel pricing-composition" aria-label={t.composition}>
                    <div className="pricing-panel-heading"><PricingIcon name="layers" /><div>
                      <h3>{t.composition}</h3><p>{t.compositionHelp}: {money(row.re_totaltruecost)}</p>
                    </div></div>
                    {composition ? <figure className="pricing-composition-figure">
                      <div className="pricing-composition-bar" aria-hidden="true">
                        {composition.map((part, index) => part.share > 0 && <span key={index}
                          className={`pricing-segment-${index}`} style={{ flexGrow: part.share }}>
                          {part.share >= 0.1 && percent(part.share)}
                        </span>)}
                      </div>
                      <figcaption>
                        <dl className="pricing-composition-legend">{composition.map((part, index) => <div key={compositionLabels[index]}>
                          <dt><i className={`pricing-segment-${index}`} aria-hidden="true" />{compositionLabels[index]}</dt>
                          <dd>{money(part.amount)} <small>({percent(part.share)})</small></dd>
                        </div>)}</dl>
                        <p className="field-help">{row.re_totaltruecost === 0 ? t.zeroCost : t.chartHelp}</p>
                      </figcaption>
                    </figure> : <p className="field-help pricing-chart-unavailable" role="status">{t.chartUnavailable}</p>}
                    <h4 className="pricing-breakdown-heading"><PricingIcon name="calculator" />{t.breakdown}</h4>
                    <dl className="pricing-breakdown">
                      {([
                        [fr ? 'Coût des forfaits' : 'Package estimated cost', row.re_packageestimatedcost],
                        [fr ? 'Main-d’œuvre personnalisée' : 'Custom labor cost', row.re_customlaborcost],
                        [fr ? 'Matériaux personnalisés (avant taxe/fret)' : 'Custom material cost (before tax/freight)', row.re_custommaterialcost],
                        [fr ? 'Ajouts, incluant les coûts personnalisés' : 'Additional costs, including custom costs', row.re_totaladditionalcost],
                        [fr ? 'Taxe' : 'Use tax', row.re_usetaxamount],
                        [fr ? 'Fret' : 'Freight', row.re_freightamount],
                      ] as const).map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>{money(amount)}</dd></div>)}
                    </dl>
                  </section>
                  <section className="pricing-panel pricing-performance" aria-label={t.performance}>
                    <div className="pricing-panel-heading"><PricingIcon name="target" /><div>
                      <h3>{t.performance}</h3><p>{t.performanceHelp}</p>
                    </div></div>
                    <div className="pricing-performance-content">
                      <figure className={`pricing-gauge${row.re_actualcmii != null && row.re_actualcmii < 0 ? ' is-negative' : ''}`}
                        aria-label={`${t.actual}: ${percent(row.re_actualcmii)}`}>
                        <svg viewBox="0 0 220 124" aria-hidden="true">
                          <path className="pricing-gauge-track" d="M20 110a90 90 0 0 1 180 0" pathLength="100" />
                          {gauge != null && gauge > 0 && <path className="pricing-gauge-fill"
                            d="M20 110a90 90 0 0 1 180 0" pathLength="100" strokeDasharray={`${gauge * 100} 100`} />}
                        </svg>
                        <figcaption><strong>{percent(row.re_actualcmii)}</strong><span>{t.actual}</span></figcaption>
                        <div className="pricing-gauge-scale" aria-hidden="true"><span>{percent(0)}</span><span>{percent(1)}</span></div>
                        {gauge == null && <p className="field-help">{t.noActual}</p>}
                        {row.re_actualcmii != null && (row.re_actualcmii < 0 || row.re_actualcmii > 1)
                          && <p className="field-help">{t.gaugeLimit}</p>}
                      </figure>
                      <dl className="pricing-margins">
                        {([
                          [t.base, percent(row.re_basetargetcmii), 'target'],
                          [t.recommended, percent(row.re_recommendedcmii), 'star'],
                          [t.variance, row.re_cmiivariance == null ? '—'
                            : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(row.re_cmiivariance * 100)} ${fr ? 'points de pourcentage' : 'percentage points'}`, 'chart'],
                        ] as const).map(([label, value, icon], index) => <div key={label}
                          className={`pricing-margin-${index}${index === 2 && row.re_cmiivariance != null && row.re_cmiivariance < 0 ? ' is-negative' : ''}`}>
                          <dt><PricingIcon name={icon} />{label}</dt><dd>{value}</dd>
                        </div>)}
                      </dl>
                    </div>
                  </section>
                  <section className="pricing-panel pricing-incentives" aria-label={t.incentives}>
                    <div className="pricing-panel-heading"><PricingIcon name="gift" /><h3>{t.incentives}</h3></div>
                    <dl>{([
                      [t.am, row.re_amincentive, 'people'], [t.bd, row.re_bdincentive, 'handshake'],
                    ] as const).map(([label, amount, icon]) => <div key={label}>
                      <dt><PricingIcon name={icon} />{label}</dt><dd>{money(amount)}</dd>
                    </div>)}</dl>
                  </section>
                </div>
                {row.re_actualcmii != null && row.re_actualcmii < 0 && <p className="draft-notice">{t.negative}</p>}
                <p className="field-help">{t.footer}: {formatReportingTime(row.re_calculatedon!, locale)} · {row.re_calculationversion} · {currency}</p>
              </>}
    <p className="field-help">{submitted
      ? fr ? 'Devis soumis — aucune approbation ni aucun envoi de courriel implicite.' : 'Submitted estimate — not an approval or an email delivery confirmation.'
      : t.draft}</p>
  </section>
}
