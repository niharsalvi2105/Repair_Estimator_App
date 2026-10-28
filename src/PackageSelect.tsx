import { useEffect, useMemo, useRef, useState } from 'react'
import type { RepairPackage } from './data/repairEstimatorRepository'
import { filterPackages, localizePackage, localizeScope } from './data/packageSearch'
import type { AppCopy } from './App'

const PAGE_SIZE = 50

export function PackageSelect({ packages, selectedIds, onToggle, language, t, loading, disabled = false }: {
  packages: RepairPackage[]
  selectedIds: Set<string>
  onToggle: (repairPackage: RepairPackage) => void
  language: 'en' | 'fr'
  t: AppCopy
  loading: boolean
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const list = useRef<HTMLUListElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const matches = useMemo(() => filterPackages(packages, query), [packages, query])
  const visible = matches.slice(0, limit)
  const activeOption = visible[active]

  useEffect(() => {
    if (open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function show() {
    setActive(0)
    setOpen(true)
  }
  function changeQuery(value: string) {
    setQuery(value)
    setActive(0)
    setLimit(PAGE_SIZE)
    setOpen(true)
  }

  return (
    <div className="branch-combobox package-combobox" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }}>
      <div className="branch-combobox-control">
        <input ref={input} id="package-search" className="text-input" role="combobox"
          disabled={disabled}
          aria-expanded={open} aria-controls="package-options" aria-autocomplete="list"
          aria-activedescendant={open && activeOption ? `package-option-${active}` : undefined}
          autoComplete="off"
          placeholder={t.packageSearch}
          value={query}
          onClick={() => { if (!open) show() }}
          onChange={(event) => changeQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              if (!open) show()
              else setActive((current) => Math.max(0, Math.min(visible.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))))
            } else if (event.key === 'Enter' && open) {
              event.preventDefault()
              if (activeOption) onToggle(activeOption)
            } else if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
            } else if (event.key === 'Tab') setOpen(false)
          }} />
        <button type="button" className="branch-dropdown-toggle"
          disabled={disabled}
          aria-label={t.packagesTitle}
          aria-expanded={open} aria-controls="package-options"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => { if (open) setOpen(false); else show(); input.current?.focus() }}>
          <span aria-hidden="true">▾</span>
        </button>
      </div>
      {open && <div className="branch-popup">
        <p className="field-help" role="status">
          {loading ? t.searchingPackages
            : matches.length === 0 ? t.noPackages
              : `${matches.length} / ${packages.length} ${t.packagesAvailable} · ${selectedIds.size} ${t.packagesChosen}`}
        </p>
        <ul id="package-options" ref={list} role="listbox" aria-multiselectable="true" aria-label={t.packagesTitle}>
          {visible.map((repairPackage, index) => {
            const selected = selectedIds.has(repairPackage.re_repairpackageid)
            return (
              <li key={repairPackage.re_repairpackageid} id={`package-option-${index}`} role="option"
                aria-selected={selected} data-active={index === active}>
                <button type="button" tabIndex={-1} className="package-option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onToggle(repairPackage)}>
                  <span className="package-check" aria-hidden="true">{selected ? '✓' : ''}</span>
                  <span className="package-option-body">
                    <strong>{repairPackage.re_packagenumber}</strong>
                    <span>{localizePackage(repairPackage, language)}</span>
                    <small className="package-option-scope">
                      <b>{t.scopeOfWork}: </b>{localizeScope(repairPackage, language) || t.noScope}
                    </small>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {matches.length > visible.length && (
          <button type="button" className="button small secondary package-more"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setLimit((current) => current + PAGE_SIZE)}>
            {t.showMore} ({matches.length - visible.length})
          </button>
        )}
      </div>}
    </div>
  )
}
