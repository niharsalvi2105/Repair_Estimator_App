import { useEffect, useRef, useState } from 'react'
import { buildMasterChanges, fieldInput, fieldKey, masterRecordLabel, masterTables, type Language, type MasterField, type MasterRow, type MasterTable } from './data/masterDataSchema'
import { DataverseError } from './data/dataverseOperation'
import { getMasterMetadata, getMasterRecord, listMasterRecords, saveMasterRecord, searchMasterLookup, setMasterActive } from './data/masterDataRepository'

const copy = {
  en: {
    title: 'Master Data', packages: 'Package Details', hint: 'Maintain master and pricing configuration data. Dataverse permissions apply.',
    packageHint: 'Read-only package catalog across countries. Search by the beginning of a package number or English/French name.',
    table: 'Table', search: 'Search (starts with)', status: 'Status', active: 'Active', inactive: 'Inactive', all: 'All',
    create: 'Create record', edit: 'Edit', details: 'Details', loading: 'Loading…', empty: 'No accessible records match these filters.',
    retry: 'Retry', save: 'Save changes', cancel: 'Close', back: 'Back to list', previous: 'Previous', next: 'Next',
    discard: 'There are unsaved master-data changes. Discard them?', choose: 'Select an option', lookup: 'Search reference',
    select: 'Select', clear: 'Clear', more: 'More matches exist. Refine your search.', activate: 'Activate',
    deactivate: 'Deactivate', confirm: 'Change this record’s active status? This affects future lookups and calculations.',
    saved: 'Record saved.', changed: 'Status updated.', denied: 'Master-data editing is available only to administrators.',
    error: 'Dataverse operation failed.', uncertain: 'After a save error or timeout, reload this record before trying another write.',
    reload: 'Reload record', noValue: 'Not set', readOnly: 'Read-only', dirty: 'Unsaved changes',
    notCreated: 'The record does not exist. Review the inputs and retry using the same record ID.',
    units: 'Numeric configuration values use their stored Dataverse units. Fractional rates stay fractional (for example, 0.05 = 5%); no automatic percentage conversion is applied.',
    record: 'Record', description: 'Description', action: 'Action', page: 'Page', shown: 'records on this page',
    catalog: 'PACKAGE CATALOG', administration: 'ADMINISTRATION', recordDetails: 'Record details',
  },
  fr: {
    title: 'Données de référence', packages: 'Détails des forfaits', hint: 'Gérez les données de référence et de tarification. Les autorisations Dataverse s’appliquent.',
    packageHint: 'Catalogue en lecture seule, tous pays. Recherchez par début de numéro ou de nom anglais/français.',
    table: 'Table', search: 'Rechercher (commence par)', status: 'État', active: 'Actif', inactive: 'Inactif', all: 'Tous',
    create: 'Créer un enregistrement', edit: 'Modifier', details: 'Détails', loading: 'Chargement…', empty: 'Aucun enregistrement accessible ne correspond aux filtres.',
    retry: 'Réessayer', save: 'Enregistrer', cancel: 'Fermer', back: 'Retour à la liste', previous: 'Précédent', next: 'Suivant',
    discard: 'Des modifications des données de référence ne sont pas enregistrées. Les abandonner ?', choose: 'Sélectionnez une option',
    lookup: 'Rechercher une référence', select: 'Sélectionner', clear: 'Effacer', more: 'D’autres résultats existent. Précisez la recherche.',
    activate: 'Activer', deactivate: 'Désactiver', confirm: 'Changer l’état de cet enregistrement ? Cela affecte les recherches et calculs futurs.',
    saved: 'Enregistrement sauvegardé.', changed: 'État mis à jour.', denied: 'La modification est réservée aux administrateurs.',
    error: 'Échec de l’opération Dataverse.', uncertain: 'Après une erreur ou un délai dépassé, rechargez l’enregistrement avant toute autre écriture.',
    reload: 'Recharger l’enregistrement', noValue: 'Non renseigné', readOnly: 'Lecture seule', dirty: 'Modifications non enregistrées',
    notCreated: 'L’enregistrement n’existe pas. Vérifiez les valeurs et réessayez avec le même identifiant.',
    units: 'Les nombres utilisent les unités stockées dans Dataverse. Les taux restent fractionnaires (exemple : 0,05 = 5 %) ; aucune conversion automatique en pourcentage.',
    record: 'Enregistrement', description: 'Description', action: 'Action', page: 'Page', shown: 'enregistrements sur cette page',
    catalog: 'CATALOGUE DES FORFAITS', administration: 'ADMINISTRATION', recordDetails: 'Détails de l’enregistrement',
  },
}
const reasonMessage = (reason: unknown) => reason instanceof Error ? reason.message : String(reason)

