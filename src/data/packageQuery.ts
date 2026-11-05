export function packageContextFilter(countryId: string, currencyId: string): string {
  const guid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
  if (!guid.test(countryId) || !guid.test(currencyId))
    throw new Error('Package country and currency references are missing or invalid.')
  return `statecode eq 0 and (_re_country_value eq ${countryId} or _re_country_value eq null) and ` +
    `(_re_currency_value eq ${currencyId} or (_re_currency_value eq null and _transactioncurrencyid_value eq ${currencyId}))`
}
