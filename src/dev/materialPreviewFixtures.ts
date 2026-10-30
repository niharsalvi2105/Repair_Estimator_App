import type { PartPricingConfiguration, SparePart } from '../data/partMaterials'

export const previewPartConfiguration: PartPricingConfiguration = {
  version: 'workbook-material-preview-v1',
  usdToCadFactor: 1.4,
  costOnlyFactor: 1.23,
  defaultMarkupPercent: 10,
  koneTaxPercent: 5,
  koneFreightPercent: 10,
  materialTaxPercent: 5,
  materialFreightPercent: 14,
}

export const previewParts: SparePart[] = [
  { id: 'demo-kone-1', number: 'DEMO-KONE-001', description: 'Synthetic KONE motor',
    type: 'kone', usdCostPerUnit: 100, usdPricePerPricingUnit: 200, pricingUnit: 1, uom: 'PC', sourceVersion: 'synthetic-only' },
  { id: 'demo-kone-2', number: 'DEMO-KONE-002', description: 'Synthetic precision example',
    type: 'kone', usdCostPerUnit: 4.49, usdPricePerPricingUnit: 28.84, pricingUnit: 1, uom: 'PC', sourceVersion: 'synthetic-only' },
  { id: 'demo-non-kone-1', number: 'DEMO-OTHER-001', description: 'Synthetic non-KONE bracket',
    type: 'non-kone', usdCostPerUnit: 10, pricingUnit: 1, uom: 'PC', sourceVersion: 'synthetic-only' },
]