function LookupField({ field, value, selectedLabel, onChange, language, disabled }: {
  field: MasterField; value: string; selectedLabel?: string; onChange: (value: string) => void; language: Language; disabled: boolean
}) {
  const t = copy[language]
  const [search, setSearch] = useState('')
  const [result, setResult] = useState<{ records: { id: string; label: string }[]; more: boolean }>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [requested, setRequested] = useState(false)
  const [selectedOption, setSelectedOption] = useState<{ id: string; label: string }>()
  useEffect(() => {
    if (!requested || disabled) return
    let cancelled = false
    const timer = setTimeout(() => {
      if (!field.target) { setError(`${field.label}: lookup metadata missing.`); return }
      setBusy(true); setError(''); setResult(undefined)
      void searchMasterLookup(field.target, search).then((rows) => { if (!cancelled) setResult(rows) })
        .catch((reason: unknown) => { if (!cancelled) setError(reasonMessage(reason)) })
        .finally(() => { if (!cancelled) setBusy(false) })
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [search, field.target, field.label, attempt, requested, disabled])
  return <div className="master-lookup">
    <label className="field-label"><span className="sr-only">{t.lookup}: {field.label}</span>
      <input className="text-input" value={search} disabled={disabled} maxLength={150}
        onFocus={() => setRequested(true)}
        onChange={(e) => { setRequested(true); setSearch(e.target.value) }} />
    </label>
    {busy && <p role="status">{t.loading}</p>}
    {error && <div role="alert" className="error-box">{error}<button type="button" className="button secondary"
      onClick={() => setAttempt((n) => n + 1)}>{t.retry}</button></div>}
    <select id={`master-${field.name}`} className="text-input" aria-label={field.label}
      onFocus={() => setRequested(true)}
      value={value} required={field.required} disabled={disabled} onChange={(e) => {
        setSelectedOption({ id: e.target.value, label: e.target.selectedOptions[0]?.textContent ?? e.target.value })
        onChange(e.target.value)
      }}>
      <option value="">{t.choose}</option>
      {value && !result?.records.some((r) => r.id === value) && <option value={value}>
        {selectedLabel || (selectedOption?.id === value ? selectedOption.label : value)}
      </option>}
      {result?.records.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
    </select>
    {result?.more && <p className="field-help">{t.more}</p>}
    {!field.required && value && <button type="button" className="button tertiary" disabled={disabled} onClick={() => onChange('')}>{t.clear}</button>}
  </div>
}

function displayValue(row: MasterRow, field: MasterField, language: Language): string {
  const value = row[fieldKey(field)]
  if (value === null || value === undefined) return copy[language].noValue
  const formatted = row[`${fieldKey(field)}@OData.Community.Display.V1.FormattedValue`]
  if (typeof formatted === 'string') return formatted
  if (field.kind === 'BooleanType') return language === 'fr' ? value ? 'Oui' : 'Non' : value ? 'Yes' : 'No'
  if (typeof value === 'number') {
    return field.options.find((entry) => entry.value === value)?.label
      ?? new Intl.NumberFormat(language === 'fr' ? 'fr-CA' : 'en-US', { maximumFractionDigits: 10 }).format(value)
  }
  return String(value)
}

export function MasterDataWorkspace({ language, admin, catalog = false, onDirtyChange, onBusyChange }: {
  language: Language; admin: boolean; catalog?: boolean
  onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void
}) {
  const t = copy[language]
  const [name, setName] = useState('re_repairpackage')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('0')
  const [tokens, setTokens] = useState<(string | undefined)[]>([undefined])
  const [page, setPage] = useState<{ records: MasterRow[]; skipToken?: string }>()
  const [table, setTable] = useState<MasterTable>()
  const [editor, setEditor] = useState<{ id: string; row?: MasterRow }>()
  const [values, setValues] = useState<Record<string, string>>({})
  const [baseline, setBaseline] = useState('')
  const [listLoading, setLoading] = useState(true)
  const [metadataLoading, setMetadataLoading] = useState(true)
  const [metadataError, setMetadataError] = useState('')
  const [metadataAttempt, setMetadataAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const inFlight = useRef(false)
  const loading = listLoading || metadataLoading
  const dirty = !catalog && Boolean(editor && JSON.stringify(values) !== baseline)
  const displayFields = table ? [...table.fields].sort((a, b) =>
    Number(a.kind === 'MemoType') - Number(b.kind === 'MemoType')) : []
  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  useEffect(() => { onBusyChange(busy) }, [busy, onBusyChange])
  const skipToken = tokens[tokens.length - 1]
  useEffect(() => {
    if (!admin && !catalog) return
    let cancelled = false
    const timer = setTimeout(() => {
      setMetadataLoading(true); setMetadataError(''); setTable(undefined)
      void getMasterMetadata(name, language, metadataAttempt > 0)
        .then((metadata) => { if (!cancelled) setTable(metadata) })
        .catch((reason: unknown) => { if (!cancelled) setMetadataError(reasonMessage(reason)) })
        .finally(() => { if (!cancelled) setMetadataLoading(false) })
    }, 0)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [name, language, metadataAttempt, admin, catalog])
  useEffect(() => {
    if (!admin && !catalog) return
    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true); setError(''); setPage(undefined)
      void listMasterRecords(name, search, status, skipToken)
        .then((rows) => {
          if (cancelled) return
          if (rows.skipToken && tokens.includes(rows.skipToken)) throw new Error('Dataverse returned a repeated master-data paging token.')
          setPage(rows)
        })
        .catch((reason: unknown) => { if (!cancelled) setError(reasonMessage(reason)) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [name, search, status, skipToken, tokens, attempt, admin, catalog])

  if (!admin && !catalog) return <p role="alert" className="error-box">{t.denied}</p>
  function confirmDiscard() { return !dirty || window.confirm(t.discard) }
  function resetList() { setEditor(undefined); setValues({}); setBaseline(''); setNotice(''); setUncertain(false); setTokens([undefined]) }
  async function open(id: string, reload = false) {
    if (!table || inFlight.current || (!reload && !confirmDiscard())) return
    inFlight.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const row = await getMasterRecord(table, id)
      const nextValues = Object.fromEntries(table.fields.map((field) => [field.name, fieldInput(row, field)]))
      setEditor({ id, row }); setValues(nextValues); setBaseline(JSON.stringify(nextValues)); setUncertain(false)
    } catch (reason) {
      if (reload && !editor?.row && reason instanceof DataverseError && reason.status === 404) {
        setUncertain(false); setError(t.notCreated)
      } else setError(reasonMessage(reason))
    }
    finally { inFlight.current = false; setBusy(false) }
  }
  async function write(action: 'save' | 'state') {
    if (!table || !editor || !admin || catalog || inFlight.current || uncertain) return
    if (action === 'state' && (dirty || !editor.row || !window.confirm(t.confirm))) return
    if (action === 'save') {
      try { buildMasterChanges(table, values, editor.row) }
      catch (reason) { setError(reasonMessage(reason)); return }
    }
    inFlight.current = true; setBusy(true); setError(''); setNotice('')
    try {
      if (action === 'state') await setMasterActive(table, editor.id, editor.row?.statecode !== 0)
      else await saveMasterRecord(table, editor.id, values, editor.row)
      const row = await getMasterRecord(table, editor.id)
      const nextValues = Object.fromEntries(table.fields.map((field) => [field.name, fieldInput(row, field)]))
      setEditor({ id: editor.id, row }); setValues(nextValues); setBaseline(JSON.stringify(nextValues))
      setNotice(action === 'state' ? t.changed : t.saved); setAttempt((n) => n + 1)
    } catch (reason) { setError(reasonMessage(reason)); setUncertain(true) }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <section className={`page-content master-workspace${catalog ? ' package-catalog' : ''}`}>
    <div className="page-heading"><div><div className="eyebrow">{catalog ? t.catalog : t.administration}</div>
      <h1>{catalog ? t.packages : t.title}</h1><p>{catalog ? t.packageHint : t.hint}</p></div>
      {!catalog && !editor && <button className="button primary" disabled={loading || busy || !table || uncertain} onClick={() => {
        if (!confirmDiscard() || !table) return
        const initial = Object.fromEntries(table.fields.map((field) => [field.name, '']))
        setEditor({ id: crypto.randomUUID() }); setValues(initial); setBaseline(''); setError(''); setNotice('')
      }}>{t.create}</button>}
    </div>
    {(error || metadataError) && <div className="error-box" role="alert"><strong>{t.error}</strong>
      {metadataError && <span>{metadataError}</span>}{error && <span>{error}</span>}
      {uncertain ? <><span>{t.uncertain}</span><button className="button secondary" disabled={busy}
        onClick={() => { if (editor && confirmDiscard()) void open(editor.id, true) }}>{t.reload}</button></>
        : <button className="button secondary" disabled={busy} onClick={() => {
          setAttempt((n) => n + 1)
          if (metadataError) setMetadataAttempt((n) => n + 1)
        }}>{t.retry}</button>}
    </div>}
    {notice && <p role="status" className="inline-state">{notice}</p>}
    {busy && <p role="status">{t.loading}</p>}
    {editor && table ? <section className="dashboard-card master-editor">
      <div className="dashboard-card-heading master-editor-heading"><div>
        <div className="master-editor-meta"><span className="master-record-code">{String(editor.row?.[table.primary] ?? t.create)}</span>
          <span className={`master-status ${editor.row?.statecode === 1 ? 'is-inactive' : 'is-active'}`}>
            {catalog ? t.readOnly : editor.row?.statecode === 1 ? t.inactive : editor.row ? t.active : t.create}
          </span></div>
        <h2>{editor.row && table ? masterRecordLabel(table, editor.row, language) : t.recordDetails}</h2>
      </div>
        <button className="button secondary" disabled={busy} onClick={() => { if (confirmDiscard()) resetList() }}>{t.back}</button></div>
      {dirty && <p className="draft-notice">{t.dirty}</p>}
      {!catalog && <p className="field-help master-units">{t.units}</p>}
      {catalog ? <dl className="master-details">{displayFields.filter((f) => !f.name.endsWith('_base')).map((field) => <div
        className={field.kind === 'MemoType' ? 'master-scope-detail' : ''} key={field.name}>
        <dt>{field.label}</dt><dd>{displayValue(editor.row ?? {}, field, language)}</dd>
      </div>)}</dl> : <form onSubmit={(e) => { e.preventDefault(); void write('save') }}>
        <fieldset disabled={busy || uncertain} className="master-fieldset"><div className="master-fields">
          {displayFields.filter((f) => !f.readOnly && (editor.row ? f.update : f.create)).map((field) => {
            const set = (value: string) => setValues((current) => ({ ...current, [field.name]: value }))
            const value = values[field.name] ?? ''
            return <div className={`master-field${field.kind === 'MemoType' ? ' master-scope-field' : ''}`} key={field.name}>
              <label className="field-label" htmlFor={`master-${field.name}`}>{field.label}{field.required && <span aria-hidden="true"> *</span>}</label>
              {field.kind === 'LookupType' ? <LookupField field={field} value={value}
                selectedLabel={editor.row && value === fieldInput(editor.row, field) ? displayValue(editor.row, field, language) : undefined}
                onChange={set} language={language} disabled={busy || uncertain} />
                : field.kind === 'BooleanType' || field.kind === 'PicklistType' ? <select id={`master-${field.name}`} aria-label={field.label} className="text-input" value={value}
                  required={field.required} onChange={(e) => set(e.target.value)}>
                  <option value="">{t.choose}</option>{field.options.map((option) => <option key={option.value} value={option.value}>
                    {field.kind === 'BooleanType' ? language === 'fr' ? option.value ? 'Oui' : 'Non' : option.value ? 'Yes' : 'No' : option.label}
                  </option>)}</select>
                  : field.kind === 'MemoType' ? <textarea id={`master-${field.name}`} aria-label={field.label} className="text-input" value={value}
                    maxLength={field.maxLength} required={field.required} onChange={(e) => set(e.target.value)} rows={4} />
                    : <input id={`master-${field.name}`} aria-label={field.label} className="text-input" value={value} maxLength={field.maxLength}
                      type={field.kind === 'DateTimeType' ? 'date' : ['DecimalType', 'DoubleType', 'MoneyType', 'IntegerType'].includes(field.kind) ? 'number' : 'text'}
                      min={field.min} max={field.max}
                      step={field.kind === 'IntegerType' ? '1' : 'any'} required={field.required} onChange={(e) => set(e.target.value)} />}
            </div>
          })}
        </div><div className="master-actions"><button className="button primary" disabled={!dirty}>{t.save}</button>
          {editor.row && <button type="button" className="button secondary" disabled={dirty} onClick={() => void write('state')}>
            {editor.row.statecode === 0 ? t.deactivate : t.activate}</button>}
        </div></fieldset>
      </form>}
    </section> : <>
      <div className={`master-filters${catalog ? ' catalog-filters' : ''}`}>
        {!catalog && <label className="field-label">{t.table}<select className="text-input" aria-label={t.table} value={name} disabled={busy}
          onChange={(e) => { resetList(); setLoading(true); setName(e.target.value); setSearch('') }}>
          {masterTables.map((entry) => <option key={entry.logicalName} value={entry.logicalName}>{language === 'fr' ? entry.fr : entry.en}</option>)}
        </select></label>}
        <label className="field-label master-search">{t.search}<input className="text-input" type="search" value={search} maxLength={150} disabled={busy}
          onChange={(e) => { setLoading(true); setTokens([undefined]); setSearch(e.target.value) }} /></label>
        <label className="field-label">{t.status}<select className="text-input" aria-label={t.status} value={status} disabled={busy}
          onChange={(e) => { setLoading(true); setTokens([undefined]); setStatus(e.target.value) }}>
          <option value="0">{t.active}</option><option value="1">{t.inactive}</option><option value="">{t.all}</option>
        </select></label>
      </div>
      {loading ? <p role="status">{t.loading}</p> : page && table && <section className="dashboard-card master-records">
        <div className="master-list-toolbar"><h2>{catalog ? t.packages : table ? language === 'fr' ? table.fr : table.en : t.title}</h2>
          <span>{page.records.length} {t.shown}</span></div>
        {page.records.length > 0 && <div className="master-column-headings" aria-hidden="true">
          <span>{t.record}</span><span>{t.description}</span><span>{t.status}</span><span>{t.action}</span>
        </div>}
        {!page.records.length && <p>{t.empty}</p>}
        {page.records.map((row) => <article className="master-record" key={String(row[table?.id ?? ''])}>
          <h2 className="master-record-code">{String(row[table?.primary ?? ''] ?? '—')}</h2>
          <p className="master-record-description">{table && masterRecordLabel(table, row, language) !== String(row[table.primary])
            ? masterRecordLabel(table, row, language) : '—'}</p>
          <span className={`master-status ${row.statecode === 0 ? 'is-active' : 'is-inactive'}`}>{row.statecode === 0 ? t.active : t.inactive}</span>
          <button className="button secondary" disabled={busy} onClick={() => void open(String(row[table?.id ?? '']))}>{catalog ? t.details : t.edit}</button>
        </article>)}
        <div className="request-pagination">
          <button className="button secondary" disabled={busy || tokens.length === 1}
            onClick={() => { setLoading(true); setTokens((current) => current.slice(0, -1)) }}>{t.previous}</button>
          <span>{t.page} {tokens.length}</span>
          <button className="button secondary" disabled={busy || !page.skipToken}
            onClick={() => { setLoading(true); setTokens((current) => [...current, page.skipToken]) }}>{t.next}</button>
        </div>
      </section>}
    </>}
  </section>
}
