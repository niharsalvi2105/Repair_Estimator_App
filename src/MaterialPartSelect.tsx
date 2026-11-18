import { useEffect, useId, useRef, useState } from 'react'
import type { DraftMaterial } from './data/draftContract'
import type { Market } from './data/estimateQuery'
import { getPartCatalog, type CatalogDetails, type CatalogIssue, type CatalogPart, type CatalogResult } from './data/partCatalogRepository'
import { FieldError } from './FieldError'

const issueLabels: Record<CatalogIssue, [string, string]> = {
  inactive: ['Inactive source record', 'Enregistrement source inactif'],
  'missing-valid-from': ['Missing effective-from date', 'Date de début d’effet manquante'],
  future: ['Not yet effective', 'Pas encore en vigueur'],
  expired: ['Expired', 'Expiré'],
  'missing-source-key': ['Missing source key', 'Clé source manquante'],
  'missing-source-version': ['Missing source version', 'Version source manquante'],
  'missing-refreshed-on': ['Missing refresh timestamp', 'Date d’actualisation manquante'],
  'missing-description': ['Missing source description', 'Description source manquante'],
  'missing-uom': ['Missing source unit of measure', 'Unité de mesure source manquante'],
  'invalid-source-currency': ['Invalid source currency', 'Devise source invalide'],
  'unsupported-pricing-unit': ['Unsupported pricing unit', 'Unité de tarification non prise en charge'],
  'invalid-cost': ['Invalid source cost', 'Coût source invalide'],
  'invalid-price': ['Invalid source selling price', 'Prix de vente source invalide'],
  'invalid-master-type': ['Invalid master classification', 'Classification maître invalide'],
  'invalid-converted-cost': ['Invalid converted unit cost', 'Coût unitaire converti invalide'],
  'invalid-converted-price': ['Invalid converted unit price', 'Prix unitaire converti invalide'],
}

const detailLabels: Record<string, [string, string]> = {
  number: ['Part number', 'Numéro de pièce'], masterPartType: ['Master classification', 'Classification maître'],
  state: ['Source state', 'État source'], sourceCost: ['Source cost', 'Coût source'],
  sourcePrice: ['Source selling price', 'Prix de vente source'], pricingUnit: ['Pricing unit', 'Unité de tarification'],
  sourceCurrency: ['Source currency', 'Devise source'], sourceKey: ['Source key', 'Clé source'],
  sourceVersion: ['Source version', 'Version source'], description: ['Source description', 'Description source'],
  descriptionFr: ['Source French description', 'Description source française'], uom: ['Source unit of measure', 'Unité de mesure source'],
  effectiveFrom: ['Effective from', 'Date de début d’effet'], effectiveTo: ['Effective to', 'Date de fin d’effet'],
  refreshedOn: ['Refreshed on', 'Actualisé le'], salesOrganization: ['Sales organization', 'Organisation commerciale'],
  distributionChannel: ['Distribution channel', 'Canal de distribution'],
  conditionRecord: ['Condition record', 'Enregistrement de condition'], unitCost: ['Converted unit cost', 'Coût unitaire converti'],
  unitPrice: ['Converted unit price', 'Prix unitaire converti'],
}

function sourceValue(value: unknown): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'number') return String(value)
  return String(value)
}

function issueText(issue: CatalogIssue, fr: boolean): string {
  return issueLabels[issue][fr ? 1 : 0]
}

function detailsRows(details: CatalogDetails, fr: boolean, currency?: string) {
  return Object.entries(detailLabels).map(([key, labels]) => {
    let value = sourceValue(details[key as keyof CatalogDetails])
    const valueCurrency = key === 'sourceCost' || key === 'sourcePrice' ? details.sourceCurrency : currency
    if (['sourceCost', 'sourcePrice', 'unitCost', 'unitPrice'].includes(key) && value !== '—' && valueCurrency)
      value += ` ${valueCurrency}`
    if (key === 'masterPartType' && value === '—') value = fr ? 'Non classé' : 'Unclassified'
    if (key === 'state' && details.state != null) value += details.state === 0 ? (fr ? ' (actif)' : ' (active)') : (fr ? ' (inactif)' : ' (inactive)')
    return <div key={key}><dt>{labels[fr ? 1 : 0]}</dt><dd>{value}</dd></div>
  })
}

