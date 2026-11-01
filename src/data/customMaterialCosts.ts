import type { DraftMaterial } from './draftContract'

export function materialEntryError(line: DraftMaterial, language: 'en' | 'fr'): string | undefined {
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
