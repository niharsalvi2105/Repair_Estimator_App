export const CATALOG_ISSUES = [
  'inactive', 'missing-valid-from', 'future', 'expired', 'missing-source-key', 'missing-source-version',
  'missing-refreshed-on', 'missing-description', 'missing-uom', 'invalid-source-currency',
  'unsupported-pricing-unit', 'invalid-cost', 'invalid-price', 'invalid-master-type',
  'invalid-converted-cost', 'invalid-converted-price',
] as const
export type CatalogIssue = typeof CATALOG_ISSUES[number]
export type CatalogDetails = {
  version: 1
  number: string
  masterPartType?: string | null
  state: number | null
  sourceCost: number | null
  sourcePrice: number | null
  pricingUnit: number | null
  sourceCurrency: string | null
  sourceKey: string | null
  sourceVersion: string | null
  description: string | null
  descriptionFr: string | null
  uom: string | null
  effectiveFrom: string | null
  effectiveTo: string | null
  refreshedOn: string | null
  salesOrganization: string | null
  distributionChannel: string | null
  conditionRecord: string | null
  unitCost: number | null
  unitPrice: number | null
  requiresCost: boolean
  requiresSellingPrice: boolean
  requiresDescription: boolean
  requiresUom: boolean
  issues: CatalogIssue[]
}
export type CatalogPart = {
  id: string
  number: string
  description: string
  partType?: 'kone' | 'non-kone' | null
  unitCost: number | null
  unitPrice: number | null
  uom: string
  details: CatalogDetails
}
export type CatalogResult = {
  catalogVersion: 2
  available: boolean
  reason?: string
  currency?: string
  defaultMarkupPercent: number
  more: boolean
  parts: CatalogPart[]
  nextPage?: number | null
  nextCursor?: string | null
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

export function parseCatalogDetails(value: unknown): CatalogDetails {
  if (!value || typeof value !== 'object') throw new Error('The parts catalog returned invalid source details.')
  const details = value as Partial<CatalogDetails>
  const strings = [
    details.sourceCurrency, details.sourceKey, details.sourceVersion, details.description, details.descriptionFr,
    details.uom, details.effectiveFrom, details.effectiveTo, details.refreshedOn, details.salesOrganization,
    details.distributionChannel, details.conditionRecord,
  ]
  const numbers = [details.state, details.sourceCost, details.sourcePrice, details.pricingUnit, details.unitCost, details.unitPrice]
  if (details.version !== 1 || typeof details.number !== 'string' ||
    (details.masterPartType != null && typeof details.masterPartType !== 'string') ||
    !strings.every(isNullableString) || !numbers.every(isNullableNumber) ||
    ![details.requiresCost, details.requiresSellingPrice, details.requiresDescription, details.requiresUom].every(v => typeof v === 'boolean') ||
    !Array.isArray(details.issues) || details.issues.some(issue => !CATALOG_ISSUES.includes(issue as CatalogIssue)))
    throw new Error('The parts catalog returned invalid source details.')
  return details as CatalogDetails
}

export function parsePartCatalog(value: unknown): CatalogResult {
  if (!value || typeof value !== 'object') throw new Error('Invalid parts catalog response.')
  const result = value as Partial<CatalogResult> & { mode?: string; catalogVersion?: number }
  if (result.catalogVersion !== 2)
    throw new Error('Catalog update required: the deployed backend must support catalog version 2. Publish the catalog diagnostics column and deploy the updated Drafts and pricing plugins.')
  if (!['partcatalog', 'partcapabilities'].includes(result.mode ?? '') ||
    typeof result.available !== 'boolean' ||
    !Array.isArray(result.parts) || typeof result.more !== 'boolean' ||
    (result.available ? result.defaultMarkupPercent !== 10 : !Number.isFinite(result.defaultMarkupPercent)) ||
    (result.nextPage != null && (!Number.isInteger(result.nextPage) || result.nextPage < 2)) ||
    (result.nextCursor != null && typeof result.nextCursor !== 'string') ||
    (result.more && (result.nextPage == null || !result.nextCursor)))
    throw new Error('The parts catalog service is not available in the deployed backend.')
  if (result.available && (!['USD', 'CAD'].includes(result.currency ?? '')))
    throw new Error('Invalid parts pricing configuration.')
  if (!result.available && (typeof result.reason !== 'string' || !result.reason.trim()))
    throw new Error('Parts catalog unavailable without a diagnostic.')
  for (const rawPart of result.parts) {
    if (!rawPart || typeof rawPart.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawPart.id) ||
      typeof rawPart.number !== 'string' || !rawPart.number || typeof rawPart.description !== 'string' ||
      (rawPart.partType != null && !['kone', 'non-kone'].includes(rawPart.partType)) ||
      !isNullableNumber(rawPart.unitCost) || !isNullableNumber(rawPart.unitPrice) ||
      typeof rawPart.uom !== 'string')
      throw new Error('The parts catalog returned an incomplete or invalid part.')
    rawPart.details = parseCatalogDetails(rawPart.details)
    if (rawPart.details.number !== rawPart.number || rawPart.details.unitCost !== rawPart.unitCost ||
      rawPart.details.unitPrice !== rawPart.unitPrice)
      throw new Error('The parts catalog returned inconsistent source details.')
  }
  if (new Set(result.parts.map((part) => part.id)).size !== result.parts.length)
    throw new Error('The parts catalog returned duplicate IDs.')
  return result as CatalogResult
}
