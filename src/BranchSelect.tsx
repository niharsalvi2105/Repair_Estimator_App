import { useEffect, useRef, useState } from 'react'
import type { Branch } from './data/repairEstimatorRepository'

export function BranchSelect({ branches, value, onChange, language, disabled = false }: {
  branches: Branch[]
  value: string
  onChange: (id: string) => void
  language: 'en' | 'fr'
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const list = useRef<HTMLUListElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const selected = branches.find((branch) => branch.re_branchid === value)
  const label = (branch: Branch) => `${branch.re_branchname} (${branch.re_branchnumber})`
  const normalized = query.trim().toLocaleLowerCase(language)
  const matches = branches.filter((branch) => label(branch).toLocaleLowerCase(language).includes(normalized))
  const options = [{ id: '', label: language === 'fr' ? 'Choisir une succursale' : 'Choose a branch' },
    ...matches.map((branch) => ({ id: branch.re_branchid, label: label(branch) }))]
  const activeOption = options[active]

  useEffect(() => {
    if (open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function show() {
    setQuery('')
    setActive(0)
    setOpen(true)
  }
  function choose(id: string) {
    onChange(id)
    setOpen(false)
    setQuery('')
    input.current?.focus()
  }

  return (
    <div className="branch-combobox" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }}>
      <div className="branch-combobox-control">
        <input ref={input} id="branch-select" className="text-input" role="combobox"
          disabled={disabled}
          aria-expanded={open} aria-controls="branch-options" aria-autocomplete="list"
          aria-required="true"
          aria-activedescendant={open && activeOption ? `branch-option-${active}` : undefined}
          autoComplete="off"
          placeholder={language === 'fr' ? 'Rechercher par nom ou numéro de succursale' : 'Search branch name or number'}
          value={open ? query : selected ? label(selected) : ''}
          onClick={() => { if (!open) show() }}
          onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true) }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              if (!open) show()
              else setActive((current) => Math.max(0, Math.min(options.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))))
            } else if (event.key === 'Enter' && open) {
              event.preventDefault()
              if (activeOption) choose(activeOption.id)
            } else if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
            } else if (event.key === 'Tab') setOpen(false)
          }} />
        <button type="button" className="branch-dropdown-toggle"
          disabled={disabled}
          aria-label={language === 'fr' ? 'Afficher les succursales' : 'Show branches'}
          aria-expanded={open} aria-controls="branch-options"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => { if (open) setOpen(false); else show(); input.current?.focus() }}>
          <span aria-hidden="true">▾</span>
        </button>
      </div>
      {open && <div className="branch-popup">
        <p className="field-help" role="status">
          {matches.length === 0
            ? language === 'fr' ? 'Aucune succursale ne correspond à la recherche.' : 'No branches match your search.'
            : language === 'fr' ? `${matches.length} succursale(s)` : `${matches.length} branch(es)`}
        </p>
        <ul id="branch-options" ref={list} role="listbox" aria-label={language === 'fr' ? 'Succursales' : 'Branches'}>
          {options.map((option, index) => (
            <li key={option.id} id={`branch-option-${index}`} role="option"
              aria-selected={option.id === value} data-active={index === active}>
              <button type="button" tabIndex={-1} onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option.id)}>{option.label}</button>
            </li>
          ))}
        </ul>
      </div>}
    </div>
  )
}
