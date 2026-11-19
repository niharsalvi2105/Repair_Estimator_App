import type { DraftMaterial } from './draftContract'

export function materialEntryError(line: DraftMaterial, language: 'en' | 'fr'): string | undefined {
  const manualKone = line.pricingSource === 'manual' && line.partType === 'kone'
  if (manualKone && (!Number.isFinite(line.unitCost) || line.unitCost <= 0 ||
    line.unitCost > 1000000000 || Number(line.unitCost.toFixed(2)) !== line.unitCost))
    return language === 'fr' ? 'Saisissez un coût unitaire positif, jusqu’à 1000000000 et 2 décimales.'
      : 'Enter a positive unit cost up to 1000000000 with at most 2 decimal places.'
  if (line.catalogPartId || manualKone) {
    const effectivePrice = line.sellingPrice ?? (manualKone || line.catalogDetails?.requiresSellingPrice ? undefined : line.unitPrice)
    if (line.catalogDetails?.requiresCost && (!Number.isFinite(line.unitCost) || line.unitCost <= 0 ||
      line.unitCost > 1000000000 || Number(line.unitCost.toFixed(10)) !== line.unitCost))
      return language === 'fr' ? 'Saisissez un coût unitaire positif, jusqu’à 1000000000 et 10 décimales.'
        : 'Enter a positive unit cost up to 1000000000 with at most 10 decimal places.'
    if (line.catalogDetails?.requiresDescription && !line.description.trim())
      return language === 'fr' ? 'La description de la pièce est requise.' : 'Part description is required.'
    if (line.catalogDetails?.requiresUom && (!line.uom?.trim() || line.uom.length > 20))
      return language === 'fr' ? 'L’unité de mesure est requise et limitée à 20 caractères.'
        : 'Unit of measure is required and limited to 20 characters.'
    if (effectivePrice == null || !Number.isFinite(effectivePrice) || effectivePrice <= 0 ||
      effectivePrice > 1000000000 || Number(effectivePrice.toFixed(10)) !== effectivePrice)
      return language === 'fr' ? 'Saisissez un prix de vente positif, jusqu’à 1000000000 et 10 décimales.'
        : 'Enter a positive selling price up to 1000000000 with at most 10 decimal places.'
  } else if (line.sellingPrice != null)
    return language === 'fr' ? 'Un prix de vente personnalisé exige une pièce du catalogue.'
      : 'A manual selling price requires a catalog part.'
  if (!line.part?.trim())
    return language === 'fr' ? 'Le numéro de pièce est obligatoire.' : 'Part number is required.'
  if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 100000)
    return language === 'fr' ? 'La quantité doit être un nombre entier de 1 à 100000.'
      : 'Quantity must be a whole number from 1 to 100000.'
  return undefined
}

export function calculateCustomMaterialTotal(materials: DraftMaterial[]) {
  if (materials.some((line) => line.pricingSource === 'package'))
    throw new Error('Saved package-priced KONE references use package amounts, not unit cost × quantity.')
  if (materials.some((line) => materialEntryError(line, 'en') || !line.description.trim() ||
    !Number.isFinite(line.unitCost) || line.unitCost <= 0))
    throw new Error('Complete the part number, description, positive unit cost and whole-number quantity for every material.')
  return materials.reduce((sum, line) => sum + line.unitCost * line.quantity, 0)
}
