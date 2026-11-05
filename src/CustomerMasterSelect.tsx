import { useEffect, useEffectEvent, useState } from 'react'
import {
  searchAccountMasters, searchContactMasters, getCustomerDefaults, type AccountMasterOption, type ContactMasterOption,
} from './data/customerMasterRepository'
import { defaultContact, type CustomerDefaults } from './data/customerMasterContract'
import type { Market } from './data/estimateQuery'

type Props = {
  market: Market
  account: AccountMasterOption | null
  contact: ContactMasterOption | null
  onAccount: (account: AccountMasterOption | null) => void
  onContact: (contact: ContactMasterOption | null) => void
  language: 'en' | 'fr'
  disabled: boolean
  branchId: string
  building: string
  onBuilding: (value: string) => void
}

export function CustomerMasterSelect({
  market, account, contact, onAccount, onContact, language, disabled, branchId, building, onBuilding,
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
  const applyDefaults = useEffectEvent((result: CustomerDefaults) => {
    if (disabled) return
    const selected = defaultContact(result)
    if (!contact && selected) onContact(selected)
  })

  const accountId = account?.id
  useEffect(() => {
    if (!accountId || !branchId) return
    let active = true
    void getCustomerDefaults(accountId, branchId, market).then(
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
  }, [accountId, branchId, market, defaultsAttempt])

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
    if (!account || query.length < 2) return
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
  }, [account, contactQuery])

  return <div className="customer-master-select">
    <div className="customer-master-field">
      <div className="input-grid">
      <label className="field-label" htmlFor="account-master-search">
        {fr ? 'Numéro de compte' : 'Account number'}<span className="required">*</span>
        <input id="account-master-search" className="text-input" type="search" maxLength={100}
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
        : fr ? 'Aucun contact actif avec courriel n’est disponible pour ce compte dans Dataverse.' : 'No eligible active Contact with email is available for this Account in Dataverse.'}</p>}
      {defaults?.contactsTruncated && <p className="field-help">{fr ? 'Affichage limité : recherchez le contact par nom ou courriel.' : 'More Contacts exist: search by name or email to refine the list.'}</p>}
    </div>}
    <div className="customer-master-field">
      <label className="field-label" htmlFor="customer-name">
        {fr ? 'Nom du contact' : 'Contact name'}<span className="required">*</span>
        <input id="customer-name" className="text-input" type="search" maxLength={100}
          autoComplete="off" disabled={disabled || !account} aria-required="true"
          placeholder={fr ? 'Rechercher par nom ou courriel' : 'Search by name or email'}
          value={contact?.name ?? contactQuery} readOnly={!!contact} onChange={(event) => {
            if (contact) onContact(null)
            const query = event.target.value
            setContactResults([])
            setContactError('')
            setContactLoading(query.trim().length >= 2)
            setContactQuery(query)
          }} />
      </label>
      {contact && <p className="field-help">
        {contact.email}{contact.phone ? ` — ${contact.phone}` : ''}
        <button className="button secondary" type="button" disabled={disabled}
          onClick={() => { onContact(null); setContactQuery(''); setContactResults([]) }}>
          {fr ? 'Changer de contact' : 'Change Contact'}
        </button>
      </p>}
      {!account && <p className="field-help">{fr ? 'Sélectionnez d’abord un compte.' : 'Select an Account first.'}</p>}
      {account && !contact && !contactQuery && defaults && defaults.contacts.length > 0 &&
        <ul className="customer-linked-options" aria-label={fr ? 'Contacts liés' : 'Linked Contacts'}>
          {defaults.contacts.map(row => <li key={row.id}><button className="button secondary" type="button" disabled={disabled}
            onClick={() => onContact(row)}>{row.name} — {row.email}</button></li>)}
        </ul>}
      {contactQuery.trim().length >= 2 && account && <div className="branch-popup" role="region" aria-label={fr ? 'Résultats de contacts' : 'Contact results'}>
        {contactLoading && <p role="status">{fr ? 'Recherche…' : 'Searching…'}</p>}
        {contactError && <p className="error-box compact" role="alert">{contactError}</p>}
        {!contactLoading && !contactError && contactResults.length === 0 &&
          <p className="field-help">{fr ? 'Aucun contact actif correspondant.' : 'No matching active Contacts.'}</p>}
        <ul id="customer-name-options" role="listbox" aria-label={fr ? 'Contacts' : 'Contacts'}>
          {contactResults.map((row) => <li key={row.id} role="option" aria-selected={row.id === contact?.id}>
            <button type="button" disabled={disabled} onClick={() => {
              onContact(row); setContactQuery(''); setContactResults([])
            }}>{row.name} — {row.email}{row.phone ? ` — ${row.phone}` : ''}</button>
          </li>)}
        </ul>
      </div>}
    </div>
    <div className="customer-master-field">
      <label className="field-label" htmlFor="account-functional-locations">
        {fr ? 'Numéros d’emplacements fonctionnels (Dataverse)' : 'Functional location numbers (Dataverse)'}
        <input id="account-functional-locations" className="text-input" readOnly
          value={defaults?.locations.join(', ') ?? ''} />
      </label>
      <label className="field-label" htmlFor="opportunity-building">
        {fr ? 'Description de l’emplacement fonctionnel' : 'Functional Location Description'}<span className="required">*</span>
        <input id="opportunity-building" className="text-input" required aria-required="true" maxLength={300}
          disabled={disabled} value={building}
          onChange={event => onBuilding(event.target.value)} />
      </label>
      <p className="field-help">{!account
        ? fr ? 'Sélectionnez un compte pour charger les emplacements liés.' : 'Select an Account to fetch linked functional locations.'
        : defaults && defaults.locations.length === 0
          ? fr ? 'Aucun emplacement lié à ce compte et cette succursale. Saisissez la valeur manquante ; aucune adresse de facturation n’est utilisée.' : 'No linked functional location for this Account and Branch. Enter the missing value; billing addresses are not used as building names.'
          : fr ? 'Les numéros proviennent des équipements liés au compte et à la succursale. Saisissez ou confirmez la description : un numéro d’emplacement n’est pas un nom de bâtiment.' : 'Numbers are fetched from Equipment linked to this Account and Branch. Enter or confirm the description: a location number is not a building name.'}</p>
      {defaults?.locationsTruncated && <p className="field-help">{fr ? 'Seuls les 20 premiers numéros d’emplacements sont affichés.' : 'Only the first 20 functional location numbers are shown.'}</p>}
    </div>
  </div>
}