function IssueList({ issues, language }: { issues: CatalogIssue[]; language: 'en' | 'fr' }) {
  if (!issues.length) return <p className="field-help">{language === 'fr' ? 'Aucun problème source signalé.' : 'No source issues reported.'}</p>
  return <ul className="catalog-issue-list">{issues.map(issue => <li key={issue}>{issueText(issue, language === 'fr')}</li>)}</ul>
}

function CatalogSourceDetails({ details, language, currency }: {
  details: CatalogDetails; language: 'en' | 'fr'; currency?: string
}) {
  const fr = language === 'fr'
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  return <>
    <div className="catalog-source-action">
      <button type="button" className="button tertiary small" aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}>
        {fr ? 'Afficher les détails source' : 'View source details'}
      </button>
      {details.issues.length > 0 && <span className="catalog-source-issue-count">
        {details.issues.length} {fr ? 'problèmes source' : 'source issues'}
      </span>}
    </div>
    <dialog ref={dialog} className="catalog-source-dialog" aria-labelledby={titleId}>
      <header className="catalog-source-dialog-header">
        <div>
          <p className="catalog-source-dialog-kicker">{fr ? 'Preuve du catalogue' : 'Catalog evidence'}</p>
          <h2 id={titleId}>{fr ? 'Valeurs et diagnostic source (lecture seule)' : 'Source values and diagnostics (read-only)'}</h2>
        </div>
        <button type="button" className="button secondary small" onClick={() => dialog.current?.close()}>
          {fr ? 'Fermer' : 'Close'}
        </button>
      </header>
      <div className="catalog-source-dialog-body">
        <section className="catalog-source-details" aria-label={fr ? 'Détails source du catalogue' : 'Catalog source details'}>
          <dl>{detailsRows(details, fr, currency)}</dl>
          <h3>{fr ? 'Raisons et avertissements' : 'Reasons and warnings'}</h3>
          <IssueList issues={details.issues} language={language} />
          {(details.requiresCost || details.requiresSellingPrice || details.requiresDescription || details.requiresUom) &&
            <ul className="catalog-requirements">
              {details.requiresCost && <li>{fr ? 'Coût source inutilisable : saisissez un coût estimatif.' : 'Source cost unusable: enter an estimate-only cost.'}</li>}
              {details.requiresSellingPrice && <li>{fr ? 'Prix source inutilisable : saisissez un prix de vente estimatif.' : 'Source selling price unusable: enter an estimate-only selling price.'}</li>}
              {details.requiresDescription && <li>{fr ? 'Description source manquante : complétez la description pour ce devis.' : 'Source description missing: complete the estimate-only description.'}</li>}
              {details.requiresUom && <li>{fr ? 'Unité source manquante : complétez l’unité de mesure pour ce devis.' : 'Source UOM missing: complete the estimate-only unit of measure.'}</li>}
            </ul>}
        </section>
      </div>
    </dialog>
  </>
}

