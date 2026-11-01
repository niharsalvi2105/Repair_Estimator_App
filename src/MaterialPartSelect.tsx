import { useEffect, useId, useRef, useState } from 'react'
import type { DraftMaterial } from './data/draftContract'
import type { Market } from './data/estimateQuery'
import { getPartCatalog, type CatalogPart, type CatalogResult } from './data/partCatalogRepository'

export function MaterialPartSelect({ line, update, market, language, capability, readOnly }: {
  line: DraftMaterial; update: (change: Partial<DraftMaterial>) => void; market: Market
  language: 'en' | 'fr'; capability?: CatalogResult; readOnly: boolean
}) {
  const fr = language === 'fr'
  const [query, setQuery] = useState<string>()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [searchAttempt, setSearchAttempt] = useState(0)
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const typed = (query ?? line.part).trim()
  const [search, setSearch] = useState<{ key: string; result?: CatalogResult; error?: string }>()
  const key = `${market}:${line.partType}:${typed}`
  useEffect(() => {
    if (!open || !capability?.available || !line.partType || typed.length < 2 || readOnly) return
    let active = true
    const timer = setTimeout(() => {
      getPartCatalog(market, typed, line.partType ?? undefined).then(
        (result) => { if (active) setSearch({ key, result }) },
        (reason: unknown) => { if (active) setSearch({ key, error: reason instanceof Error ? reason.message : String(reason) }) },
      )
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [capability?.available, key, line.partType, market, open, typed, readOnly, searchAttempt])
  const current = search?.key === key ? search : undefined
  const parts = capability?.available && current?.result?.available ? current.result.parts : []
  const activePart = parts[Math.min(activeIndex, Math.max(0, parts.length - 1))]
  useEffect(() => {
    if (open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])
  function choose(part: CatalogPart) {
    update({ catalogPartId: part.id, description: part.description, part: part.number,
      vendor: part.partType === 'kone' ? 'KONE' : '', unitCost: part.unitCost,
      unitPrice: part.unitPrice, uom: part.uom, refreshPart: true,
      markupPercent: part.partType === 'kone' ? line.markupPercent ?? capability?.defaultMarkupPercent : undefined })
    setQuery(undefined)
    setOpen(false)
    input.current?.focus()
  }
  const money = (value: number) => `${value.toLocaleString(fr ? 'fr-CA' : 'en-US',
    { minimumFractionDigits: 2, maximumFractionDigits: 10 })}${capability?.currency ? ` ${capability.currency}` : ''}`
  return <>
    <label className="field-label">{fr ? 'Type de pièce' : 'Part type'}
      <select className="text-input" value={line.partType ?? ''} disabled={readOnly}
        onChange={(event) => {
          setQuery(undefined)
          setOpen(false)
          const partType = event.target.value === 'kone' ? 'kone' : event.target.value === 'non-kone' ? 'non-kone' : undefined
          update({ partType, catalogPartId: undefined, part: '', description: '', vendor: '',
            unitCost: 0, unitPrice: undefined, uom: undefined, refreshPart: false,
            markupPercent: partType === 'kone' ? capability?.defaultMarkupPercent : undefined })
        }}>
        {!line.partType && <option value="">{fr ? 'Saisie manuelle existante' : 'Existing manual entry'}</option>}
        <option value="kone">KONE</option><option value="non-kone">Non-KONE</option>
      </select>
    </label>
    {line.partType && <>
      <div className="field-label">
        <label htmlFor={`${listId}-input`}>{fr ? 'Numéro de pièce' : 'Part number'}</label>
        <div className="branch-combobox" onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
        }}>
          <div className="branch-combobox-control">
            <input ref={input} id={`${listId}-input`} className="text-input" required role="combobox"
              maxLength={100} value={query ?? line.part} disabled={readOnly} autoComplete="off"
              aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
              aria-activedescendant={open && activePart ? `${listId}-${activePart.id}` : undefined}
              placeholder={fr ? 'Rechercher par numéro ou description' : 'Search by part number or description'}
              onClick={() => { setActiveIndex(0); setOpen(true) }}
              onChange={(event) => {
                const value = event.target.value
                setQuery(value); setActiveIndex(0); setOpen(true)
                update({ part: value, catalogPartId: undefined, unitPrice: undefined, uom: undefined, refreshPart: false,
                  ...(line.catalogPartId || line.partType === 'kone' ? { unitCost: 0, description: '', vendor: '' } : {}) })
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  if (!open) { setOpen(true); setActiveIndex(0) }
                  else setActiveIndex((index) => Math.max(0, Math.min(parts.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))))
                } else if (event.key === 'Enter' && open) {
                  event.preventDefault()
                  if (activePart) choose(activePart)
                } else if (event.key === 'Escape') {
                  event.preventDefault(); setOpen(false)
                } else if (event.key === 'Tab') setOpen(false)
              }} />
            <button type="button" className="branch-dropdown-toggle" disabled={readOnly}
              aria-label={fr ? 'Rechercher une pièce' : 'Search parts'} aria-expanded={open} aria-controls={listId}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { setOpen(!open); setActiveIndex(0); input.current?.focus() }}>
              <span aria-hidden="true">▾</span>
            </button>
          </div>
          {open && <div className="branch-popup">
            <p className="field-help" role="status">{!capability?.available
              ? (fr ? 'Catalogue indisponible. Réessayez après le déploiement des données approuvées.' : 'Catalog unavailable. Retry after approved data is deployed.')
              : typed.length < 2 ? (fr ? 'Saisissez au moins deux caractères.' : 'Enter at least two characters.')
                : !current ? (fr ? 'Recherche des pièces…' : 'Searching parts…')
                  : current.result?.more ? (fr ? '20 premiers résultats. Affinez la recherche.' : 'First 20 matches. Refine your search.')
                    : (fr ? `${parts.length} pièces trouvées.` : `${parts.length} matching parts.`)}</p>
            {current?.error && <div className="error-box" role="alert">
              <p>{current.error}</p>
              <button type="button" className="button secondary small"
                onClick={() => { input.current?.focus(); setSearch(undefined); setSearchAttempt((attempt) => attempt + 1) }}>
                {fr ? 'Réessayer' : 'Retry part search'}
              </button>
            </div>}
            {current?.result && !current.result.available && <p className="error-box" role="alert">{current.result.reason}</p>}
            <ul id={listId} ref={list} role="listbox" aria-label={fr ? 'Pièces du catalogue' : 'Catalog parts'}>
              {parts.map((part, index) => <li key={part.id} id={`${listId}-${part.id}`} role="option"
                aria-selected={line.catalogPartId === part.id} data-active={index === activeIndex}>
                <button type="button" tabIndex={-1} className="package-option"
                  onMouseDown={(event) => event.preventDefault()} onClick={() => choose(part)}>
                  <span className="package-option-body"><strong>{part.number}</strong><span>{part.description}</span></span>
                </button>
              </li>)}
            </ul>
          </div>}
        </div>
      </div>
      {!readOnly && line.partType === 'non-kone' && line.catalogPartId && <button type="button" className="button tertiary"
        onClick={() => { setQuery(undefined); setOpen(false); update({ catalogPartId: undefined, unitPrice: undefined, uom: undefined,
          unitCost: 0, part: '', description: '', refreshPart: false }) }}>
        {fr ? 'Passer à la saisie manuelle' : 'Switch to manual entry'}
      </button>}
      {!readOnly && line.partType === 'non-kone' && !line.catalogPartId && <p className="field-help">
        {fr ? 'Choisissez une pièce ou saisissez les détails manuellement dans la devise du devis.'
          : 'Select a part or enter details manually in the estimate currency.'}</p>}
      {line.partType === 'kone' && !line.catalogPartId && <p className="error-box" role="alert">
        {fr ? 'Choisissez une pièce KONE du catalogue avant d’enregistrer.' : 'Select a KONE catalog part before saving.'}</p>}
    </>}
    {line.partType === 'kone' && <label className="field-label">{fr ? 'Majoration KONE (%)' : 'KONE markup (%)'}
      <input className="text-input" type="number" min="0" max="100" step="0.01"
        value={line.markupPercent ?? ''} disabled={readOnly || !capability?.available}
        onChange={(event) => update({ markupPercent: event.target.value === '' ? undefined : Number(event.target.value) })} />
      <span className="field-help">{fr ? 'Appliquée au prix VK13, pas au coût interne.' : 'Applied to VK13 selling price, not internal cost.'}</span>
    </label>}
    {line.catalogPartId && <p className="field-help">
      {fr ? 'Pièce du catalogue' : 'Catalog part'}: {line.part} · {line.uom}
      {line.unitPrice != null && <> · VK13: {money(line.unitPrice)}</>}
      {' · '}{fr ? 'Valeurs vérifiées par le serveur lors de l’enregistrement.' : 'Values verified by the server on save.'}
    </p>}
    {!readOnly && !capability?.available && line.partType === 'non-kone' && <button type="button" className="button tertiary"
      onClick={() => { setQuery(undefined); setOpen(false); update({ pricingSource: 'manual', refreshPart: false }) }}>
      {fr ? 'Utiliser la saisie manuelle sans catalogue' : 'Use manual entry without catalog'}
    </button>}
  </>
}
