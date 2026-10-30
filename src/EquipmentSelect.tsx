import { useEffect, useRef, useState } from 'react'
import type { Equipment } from './data/repairEstimatorRepository'
import type { AppCopy } from './App'
import { isEquipmentList } from './data/equipmentPaste'

const RESULT_LIMIT = 20

type Option = { kind: 'equipment'; equipment: Equipment } | { kind: 'unlisted' } | { kind: 'list' }

export function EquipmentSelect({
  results, selectedNumbers, onToggle, query, onQueryChange, loading, disabled = false, t,
  onAddUnlisted,
  onPasteList,
}: {
  results: Equipment[]
  selectedNumbers: Set<string>
  onToggle: (equipment: Equipment) => void
  query: string
  onQueryChange: (value: string) => void
  loading: boolean
  disabled?: boolean
  t: AppCopy
  onAddUnlisted: () => void
  onPasteList: (text: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const list = useRef<HTMLUListElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const typed = query.trim()
  const typedList = isEquipmentList(typed)
  const options: Option[] = typedList ? [{ kind: 'list' }]
    : loading ? [] : results.map((equipment) => ({ kind: 'equipment', equipment }))
  if (!typedList && !loading && typed.length >= 3 && !selectedNumbers.has(typed)) options.push({ kind: 'unlisted' })
  const activeOption = options[active]

  useEffect(() => {
    if (open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function show() {
    setActive(0)
    setOpen(true)
  }
  function choose(option: Option) {
    if (option.kind === 'list') {
      setOpen(false)
      onPasteList(query)
    } else if (option.kind === 'unlisted') {
      onAddUnlisted()
      setActive(0)
    } else onToggle(option.equipment)
  }

  return (
    <div className="branch-combobox equipment-combobox" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }}>
      <div className="branch-combobox-control">
        <input ref={input} id="equipment-search" className="text-input" role="combobox"
          disabled={disabled}
          aria-expanded={open} aria-controls="equipment-options" aria-autocomplete="list"
          aria-activedescendant={open && activeOption ? `equipment-option-${active}` : undefined}
          autoComplete="off"
          placeholder={t.equipmentSearch}
          value={query}
          onClick={() => { if (!open) show() }}
          onChange={(event) => { onQueryChange(event.target.value); setActive(0); setOpen(true) }}
          onPaste={(event) => {
            const text = event.clipboardData.getData('text')
            if (!isEquipmentList(text)) return
            event.preventDefault()
            setOpen(false)
            onPasteList(text)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && isEquipmentList(query)) {
              event.preventDefault()
              setOpen(false)
              onPasteList(query)
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              if (!open) show()
              else setActive((current) => Math.max(0, Math.min(options.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))))
            } else if (event.key === 'Enter' && open) {
              event.preventDefault()
              if (activeOption) choose(activeOption)
            } else if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
            } else if (event.key === 'Tab') setOpen(false)
          }} />
        <button type="button" className="branch-dropdown-toggle"
          disabled={disabled}
          aria-label={t.equipment}
          aria-expanded={open} aria-controls="equipment-options"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => { if (open) setOpen(false); else show(); input.current?.focus() }}>
          <span aria-hidden="true">▾</span>
        </button>
      </div>
      {open && <div className="branch-popup">
        <p className="field-help" role="status">
          {typedList ? t.equipmentListHelp : loading ? t.searching
            : results.length === 0 ? t.noEquipment
              : results.length >= RESULT_LIMIT ? t.refineSearch : `${results.length}`}
          {' · '}{selectedNumbers.size} {t.equipmentCount}
        </p>
        <ul id="equipment-options" ref={list} role="listbox" aria-multiselectable="true" aria-label={t.equipment}>
          {options.map((option, index) => {
            if (option.kind === 'list') {
              return (
                <li key="list" id={`equipment-option-${index}`} role="option" aria-selected={false}
                  data-active={index === active}>
                  <button type="button" tabIndex={-1} className="package-option"
                    onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>
                    <span className="package-check" aria-hidden="true">+</span>
                    <span className="package-option-body">{t.addEquipmentList}<strong>{typed}</strong></span>
                  </button>
                </li>
              )
            }
            if (option.kind === 'unlisted') {
              return (
                <li key="unlisted" id={`equipment-option-${index}`} role="option" aria-selected={false}
                  data-active={index === active}>
                  <button type="button" tabIndex={-1} className="package-option"
                    onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>
                    <span className="package-check" aria-hidden="true">+</span>
                    <span className="package-option-body">{t.unlisted}: <strong>{typed}</strong></span>
                  </button>
                </li>
              )
            }
            const { equipment } = option
            const selected = selectedNumbers.has(equipment.re_equipment)
            return (
              <li key={equipment.re_equipmentid} id={`equipment-option-${index}`} role="option"
                aria-selected={selected} data-active={index === active}>
                <button type="button" tabIndex={-1} className="package-option"
                  onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>
                  <span className="package-check" aria-hidden="true">{selected ? '✓' : ''}</span>
                  <span className="package-option-body">
                    <strong>{equipment.re_equipment}</strong>
                    {equipment.re_equipmentname && <span>{equipment.re_equipmentname}</span>}
                    <small className="package-option-scope">
                      {t.location}: {equipment.re_functionallocation || '-'} · {t.customer}: {equipment.re_soldtoname || '-'}
                    </small>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>}
    </div>
  )
}
