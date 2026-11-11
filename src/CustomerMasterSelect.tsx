import { useEffect, useEffectEvent, useState, type ReactNode } from 'react'
import {
  searchAccountMasters, searchContactMasters, getCustomerDefaults, type AccountMasterOption, type ContactMasterOption,
} from './data/customerMasterRepository'
import { defaultContact, defaultLocationDescription, type CustomerDefaults } from './data/customerMasterContract'
import type { Market } from './data/estimateQuery'
import { FieldError } from './FieldError'

type Props = {
  market: Market
  account: AccountMasterOption | null
  contact: ContactMasterOption | null
  onAccount: (account: AccountMasterOption | null) => void
  onContact: (contact: ContactMasterOption | null, preserveManual?: boolean) => void
  language: 'en' | 'fr'
  disabled: boolean
  branchId: string
  building: string
  buildingInitialized: boolean
  onBuilding: (value: string) => void
  customerName: string
  onCustomerName: (value: string) => void
  emailField: ReactNode
  phoneField: ReactNode
  errors?: Record<string, string | undefined>
  loadDefaults?: (accountId: string, branchId: string, market: Market, refresh?: boolean) => Promise<CustomerDefaults>
}

export function CustomerMasterSelect({
  market, account, contact, onAccount, onContact, language, disabled, branchId, building, buildingInitialized, onBuilding,
  customerName, onCustomerName, emailField, phoneField, errors = {}, loadDefaults = getCustomerDefaults,
}: Props) {
  const fr = language === 'fr'
  const [accountQuery, setAccountQuery] = useState('')
  const [accountResults, setAccountResults] = useState<AccountMasterOption[]>([])
  const [accountLoading, setAccountLoading] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [contactQuery, setContactQuery] = useState('')
  const [contactResults, setContactResults] = useState<ContactMasterOption[]>([])
  const [contactLoading, setContactLoading] = useState(false)
  const [contactError, setContactError] = useState('')
  const [defaults, setDefaults] = useState<CustomerDefaults>()
  const [defaultsError, setDefaultsError] = useState('')
  const [defaultsAttempt, setDefaultsAttempt] = useState(0)
  const [selectedLocationKey, setSelectedLocationKey] = useState('')
  const [customLocation, setCustomLocation] = useState(false)
  const [contactOptionsOpen, setContactOptionsOpen] = useState(false)
  const manualContact = !!defaults && !defaults.contacts.length && !defaults.contactsTruncated
  const matchingLocations = defaults?.locationOptions.filter(option => option.name === building) ?? []
  const selectedLocation = matchingLocations.find(option => JSON.stringify([option.number, option.name]) === selectedLocationKey)
    ?? (matchingLocations.length === 1 ? matchingLocations[0] : undefined)
  const locationDropdown = (defaults?.locationOptions.length ?? 0) > 1 && !customLocation &&
    (!building.trim() || !!selectedLocation)
  const contactOptions = contactQuery.trim().length >= 2 ? contactResults : defaults?.contacts ?? []
  const applyDefaults = useEffectEvent((result: CustomerDefaults) => {
    if (disabled) return
    const selected = defaultContact(result)
    if (!contact && !customerName.trim() && selected) onContact(selected, true)
    const description = defaultLocationDescription(result)
    if (!buildingInitialized && !building.trim() && description) onBuilding(description)
  })

  const accountId = account?.id
  useEffect(() => {
    if (!accountId || !branchId) return
    let active = true
    void loadDefaults(accountId, branchId, market, defaultsAttempt > 0).then(
      (result) => {
        if (!active) return
        setDefaults(result); setDefaultsError('')
        applyDefaults(result)
      },
      (reason: unknown) => {
        if (active) setDefaultsError(reason instanceof Error ? reason.message : String(reason))
      },
    )
    return () => { active = false }
  }, [accountId, branchId, market, defaultsAttempt, loadDefaults])

  useEffect(() => {
    const query = accountQuery.trim()
    if (query.length < 2) return
    let active = true
    const timer = setTimeout(() => {
      setAccountLoading(true)
      setAccountError('')
      void searchAccountMasters(market, query).then(
        (rows) => { if (active) setAccountResults(rows) },
        (reason: unknown) => { if (active) setAccountError(reason instanceof Error ? reason.message : String(reason)) },
      ).finally(() => { if (active) setAccountLoading(false) })
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [accountQuery, market])

  useEffect(() => {
    const query = contactQuery.trim()
    if (!account || manualContact || query.length < 2) return
    let active = true
    const timer = setTimeout(() => {
      setContactLoading(true)
      setContactError('')
      void searchContactMasters(account.id, query).then(
        (rows) => { if (active) setContactResults(rows) },
        (reason: unknown) => { if (active) setContactError(reason instanceof Error ? reason.message : String(reason)) },
      ).finally(() => { if (active) setContactLoading(false) })
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [account, contactQuery, manualContact])

  return <div className="customer-master-select">
    <div className="customer-master-field customer-account-fields">
      <div className="input-grid">
      <label className="field-label" htmlFor="account-master-search">
        <span>{fr ? 'Numéro de compte' : 'Account number'}<span className="required" aria-hidden="true">*</span></span>
        <FieldError id="account-master-search" message={errors['account-master-search']} />
        <input id="account-master-search" className="text-input" type="search" maxLength={100}
          aria-invalid={!!errors['account-master-search']} aria-describedby={errors['account-master-search'] ? 'account-master-search-error' : undefined}
          autoComplete="off" disabled={disabled} aria-required="true"
          placeholder={fr ? 'Rechercher par numéro ou nom de compte' : 'Search by account number or name'}
          value={account?.number ?? accountQuery} readOnly={!!account} onChange={(event) => {
            if (account) { onAccount(null); onContact(null) }
            const query = event.target.value
            setAccountResults([])
            setAccountError('')
            setAccountLoading(query.trim().length >= 2)
            setAccountQuery(query)
          }} />
      </label>
      <label className="field-label" htmlFor="account-master-name">
        {fr ? 'Nom du compte' : 'Account name'}
        <input id="account-master-name" className="text-input" readOnly value={account?.name ?? ''} />
      </label>
      </div>
      <p className="field-help">{account
        ? `${account.number} — ${account.name}`
        : fr ? 'Recherchez un compte importé dans le marché sélectionné.' : 'Search imported Accounts in the selected market.'}</p>
      {account && <button className="button secondary" type="button" disabled={disabled}
        onClick={() => { onAccount(null); onContact(null); setAccountQuery(''); setContactQuery('') }}>
        {fr ? 'Changer de compte' : 'Change account'}
      </button>}
      {accountQuery.trim().length >= 2 && <div className="branch-popup" role="region" aria-label={fr ? 'Résultats de comptes' : 'Account results'}>
        {accountLoading && <p role="status">{fr ? 'Recherche…' : 'Searching…'}</p>}
        {accountError && <p className="error-box compact" role="alert">{accountError}</p>}
        {!accountLoading && !accountError && accountResults.length === 0 &&
          <p className="field-help">{fr ? 'Aucun compte correspondant.' : 'No matching Accounts.'}</p>}
        <ul id="account-master-options" role="listbox" aria-label={fr ? 'Comptes' : 'Accounts'}>
          {accountResults.map((row) => <li key={row.id} role="option" aria-selected={row.id === account?.id}>
            <button type="button" disabled={disabled} onClick={() => {
              onAccount(row); onContact(null); setAccountQuery(''); setAccountResults([]); setContactQuery('')
            }}>{row.number} — {row.name}</button>
          </li>)}
        </ul>
      </div>}
    </div>

    {account && <div className="customer-defaults-state">
      {!branchId && <p className="field-help">{fr ? 'Sélectionnez une succursale pour charger les valeurs liées.' : 'Select a Branch to fetch linked defaults.'}</p>}
      {branchId && !defaults && !defaultsError && <p role="status">{fr ? 'Chargement des données liées…' : 'Fetching linked customer data…'}</p>}
      {defaultsError && <div className="error-box" role="alert">{defaultsError}
        <button className="button secondary" type="button" disabled={disabled}
          onClick={() => { setDefaultsError(''); setDefaultsAttempt(value => value + 1) }}>
          {fr ? 'Réessayer' : 'Retry'}
        </button>
      </div>}
      {defaults && !contact && <p className="field-help" role="status">{defaults.contacts.length
        ? fr ? 'Choisissez un contact ci-dessous ; aucune sélection unique ne peut être déduite.' : 'Choose a linked Contact below; there is no unambiguous default.'
        : fr ? 'Aucun contact actif disponible. Saisissez les coordonnées manquantes pour ce devis.' : 'No eligible active Contact is available. Enter the missing contact details for this estimate.'}</p>}
      {defaults?.contactsTruncated && <p className="field-help">{fr ? 'Affichage limité : recherchez le contact par nom ou courriel.' : 'More Contacts exist: search by name or email to refine the list.'}</p>}
    </div>}
    <div className="customer-master-field" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setContactOptionsOpen(false)
    }} onKeyDown={event => { if (event.key === 'Escape') setContactOptionsOpen(false) }}>
      <label className="field-label" htmlFor="customer-name">
        <span>{fr ? 'Nom du contact' : 'Contact name'}<span className="required">*</span></span>
        <FieldError id="customer-name" message={errors['customer-name']} />
        <input id="customer-name" className="text-input" type={manualContact ? 'text' : 'search'} maxLength={100}
          autoComplete="off" disabled={disabled || !account}
          aria-invalid={!!errors['customer-name']} aria-describedby={errors['customer-name'] ? 'customer-name-error' : undefined}
          aria-required="true" role={manualContact ? undefined : 'combobox'} aria-expanded={manualContact ? undefined : contactOptionsOpen && !contact}
          aria-controls={manualContact ? undefined : 'customer-name-options'} aria-autocomplete={manualContact ? undefined : 'list'}
          placeholder={fr ? 'Choisir un contact ou saisir un nom' : 'Choose a Contact or enter a name'}
          value={contact?.name.trim() ? contact.name : customerName} readOnly={!!contact?.name.trim()}
          onFocus={() => { if (!contact && !manualContact) setContactOptionsOpen(true) }}
          onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); setContactOptionsOpen(false) }
            if (event.key === 'ArrowDown' && contactOptionsOpen) {
              event.preventDefault()
              event.currentTarget.closest('.customer-master-field')?.querySelector<HTMLButtonElement>('#customer-name-options button')?.focus()
            }
          }}
          onChange={(event) => {
            const query = event.target.value
            onCustomerName(query)
            setContactResults([])
            setContactError('')
            setContactLoading(!manualContact && query.trim().length >= 2)
            setContactQuery(query)
            setContactOptionsOpen(!manualContact)
          }} />
      </label>
      {contact && <p className="field-help customer-contact-actions">
        <span>{contact.email}{contact.phone ? ` — ${contact.phone}` : ''}</span>
        <button className="button secondary" type="button" disabled={disabled}
          onClick={() => { onContact(null); setContactQuery(''); setContactResults([]); setContactOptionsOpen(true) }}>
          {fr ? 'Changer de contact' : 'Change Contact'}
        </button>
      </p>}
      {!account && <p className="field-help">{fr ? 'Sélectionnez d’abord un compte.' : 'Select an Account first.'}</p>}
      {account && <p className="field-help">
        {fr
          ? 'Les valeurs Dataverse disponibles sont utilisées directement. Complétez les champs manquants ; ils sont enregistrés uniquement sur ce devis, sans modifier le contact partagé.'
          : 'Available Dataverse values are used directly. Fill in missing fields; manual details are saved only on this estimate, without changing shared Contacts.'}
      </p>}
      {account && !contact && !!defaults?.contacts.length && <button className="button secondary" type="button" disabled={disabled}
        onClick={() => { setContactQuery(''); setContactOptionsOpen(value => !value) }}>
        {fr ? 'Choisir un contact lié' : 'Choose a linked Contact'}
      </button>}
      {contactOptionsOpen && !manualContact && !contact && account && <div className="branch-popup" role="region" aria-label={fr ? 'Résultats de contacts' : 'Contact results'}>
        {contactLoading && contactQuery.trim().length >= 2 && <p role="status">{fr ? 'Recherche…' : 'Searching…'}</p>}
        {contactError && <p className="error-box compact" role="alert">{contactError}</p>}
        {!contactLoading && !contactError && contactOptions.length === 0 &&
          <p className="field-help">{fr ? 'Aucun contact correspondant. Le nom saisi est utilisé pour ce devis.' : 'No matching Contacts. The entered name is used for this estimate.'}</p>}
        <ul id="customer-name-options" className="customer-linked-options" role="listbox" aria-label={fr ? 'Contacts' : 'Contacts'}>
          {contactOptions.map((row) => <li key={row.id} role="option" aria-selected={false}>
            <button type="button" disabled={disabled} onClick={() => {
              onContact(row); setContactQuery(''); setContactResults([]); setContactOptionsOpen(false)
            }}>{row.name} — {row.email}{row.phone ? ` — ${row.phone}` : ''}</button>
          </li>)}
        </ul>
      </div>}
    </div>
    {emailField}
    {phoneField}
    <div className="customer-master-field">
      <label className="field-label" htmlFor={locationDropdown ? 'account-location-description' : 'opportunity-building'}>
        <span>{fr ? 'Description de l’emplacement fonctionnel' : 'Functional Location Description'}</span>
        <FieldError id="opportunity-building" message={errors['opportunity-building']} />
        {!locationDropdown && <input id="opportunity-building" className="text-input" maxLength={300}
          aria-invalid={!!errors['opportunity-building']} aria-describedby={errors['opportunity-building'] ? 'opportunity-building-error' : undefined}
          disabled={disabled} value={building}
          onChange={event => { setCustomLocation(true); setSelectedLocationKey(''); onBuilding(event.target.value) }} />}
        {locationDropdown && <select id="account-location-description" className="text-input" disabled={disabled}
          aria-invalid={!!errors['opportunity-building']} aria-describedby={errors['opportunity-building'] ? 'opportunity-building-error' : undefined}
          value={selectedLocation ? JSON.stringify([selectedLocation.number, selectedLocation.name]) : ''}
          onChange={event => {
            if (event.target.value === 'custom') { setCustomLocation(true); return }
            if (event.target.value === '') { setSelectedLocationKey(''); onBuilding(''); return }
            const option = defaults?.locationOptions.find(option => JSON.stringify([option.number, option.name]) === event.target.value)
            if (option) { setSelectedLocationKey(event.target.value); onBuilding(option.name) }
          }}>
          <option value="">{fr ? 'Choisir un emplacement' : 'Choose a location'}</option>
          {defaults?.locationOptions.map(option =>
            <option key={JSON.stringify([option.number, option.name])} value={JSON.stringify([option.number, option.name])}>{option.number} — {option.name}</option>)}
          <option value="custom">{fr ? 'Saisir une description personnalisée' : 'Enter a custom description'}</option>
        </select>}
      </label>
      {!locationDropdown && !!defaults?.locationOptions.length && <button className="button secondary" type="button" disabled={disabled}
        onClick={() => {
          setCustomLocation(false); setSelectedLocationKey('')
          onBuilding(defaults.locationOptions.length === 1 ? defaults.locationOptions[0].name : '')
        }}>
        {defaults.locationOptions.length === 1
          ? fr ? 'Utiliser l’emplacement lié' : 'Use linked location'
          : fr ? 'Choisir un emplacement lié' : 'Choose a linked location'}
      </button>}
      {!!defaults?.locations.length && <p id="account-functional-locations" className="field-help">
        {fr ? 'Emplacements SAP : ' : 'SAP locations: '}{selectedLocation?.number ?? defaults.locations.join(', ')}
      </p>}
      <p className="field-help">{!account
        ? fr ? 'Sélectionnez un compte pour charger les emplacements liés.' : 'Select an Account to fetch linked functional locations.'
        : defaults && defaults.locationOptions.length === 0
          ? fr ? 'Aucun nom d’emplacement source utilisable pour ce compte et cette succursale. Saisissez la valeur manquante ; aucune description d’équipement ni adresse de facturation n’est utilisée.' : 'No usable source Location.Name for this Account and Branch. Enter the missing description; Equipment Description and billing addresses are not substituted.'
          : fr ? 'Les emplacements sont chargés depuis le compte et la succursale avant la sélection des équipements. La description utilise Location.Name du fichier source. Un seul emplacement est prérempli ; sinon, choisissez un emplacement. Les valeurs enregistrées ou saisies sont conservées.' : 'Locations are fetched by Account and Branch before Equipment selection. Description uses source Location.Name. A sole location is autofilled; otherwise choose a location. Saved or manually entered values are preserved.'}</p>
      {defaults?.locationDescriptionsTruncated && <p className="field-help" role="status">
        {fr ? 'Liste incomplète : au maximum 20 emplacements sont affichés après lecture de 2 000 équipements. Aucun emplacement unique ne peut être déduit ; choisissez ou confirmez la valeur.' : 'Incomplete list: at most 20 locations are shown, scanning up to 2,000 Equipment records. No sole location is inferred; choose or confirm the value.'}
      </p>}
      {defaults?.locationNamesUnavailable && <p className="field-help" role="status">
        {fr ? 'Certains équipements n’ont pas de numéro et de nom d’emplacement source vérifiables. Aucun emplacement n’est prérempli ; choisissez ou saisissez une valeur confirmée.' : 'Some Equipment lacks a verifiable source location number/name pair. No location is autofilled; choose or enter a confirmed value.'}
      </p>}
      {defaults?.locationDescriptionsTooLong && <p className="field-help" role="status">
        {fr ? 'Certaines descriptions dépassent la limite de 300 caractères et ne sont pas copiées ni tronquées. Confirmez une description conforme.' : 'Some descriptions exceed the 300-character limit and are not copied or truncated. Confirm a description within the limit.'}
      </p>}
      {defaults?.locationsTruncated && <p className="field-help">{fr ? 'Seuls les 20 premiers numéros d’emplacements sont affichés.' : 'Only the first 20 functional location numbers are shown.'}</p>}
    </div>
  </div>
}
