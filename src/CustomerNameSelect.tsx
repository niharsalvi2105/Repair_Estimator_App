import { useEffect, useRef, useState } from 'react'
import { getBranchCustomerNames } from './data/repairEstimatorRepository'

export function CustomerNameSelect({ branchId, value, onChange, language }: {
  branchId: string; value: string; onChange: (value: string) => void; language: 'en' | 'fr'
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [active, setActive] = useState(-1)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ names?: string[]; error?: string }>()
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const fr = language === 'fr'
  useEffect(() => {
    if (!open || result) return
    let cancelled = false
    getBranchCustomerNames(branchId).then(
      (names) => { if (!cancelled) setResult({ names }) },
      (reason: unknown) => {
        if (!cancelled) setResult({ error: reason instanceof Error ? reason.message : String(reason) })
      },
    )
    return () => { cancelled = true }
  }, [branchId, open, attempt, result])
  const matches = (result?.names ?? []).filter((name) =>
    name.toLocaleLowerCase(language).includes(filter.trim().toLocaleLowerCase(language)))
  const options = matches.slice(0, 50)
  useEffect(() => {
    if (open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, open])
  function show() { setFilter(''); setActive(-1); setOpen(true) }
  function choose(name: string) {
    onChange(name); setOpen(false); setActive(-1); input.current?.focus()
  }
  return <div className="branch-combobox" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }}>
    <div className="branch-combobox-control">
      <input ref={input} id="customer-name" className="text-input" role="combobox"
        value={value} maxLength={300} disabled={!branchId} aria-required="true"
        autoComplete="off" aria-expanded={open} aria-controls="customer-name-options"
        aria-autocomplete="list" aria-describedby="customer-name-help"
        aria-activedescendant={open && active >= 0 && options[active] ? `customer-name-option-${active}` : undefined}
        onFocus={show} onClick={() => { if (!open) show() }}
        onChange={(event) => {
          onChange(event.target.value); setFilter(event.target.value); setActive(-1); setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) show()
            else setActive((current) => Math.max(-1, Math.min(options.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))))
          } else if (event.key === 'Enter' && open && active >= 0 && options[active]) {
            event.preventDefault(); choose(options[active])
          } else if (event.key === 'Escape') {
            event.preventDefault(); setOpen(false)
          } else if (event.key === 'Tab') setOpen(false)
        }} />
      <button type="button" className="branch-dropdown-toggle" disabled={!branchId}
        aria-label={fr ? 'Afficher les clients' : 'Show customers'} aria-expanded={open}
        aria-controls="customer-name-options" onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          input.current?.focus()
          if (open) setOpen(false)
          else show()
        }}><span aria-hidden="true">▾</span></button>
    </div>
    <p id="customer-name-help" className="field-help">{!branchId
      ? fr ? 'Choisissez d’abord une succursale.' : 'Select a branch first.'
      : fr ? 'Sélectionnez un client de cette succursale ou saisissez un autre nom.'
        : 'Choose a customer from this branch or type another name.'}</p>
    {open && <div className="branch-popup">
      {!result ? <p role="status">{fr ? 'Chargement des clients…' : 'Loading customers…'}</p>
        : result.error ? <div role="alert">
          <p>{fr ? 'Impossible de charger les clients.' : 'Could not load customers.'} {result.error}</p>
          <button type="button" className="button secondary" onClick={() => {
            setResult(undefined); setAttempt((n) => n + 1)
          }}>{fr ? 'Réessayer' : 'Retry'}</button>
        </div> : <p className="field-help" role="status">{matches.length === 0
          ? fr ? 'Aucun client correspondant. Vous pouvez saisir un autre nom.' : 'No matching customers. You can type another name.'
          : matches.length > 50
            ? fr ? '50 résultats affichés. Précisez le nom pour affiner la recherche.' : 'Showing 50 results. Type more to narrow the search.'
            : `${matches.length} ${fr ? 'client(s)' : 'customer(s)'}`}</p>}
      <ul ref={list} id="customer-name-options" role="listbox" aria-label={fr ? 'Clients' : 'Customers'}>
        {options.map((name, index) => <li key={name} id={`customer-name-option-${index}`} role="option"
          aria-selected={value === name} data-active={index === active}>
          <button type="button" tabIndex={-1} onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(name)}>{name}</button>
        </li>)}
      </ul>
    </div>}
  </div>
}
