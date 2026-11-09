export type AccountMasterOption = { id: string; number: string; name: string }
export type ContactMasterOption = { id: string; name: string; email: string; phone: string; primary?: boolean }
export type AccountLocationOption = { number: string; name: string }
export type CustomerDefaults = {
  contacts: ContactMasterOption[]; contactsTruncated: boolean; locations: string[]; locationsTruncated: boolean
  locationDescriptions: string[]; locationDescriptionsTruncated: boolean; locationDescriptionsTooLong: boolean
  locationOptions: AccountLocationOption[]; locationNamesUnavailable: boolean
}

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseRows<T>(value: unknown, key: 'accounts' | 'contacts', parse: (row: unknown) => T): T[] {
  if (!value || typeof value !== 'object')
    throw new Error('Customer master search returned an invalid response.')
  const rows = (value as Record<string, unknown>)[key]
  if (!Array.isArray(rows)) throw new Error('Customer master search returned an invalid response.')
  const parsed = rows.map(parse)
  if (parsed.length > 20) throw new Error('Customer master search exceeded its result limit.')
  return parsed
}

export function parseAccountMasterOptions(value: unknown): AccountMasterOption[] {
  return parseRows(value, 'accounts', (row) => {
    if (!row || typeof row !== 'object') throw new Error('Customer master search returned an invalid Account.')
    const account = row as Partial<AccountMasterOption>
    if (typeof account.id !== 'string' || !guidPattern.test(account.id) ||
      typeof account.number !== 'string' || typeof account.name !== 'string')
      throw new Error('Customer master search returned an invalid Account.')
    return { id: account.id, number: account.number, name: account.name }
  })
}

export function parseContactMasterOptions(value: unknown): ContactMasterOption[] {
  return parseRows(value, 'contacts', (row) => {
    if (!row || typeof row !== 'object') throw new Error('Customer master search returned an invalid Contact.')
    const contact = row as Partial<ContactMasterOption>
    if (typeof contact.id !== 'string' || !guidPattern.test(contact.id) ||
      typeof contact.name !== 'string' || typeof contact.email !== 'string' ||
      typeof contact.phone !== 'string' || (contact.primary !== undefined && typeof contact.primary !== 'boolean'))
      throw new Error('Customer master search returned an invalid Contact.')
    return { id: contact.id, name: contact.name, email: contact.email, phone: contact.phone,
      ...(contact.primary === undefined ? {} : { primary: contact.primary }) }
  })
}

export function parseCustomerDefaults(value: unknown): CustomerDefaults {
  const contacts = parseContactMasterOptions(value)
  const row = value as Record<string, unknown>
  if ((row.contactsTruncated !== undefined && typeof row.contactsTruncated !== 'boolean') ||
    (row.locationsTruncated !== undefined && typeof row.locationsTruncated !== 'boolean') ||
    !Array.isArray(row.locations) || row.locations.length > 20 ||
    row.locations.some(location => typeof location !== 'string' || !location.trim() || location.length > 100) ||
    !Array.isArray(row.locationDescriptions) || row.locationDescriptions.length > 20 ||
    row.locationDescriptions.some(value => typeof value !== 'string' || !value.trim() || value.length > 300) ||
    (row.locationDescriptionsTruncated !== undefined && typeof row.locationDescriptionsTruncated !== 'boolean') ||
    (row.locationDescriptionsTooLong !== undefined && typeof row.locationDescriptionsTooLong !== 'boolean') ||
    (row.locationNamesUnavailable !== undefined && typeof row.locationNamesUnavailable !== 'boolean') ||
    !Array.isArray(row.locationOptions) || row.locationOptions.length > 20)
    throw new Error('Customer defaults require the updated draft API and valid functional locations.')
  const locationOptions = row.locationOptions.map((option: unknown): AccountLocationOption => {
    if (!option || typeof option !== 'object')
      throw new Error('Customer defaults returned an invalid Account location.')
    const location = option as Partial<AccountLocationOption>
    if (typeof location.number !== 'string' || !location.number.trim() || location.number.length > 100 ||
      typeof location.name !== 'string' || !location.name.trim() || location.name.length > 300)
      throw new Error('Customer defaults returned an invalid Account location.')
    return { number: location.number, name: location.name }
  }).filter((option, index, rows) => rows.findIndex(row => row.number === option.number && row.name === option.name) === index)
  return { contacts, contactsTruncated: row.contactsTruncated === true,
    locations: row.locations, locationsTruncated: row.locationsTruncated === true,
    locationDescriptions: [...new Set(row.locationDescriptions)],
    locationDescriptionsTruncated: row.locationDescriptionsTruncated === true,
    locationDescriptionsTooLong: row.locationDescriptionsTooLong === true,
    locationOptions, locationNamesUnavailable: row.locationNamesUnavailable === true }
}

export function defaultLocationDescription(defaults: CustomerDefaults): string | undefined {
  if (!defaults.locationsTruncated && !defaults.locationDescriptionsTruncated && !defaults.locationDescriptionsTooLong &&
    !defaults.locationNamesUnavailable && defaults.locationOptions.length === 1) return defaults.locationOptions[0].name
}

export function defaultContact({ contacts, contactsTruncated }: CustomerDefaults): ContactMasterOption | undefined {
  if (contactsTruncated) return
  const primary = contacts.filter(contact => contact.primary)
  return primary.length === 1 ? primary[0] : primary.length === 0 && contacts.length === 1 ? contacts[0] : undefined
}
