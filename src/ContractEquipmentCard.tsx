import { useEffect, useId, useRef, useState } from 'react'
import { getContractEquipment } from './data/contractEquipmentRepository'
import type { ContractResult } from './data/contractEquipment'
import type { Market } from './data/estimateQuery'

export type ContractAddSummary = { added: number; alreadySelected: number; notFound: string[]; duplicates: string[] }

export function ContractEquipmentCard({ branchId, market, language, busy, disabled, onAdd }: {
  branchId: string; market: Market; language: 'en' | 'fr'; busy: boolean; disabled: boolean
  onAdd: (numbers: string[], file?: File) => Promise<ContractAddSummary | undefined>
}) {
  const fr = language === 'fr'
  const id = useId()
  const [capability, setCapability] = useState<{ result?: ContractResult; error?: string }>()
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [search, setSearch] = useState<{ query: string; result?: ContractResult; error?: string }>()
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<ContractAddSummary>()
  const [templateBusy, setTemplateBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (!branchId) return
    let active = true
    getContractEquipment(branchId, market, 'contractcapabilities').then(
      (result) => { if (active) setCapability({ result }) },
      (reason: unknown) => { if (active) setCapability({ error: reason instanceof Error ? reason.message : String(reason) }) },
    )
    return () => { active = false }
  }, [branchId, market, attempt])
  useEffect(() => {
    if (!open || !capability?.result?.available || disabled) return
    let active = true
    const timer = setTimeout(() => {
      getContractEquipment(branchId, market, 'contractsearch', query.trim()).then(
        (result) => { if (active) setSearch({ query, result }) },
        (reason: unknown) => { if (active) setSearch({ query, error: reason instanceof Error ? reason.message : String(reason) }) },
      )
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [branchId, market, query, open, capability?.result?.available, disabled, attempt])
  useEffect(() => {
    if (open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, open])
  const current = search?.query === query ? search : undefined
  const contracts = current?.result?.available ? current.result.contracts : []
  const activeContract = contracts[Math.min(active, Math.max(0, contracts.length - 1))]
  const unavailable = !capability?.result?.available
  const locked = disabled || busy || unavailable
  async function add(numbers: string[], upload?: File) {
    setOpen(false); setError(''); setSummary(undefined)
    try {
      const result = await onAdd(numbers, upload)
      if (result) { setSummary(result); setQuery('') }
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }
  async function download() {
    setTemplateBusy(true); setError('')
    try {
      const { contractExcelTemplate } = await import('./data/contractExcel')
      const buffer = await contractExcelTemplate()
      const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }))
      const link = document.createElement('a')
      link.href = url; link.download = 'Contract-Template.xlsx'
      document.body.append(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setTemplateBusy(false) }
  }
  function retry() { setCapability(undefined); setSearch(undefined); setAttempt((n) => n + 1) }
  return <section className="form-card contract-equipment-card" aria-label={fr ? 'Équipements par contrat' : 'Equipment by contract'}>
    <div className="section-heading">
      <span className="section-icon">CT</span>
      <div><h2>{fr ? 'Ajouter des équipements par contrat' : 'Add equipment by contract'}</h2>
        <p>{fr ? 'Autre option : choisissez un contrat ou importez ses numéros depuis Excel. Tous ses équipements actifs dans la succursale sélectionnée seront ajoutés.'
          : 'Alternative: choose a contract or upload contract numbers from Excel. All linked active equipment in the selected branch will be added.'}</p>
      </div>
    </div>
    {unavailable && <div className="draft-notice" role="status">
      <p>{!branchId ? (fr ? 'Choisissez une succursale.' : 'Select a branch.')
        : !capability ? (fr ? 'Vérification des contrats…' : 'Checking contract lookup…')
          : capability.error ?? capability.result?.reason}</p>
      {branchId && capability && <button type="button" className="button secondary small" onClick={retry}>
        {fr ? 'Réessayer les contrats' : 'Retry contracts'}
      </button>}
    </div>}
    <label className="field-label" htmlFor={`${id}-input`}>{fr ? 'Numéro de contrat' : 'Contract number'}</label>
    <div className="branch-combobox equipment-combobox" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }}>
      <div className="branch-combobox-control">
        <input ref={input} id={`${id}-input`} className="text-input" role="combobox" value={query}
          maxLength={100} autoComplete="off" disabled={locked}
          placeholder={fr ? 'Parcourir ou rechercher un numéro de contrat' : 'Browse or search by contract number'}
          aria-expanded={open} aria-controls={`${id}-options`} aria-autocomplete="list"
          aria-activedescendant={open && activeContract ? `${id}-option-${active}` : undefined}
          onClick={() => { setOpen(true); setActive(0) }}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0) }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              if (!open) { setOpen(true); setActive(0) }
              else setActive((n) => Math.max(0, Math.min(contracts.length - 1, n + (event.key === 'ArrowDown' ? 1 : -1))))
            } else if (event.key === 'Enter' && open) {
              event.preventDefault()
              if (activeContract) void add([activeContract])
            } else if (event.key === 'Escape') { event.preventDefault(); setOpen(false) }
          }} />
        <button type="button" className="branch-dropdown-toggle" disabled={locked}
          aria-label={fr ? 'Parcourir les contrats' : 'Browse contracts'} aria-expanded={open} aria-controls={`${id}-options`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => { setOpen(!open); setActive(0); input.current?.focus() }}><span aria-hidden="true">▾</span></button>
      </div>
      {open && <div className="branch-popup">
        <p className="field-help" role="status">{!current ? (fr ? 'Recherche des contrats…' : 'Searching contracts…')
          : current.result?.more ? (fr ? '20 premiers contrats. Affinez la recherche.' : 'First 20 contracts. Refine your search.')
            : (fr ? `${contracts.length} contrats trouvés.` : `${contracts.length} matching contracts.`)}</p>
        {(current?.error || current?.result && !current.result.available) && <div className="error-box" role="alert">
          <p>{current.error ?? current.result?.reason}</p><button type="button" className="button secondary small" onClick={retry}>
            {fr ? 'Réessayer les contrats' : 'Retry contracts'}</button>
        </div>}
        <ul ref={list} id={`${id}-options`} role="listbox" aria-label={fr ? 'Contrats' : 'Contracts'}>
          {contracts.map((number, index) => <li key={number} id={`${id}-option-${index}`} role="option"
            aria-selected={false} data-active={active === index}>
            <button type="button" className="package-option" tabIndex={-1} onMouseDown={(event) => event.preventDefault()}
              onClick={() => void add([number])}><span className="package-option-body"><strong>{number}</strong>
                <span>{fr ? 'Ajouter tous les équipements liés' : 'Add all linked equipment'}</span></span></button>
          </li>)}
        </ul>
      </div>}
    </div>
    <section className="equipment-excel-upload" aria-label={fr ? 'Import Excel des contrats' : 'Contract Excel import'}>
      <div className="equipment-excel-heading"><h3>{fr ? 'Importer des numéros de contrat depuis Excel' : 'Import contract numbers from Excel'}</h3>
        <span className="equipment-excel-format">.xlsx · {fr ? '5 Mo maximum' : '5 MB max'}</span></div>
      <div className="equipment-excel-actions">
        <div className="equipment-excel-step"><p><span>1</span>{fr ? 'Préparer le fichier' : 'Prepare your file'}</p>
          <button type="button" className="button secondary" disabled={templateBusy || busy} onClick={() => void download()}>
            {fr ? 'Télécharger le modèle Excel' : 'Download Excel template'}</button></div>
        <div className="equipment-excel-step"><p><span>2</span>{fr ? 'Importer les contrats' : 'Import your contracts'}</p>
          <button type="button" className="button primary" disabled={locked} aria-busy={busy} onClick={() => file.current?.click()}>
            {fr ? 'Téléverser le fichier Excel' : 'Upload Excel file'}</button>
          <input ref={file} type="file" accept=".xlsx" hidden disabled={locked}
            aria-label={fr ? 'Téléverser le fichier Excel des contrats' : 'Upload contract Excel file'}
            onChange={(event) => {
              const upload = event.target.files?.[0]; event.target.value = ''
              if (upload) void add([], upload)
            }} />
        </div>
      </div>
      <details className="equipment-excel-help"><summary>{fr ? 'Format et règles du fichier' : 'File format and import rules'}</summary>
        <p>{fr ? 'Une colonne : Contract Number. Un numéro par ligne, au format texte pour conserver les zéros initiaux.'
          : 'One column: Contract Number. One number per row; use text format to preserve leading zeros.'}</p>
        <p>{fr ? 'Contrats actifs et équipements actifs de cette succursale uniquement. Les doublons sont ignorés. Les contrats sans équipement correspondant sont signalés; aucun équipement non répertorié n’est créé.'
          : 'Active contracts and active equipment in this branch only. Duplicates are skipped. Contracts without matching equipment are reported; no unlisted equipment is created.'}</p>
      </details>
    </section>
    {busy && <p role="status">{fr ? 'Résolution des équipements des contrats…' : 'Resolving contract equipment…'}</p>}
    {summary && <div className="paste-summary" role="status">
      <p>{fr ? 'Équipements ajoutés' : 'Equipment added'}: {summary.added} · {fr ? 'Déjà sélectionnés' : 'Already selected'}: {summary.alreadySelected}</p>
      {summary.notFound.length > 0 && <p>{fr ? 'Contrats sans équipement actif dans cette succursale' : 'Contracts without active equipment in this branch'}: {summary.notFound.join(', ')}</p>}
      {summary.duplicates.length > 0 && <p>{fr ? 'Contrats en double ignorés' : 'Duplicate contracts skipped'}: {summary.duplicates.join(', ')}</p>}
    </div>}
    {error && <div className="error-box" role="alert">
      {fr && <p>Impossible d’ajouter les équipements des contrats. Vérifiez le fichier et la configuration.</p>}
      <p>{error}</p>
    </div>}
  </section>
}
