export type PartType = 'kone' | 'non-kone'
export type MaterialScope = 'package' | 'additional'
export type PartMarket = 'MKO' | 'CKE' | 'CKQ'

export type SparePart = {
  id: string
  number: string
  description: string
  type: PartType
  usdCostPerUnit: number
  usdPricePerPricingUnit?: number
  pricingUnit: number
  uom: string
  sourceVersion: string
}

export type PartMaterialInput = {
  type: PartType
  source: 'catalog' | 'manual'
  part?: SparePart
  manualNumber: string
  manualDescription: string
  manualUnitCost: string
  quantity: string
  markupPercent: string
}

export type PartPricingConfiguration = {
  version: string
  usdToCadFactor: number
  costOnlyFactor: number
  defaultMarkupPercent: number
  koneTaxPercent: number
  koneFreightPercent: number
  materialTaxPercent: number
  materialFreightPercent: number
}

function finite(value: number, min: number, max: number, message: string) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(message)
  return value
}

function entered(value: string, min: number, max: number, message: string) {
  if (!value.trim()) throw new Error(message)
  return finite(Number(value), min, max, message)
}

// Preview arithmetic only. Persistence must resolve and snapshot authoritative values on the server.
export function calculatePartMaterial(input: PartMaterialInput, market: PartMarket, config: PartPricingConfiguration) {
  if (!['MKO', 'CKE', 'CKQ'].includes(market)) throw new Error('market')
  if (!['kone', 'non-kone'].includes(input.type)) throw new Error('classification')
  if (!['catalog', 'manual'].includes(input.source)) throw new Error('source')
  const quantity = entered(input.quantity, 0.01, 100000, 'quantity')
  const tax = finite(config.materialTaxPercent, 0, 100, 'configuration')
  const freight = finite(config.materialFreightPercent, 0, 100, 'configuration')
  const currency = market === 'MKO' ? 'USD' : 'CAD'
  let unitCost: number
  let unitPrice: number | undefined
  if (input.source === 'manual') {
    if (input.type !== 'non-kone') throw new Error('koneCatalogRequired')
    if (!input.manualNumber.trim() || !input.manualDescription.trim()) throw new Error('manualDetails')
    unitCost = entered(input.manualUnitCost, 0.000001, 1000000000, 'cost')
  } else {
    const part = input.part
    if (!part) throw new Error('selectPart')
    if (part.type !== input.type) throw new Error('classification')
    if (!part.uom.trim() || !part.sourceVersion.trim()) throw new Error('source')
    finite(part.pricingUnit, 0.000001, 1000000000, 'pricingUnit')
    const fx = market === 'MKO' ? 1 : finite(config.usdToCadFactor, 0.01, 100, 'configuration')
    const costFactor = market === 'MKO' ? 1 : finite(config.costOnlyFactor, 0.01, 100, 'configuration')
    unitCost = finite(part.usdCostPerUnit, 0.000001, 1000000000, 'cost') * costFactor * fx
    if (part.usdPricePerPricingUnit !== undefined)
      unitPrice = finite(part.usdPricePerPricingUnit, 0, 1000000000, 'price') * fx / part.pricingUnit
  }
  const materialCost = quantity * unitCost
  const totalCost = materialCost * (1 + tax / 100 + freight / 100)
  let sellingContribution: number | undefined
  let markupAmount: number | undefined
  if (input.type === 'kone') {
    if (unitPrice === undefined || unitPrice <= 0) throw new Error('price')
    const markup = entered(input.markupPercent, 0, 100, 'markup')
    const koneTax = finite(config.koneTaxPercent, 0, 100, 'configuration')
    const koneFreight = finite(config.koneFreightPercent, 0, 100, 'configuration')
    markupAmount = quantity * unitPrice * markup / 100
    sellingContribution = quantity * unitPrice * (1 + koneTax / 100 + koneFreight / 100 + markup / 100)
  }
  return { currency, unitCost, unitPrice, materialCost, totalCost, markupAmount, sellingContribution }
}
