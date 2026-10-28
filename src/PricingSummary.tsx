import { useEffect, useState } from 'react'
import { getSavedPricing } from './data/pricingRepository'
import type { PricingRecord } from './data/pricingContract'
import { formatReportingTime } from './data/reportingTime'
import { pricingUnavailableMessage } from './data/requestValidation'

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
}

export function PricingSummary({ id, version, dirty, language, currencies, submitted = false,
  calculate, calculating, canCalculate }: Props) {
  const [result, setResult] = useState<{ id: string; version: string; row?: PricingRecord; error?: string }>()
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!version) return
    let active = true
    getSavedPricing(id, version).then(
      (row) => { if (active) setResult({ id, version, row }) },
      (reason: unknown) => {
        if (active) setResult({ id, version, error: reason instanceof Error ? reason.message : String(reason) })
      },
    )
    return () => { active = false }
  }, [id, version, retry])
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
    cost: 'Coût réel total', sell: 'Prix de vente saisi', suggested: 'Prix de vente suggéré',
    base: 'CMII cible de base', recommended: 'CMII recommandé', actual: 'CMII réel',
    variance: 'Écart de CMII', am: 'Prime AM', bd: 'Prime BD',
    negative: 'Le prix de vente est inférieur au coût. Vérifiez le prix et justifiez la marge avant toute soumission.',
    footer: 'Calcul enregistré', draft: 'Brouillon uniquement — ni devis approuvé ni soumission.',
    currency: 'La devise du calcul est inconnue. Rechargez les références avant de consulter les montants.',
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
    cost: 'Total true cost', sell: 'Entered selling price', suggested: 'Suggested selling price',
    base: 'Base target CMII', recommended: 'Recommended CMII', actual: 'Actual CMII',
    variance: 'CMII variance', am: 'AM incentive', bd: 'BD incentive',
    negative: 'Selling price is below cost. Review the price and provide margin justification before submission.',
    footer: 'Saved calculation', draft: 'Draft only — not an approved quote or submission.',
    currency: 'The calculation currency is unknown. Reload reference data before reviewing amounts.',
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
  function reload() { setResult(undefined); setRetry((n) => n + 1) }
  return <section className="form-card pricing-summary" aria-label={t.title}>
    <div className="section-heading"><div><h2>{t.title}</h2><p>{t.subtitle}</p></div></div>
    {!submitted && <div>
      <button type="button" className="button primary pricing-calculate-action"
        disabled={calculating || !canCalculate} aria-busy={calculating}
        aria-describedby="pricing-calculate-help" onClick={() => void calculate()}>
        {calculating ? t.calculating : version ? t.recalculate : t.calculate}
      </button>
      <p className="field-help" id="pricing-calculate-help">{t.calculateHelp}
        {!canCalculate && !calculating && ` ${t.required}`}</p>
    </div>}
    {dirty && version && <p className="draft-notice" role="status">{t.stale}</p>}
    {!version ? <p className="inline-state">{t.unsaved}</p>
      : !current ? <p role="status">{t.loading}</p>
        : current.error ? <div role="alert"><p>{t.error}</p><p>{current.error}</p>
          <button type="button" className="button secondary" onClick={reload}>{t.retry}</button></div>
          : !available ? <p role={row?.re_calculationversion === 'unavailable' ? 'alert' : 'status'}>{row?.re_calculationversion === 'unavailable' ? pricingUnavailableMessage(language) : t.notCalculated}</p>
            : !currency ? <p role="alert">{t.currency}</p>
              : <>
                <dl className="pricing-totals">
                  {([
                    [t.cost, money(row.re_totaltruecost)], [t.sell, money(row.re_sellprice)],
                    [t.suggested, money(row.re_suggestedprice)],
                    ...(row.re_suggestedpricewithkonematerial != null
                      ? [[fr ? 'Prix suggéré avec pièces KONE' : 'Suggested price with KONE material', money(row.re_suggestedpricewithkonematerial)]] : []),
                  ]).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
                </dl>
                <dl className="pricing-margins">
                  {([
                    [fr ? 'Coût des forfaits' : 'Package estimated cost', row.re_packageestimatedcost],
                    [fr ? 'Main-d’œuvre personnalisée' : 'Custom labor cost', row.re_customlaborcost],
                    [fr ? 'Matériaux personnalisés (avant taxe/fret)' : 'Custom material cost (before tax/freight)', row.re_custommaterialcost],
                    [fr ? 'Ajouts, incluant les coûts personnalisés' : 'Additional costs, including custom costs', row.re_totaladditionalcost],
                    [fr ? 'Taxe' : 'Use tax', row.re_usetaxamount],
                    [fr ? 'Fret' : 'Freight', row.re_freightamount],
                  ] as const).map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>{money(amount)}</dd></div>)}
                </dl>
                <dl className="pricing-margins">
                  {([
                    [t.base, percent(row.re_basetargetcmii)], [t.recommended, percent(row.re_recommendedcmii)],
                    [t.actual, percent(row.re_actualcmii)],
                    [t.variance, row.re_cmiivariance == null ? '—'
                      : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(row.re_cmiivariance * 100)} ${fr ? 'points de pourcentage' : 'percentage points'}`],
                    [t.am, money(row.re_amincentive)], [t.bd, money(row.re_bdincentive)],
                  ]).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
                </dl>
                {row.re_actualcmii != null && row.re_actualcmii < 0 && <p className="draft-notice">{t.negative}</p>}
                <p className="field-help">{t.footer}: {formatReportingTime(row.re_calculatedon!, locale)} · {row.re_calculationversion} · {currency}</p>
              </>}
    <p className="field-help">{submitted
      ? fr ? 'Devis soumis — aucune approbation ni aucun envoi de courriel implicite.' : 'Submitted estimate — not an approval or an email delivery confirmation.'
      : t.draft}</p>
  </section>
}