export function MaterialPartSelect({ line, update, market, language, capability, readOnly, field, showValidationErrors = false }: {
  line: DraftMaterial; update: (change: Partial<DraftMaterial>) => void; market: Market
  language: 'en' | 'fr'; capability?: CatalogResult; readOnly: boolean
  field?: 'type' | 'part' | 'details'; showValidationErrors?: boolean
}) {
  const fr = language === 'fr'
  const [query, setQuery] = useState<string>()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [searchAttempt, setSearchAttempt] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const typed = (query ?? line.part).trim()
  const [search, setSearch] = useState<{ key: string; result?: CatalogResult; error?: string; moreError?: string }>()
  const key = `${market}:${typed}`
  useEffect(() => {
    if (!open || !capability?.available || readOnly) return
    let active = true
    const timer = setTimeout(() => {
      setSearch({ key })
      getPartCatalog(market, typed).then(
        result => { if (active) setSearch({ key, result }) },
        (reason: unknown) => { if (active) setSearch({ key, error: reason instanceof Error ? reason.message : String(reason) }) },
      )
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [capability?.available, key, market, open, typed, readOnly, searchAttempt])
  const current = search?.key === key ? search : undefined
  const parts = capability?.available && current?.result?.available ? current.result.parts : []
  const activePart = parts[Math.min(activeIndex, Math.max(0, parts.length - 1))]
  const partErrorId = `${listId}-part`
  const catalogErrorId = `${listId}-catalog`
  const partError = showValidationErrors && !line.part.trim()
  const needsKoneCatalog = line.partType === 'kone' && line.pricingSource !== 'package' && !line.catalogPartId
  useEffect(() => {
    if (open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  function choose(part: CatalogPart) {
    update({ catalogPartId: part.id, catalogDetails: part.details, description: part.description, part: part.number,
      vendor: line.partType === 'kone' ? 'KONE' : '', unitCost: part.unitCost ?? 0,
      unitPrice: part.unitPrice, sellingPrice: undefined, uom: part.uom, refreshPart: true, pricingSource: undefined,
      markupPercent: line.partType === 'kone' ? 10 : undefined })
    setQuery(undefined)
    setOpen(false)
    input.current?.focus()
  }

  async function loadMore() {
    if (!current?.result || loadingMore || !current.result.more) return
    setLoadingMore(true)
    try {
      const next = await getPartCatalog(market, typed, current.result.nextPage ?? undefined, current.result.nextCursor ?? undefined)
      if (!next.available) throw new Error(next.reason)
      if (next.parts.some(part => parts.some(loaded => loaded.id === part.id)))
        throw new Error(fr ? 'Résultats en double. Relancez la recherche.' : 'Duplicate catalog results. Restart the search.')
      setSearch(previous => previous?.key === key ? { key, result: { ...next, parts: [...parts, ...next.parts] } } : previous)
    } catch (reason) {
      setSearch(previous => previous?.key === key
        ? { ...previous, moreError: reason instanceof Error ? reason.message : String(reason) } : previous)
    } finally { setLoadingMore(false) }
  }

  const money = (value: number | null) => value == null
    ? (fr ? 'Indisponible' : 'Unavailable')
    : `${value.toLocaleString(fr ? 'fr-CA' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 10 })}${capability?.currency ? ` ${capability.currency}` : ''}`

  return <>
    {(!field || field === 'type') && <label className="field-label">
      <span className={field ? 'custom-cell-label' : undefined}>{fr ? 'Type de pièce' : 'Part type'}</span>
      <select className="text-input" aria-label={fr ? 'Type de pièce' : 'Part type'} value={line.partType ?? ''} disabled={readOnly}
        onChange={event => {
          const partType = event.target.value === 'kone' ? 'kone' : event.target.value === 'non-kone' ? 'non-kone' : undefined
          update({ partType, vendor: partType === 'kone' ? 'KONE' : '', markupPercent: partType === 'kone' ? 10 : undefined,
            pricingSource: partType === 'kone' || line.catalogPartId ? undefined : line.pricingSource })
        }}>
        {!line.partType && <option value="">{fr ? 'Choisir le type' : 'Select type'}</option>}
        <option value="kone">KONE</option><option value="non-kone">Non-KONE</option>
      </select>
      {line.catalogDetails?.masterPartType != null && <span className="field-help">
        {fr ? 'Ce type contrôle le calcul; classification maître (preuve source) : ' : 'This controls estimate classification; master type (source evidence): '}
        {line.catalogDetails.masterPartType}
      </span>}
      {!line.catalogDetails?.masterPartType && <span className="field-help">
        {fr ? 'Ce type contrôle la classification du devis; la classification maître reste une preuve source.' : 'This type controls estimate classification; master classification remains source evidence.'}
      </span>}
    </label>}
    {(!field || field === 'part') && line.partType && <div className="field-label">
      <label className={field ? 'custom-cell-label' : undefined} htmlFor={`${listId}-input`}>{fr ? 'Numéro de pièce' : 'Part number'}</label>
      <div className="branch-combobox" onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}>
        <div className="branch-combobox-control">
          <input ref={input} id={`${listId}-input`} className="text-input" required role="combobox" maxLength={100}
            value={query ?? line.part} disabled={readOnly} autoComplete="off" aria-expanded={open} aria-controls={listId}
            aria-autocomplete="list" aria-activedescendant={open && activePart ? `${listId}-${activePart.id}` : undefined}
            aria-invalid={showValidationErrors && (!!partError || needsKoneCatalog)}
            aria-describedby={showValidationErrors && partError ? `${partErrorId}-error`
              : showValidationErrors && needsKoneCatalog ? `${catalogErrorId}-error` : undefined}
            placeholder={fr ? 'Rechercher ou parcourir les pièces' : 'Search or browse parts'}
            onClick={() => { setActiveIndex(0); setOpen(true) }}
            onChange={event => {
              const value = event.target.value
              setQuery(value); setActiveIndex(0); setOpen(true)
              update({ part: value, catalogPartId: undefined, catalogDetails: undefined, unitPrice: undefined,
                sellingPrice: undefined, uom: undefined, refreshPart: false,
                ...(line.catalogPartId || line.partType === 'kone' ? { unitCost: 0, description: '', vendor: '' } : {}) })
            }}
            onKeyDown={event => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                if (!open) { setOpen(true); setActiveIndex(0) }
                else setActiveIndex(index => Math.max(0, Math.min(parts.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))))
              } else if (event.key === 'Enter' && open) {
                event.preventDefault()
                if (activePart) choose(activePart)
              } else if (event.key === 'Escape') {
                event.preventDefault(); setOpen(false)
              } else if (event.key === 'Tab') setOpen(false)
            }} />
          <button type="button" className="branch-dropdown-toggle" disabled={readOnly} aria-label={fr ? 'Parcourir les pièces' : 'Browse parts'}
            aria-expanded={open} aria-controls={listId} onMouseDown={event => event.preventDefault()}
            onClick={() => { setOpen(!open); setActiveIndex(0); input.current?.focus() }}><span aria-hidden="true">▾</span></button>
        </div>
        {open && <div className="branch-popup">
          <p className="field-help" role="status">{!capability?.available
            ? (fr ? 'Catalogue indisponible. Les entrées manuelles restent disponibles.' : 'Catalog unavailable. Manual entries remain available.')
            : !current?.result && !current?.error ? (fr ? 'Recherche des pièces…' : 'Searching parts…')
              : current.result?.more ? (fr ? `${parts.length} résultats chargés. Faites défiler ou affinez la recherche.` : `${parts.length} results loaded. Browse or refine the search.`)
                : (fr ? `${parts.length} pièces trouvées.` : `${parts.length} parts found.`)}</p>
          {current?.error && <div className="error-box" role="alert"><p>{current.error}</p>
            <button type="button" className="button secondary small"
              onClick={() => { input.current?.focus(); setSearch(undefined); setSearchAttempt(attempt => attempt + 1) }}>
              {fr ? 'Réessayer' : 'Retry part search'}
            </button></div>}
          {current?.result && !current.result.available && <p className="error-box" role="alert">{current.result.reason}</p>}
          <ul id={listId} ref={list} role="listbox" aria-label={fr ? 'Pièces du catalogue' : 'Catalog parts'}>
            {parts.map((part, index) => <li key={part.id} id={`${listId}-${part.id}`} role="option"
              aria-selected={line.catalogPartId === part.id} data-active={index === activeIndex}>
              <button type="button" tabIndex={-1} className="package-option" onMouseDown={event => event.preventDefault()}
                onClick={() => choose(part)}>
                <span className="package-option-body"><strong>{part.number}</strong><span>{part.description || (fr ? 'Description indisponible' : 'Description unavailable')}</span>
                  <span>{fr ? 'Classification maître' : 'Master type'}: {part.details.masterPartType || (fr ? 'Non classé' : 'Unclassified')} ·
                    {' '}{fr ? 'État' : 'State'}: {sourceValue(part.details.state)} · {fr ? 'Coût' : 'Cost'}: {money(part.unitCost)} ·
                    {' '}{fr ? 'Prix VK13' : 'VK13'}: {money(part.unitPrice)} · UOM: {part.uom || '—'}</span>
                  {part.details.issues.length > 0 && <span className="catalog-issue-list">{part.details.issues.map(issue => issueText(issue, fr)).join(' · ')}</span>}
                </span>
              </button>
            </li>)}
          </ul>
          {current?.result?.more && <button type="button" className="button secondary small" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? (fr ? 'Chargement…' : 'Loading…') : (fr ? 'Charger plus' : 'Load more')}
          </button>}
          {current?.moreError && <p className="error-box" role="alert">{current.moreError}</p>}
        </div>}
      </div>
    </div>}
    {(!field || field === 'part') && <FieldError id={partErrorId} message={partError
      ? fr ? 'Saisissez un numéro de pièce.' : 'Enter a part number.'
      : undefined} />}
    {(!field || field === 'part') && line.partType === 'non-kone' && !line.catalogPartId &&
      <p className="field-help">{fr
        ? 'Les numéros de pièce non-KONE hors catalogue sont permis. Saisissez une description et un coût unitaire.'
        : 'Unlisted Non-KONE part numbers are allowed. Enter a description and unit cost.'}</p>}
    {(!field || field === 'part') && !readOnly && line.partType === 'non-kone' && line.catalogPartId &&
      <button type="button" className="button tertiary" onClick={() => {
        setQuery(undefined); setOpen(false)
        update({ catalogPartId: undefined, catalogDetails: undefined, unitPrice: undefined, sellingPrice: undefined,
          uom: undefined, unitCost: 0, part: '', description: '', refreshPart: false, pricingSource: undefined })
      }}>{fr ? 'Retirer la sélection du catalogue' : 'Remove catalog selection'}</button>}
    {(!field || field === 'part') && needsKoneCatalog && <p id={`${catalogErrorId}-error`} className="error-box" role="alert">
      {fr ? 'Choisissez une pièce KONE du catalogue avant d’enregistrer.' : 'Select a KONE catalog part before saving.'}</p>}
    {(!field || field === 'part') && !readOnly && line.partType === 'non-kone' && !line.catalogPartId &&
      !capability?.available && <button type="button" className="button tertiary"
        onClick={() => update({ pricingSource: 'manual', refreshPart: false })}>
        {fr ? 'Utiliser la saisie manuelle sans catalogue' : 'Use manual entry without catalog'}
      </button>}
    {(!field || field === 'details') && line.partType === 'kone' && line.pricingSource !== 'package' &&
      <div className="custom-material-markup">
        <strong>{fr ? 'Majoration KONE' : 'KONE markup'}</strong>
        <output className="custom-material-markup-value" aria-label={fr ? 'Majoration KONE fixe' : 'Fixed KONE markup'}>
          {readOnly ? line.markupPercent ?? 10 : 10}%
        </output>
        <span className="field-help">{fr ? '10 % du prix de vente effectif, jamais du coût.' : '10% of effective selling price, never cost.'}</span>
      </div>}
    {(!field || field === 'details') && line.catalogDetails?.requiresUom && <label className="field-label">
      {fr ? 'Unité de mesure (complément de ce devis)' : 'Unit of measure (estimate completion)'}
      <input className="text-input" required maxLength={20} value={line.uom ?? ''} disabled={readOnly}
        onChange={event => update({ uom: event.target.value })} />
    </label>}
    {(!field || field === 'details') && line.catalogDetails &&
      <CatalogSourceDetails details={line.catalogDetails} language={language} currency={capability?.currency} />}
    {(!field || field === 'details') && line.catalogPartId && !line.catalogDetails && <p className="draft-notice" role="status">
      {fr
        ? 'Ancienne sélection de catalogue : diagnostics source détaillés indisponibles. Resélectionnez la pièce pour les actualiser.'
        : 'Legacy catalog selection: detailed source diagnostics unavailable. Reselect the part to refresh them.'}
    </p>}
  </>
}
