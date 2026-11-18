import type { DraftMaterial } from './draftContract'

function signature(line: DraftMaterial): string {
  return JSON.stringify([
    line.packageId ?? '', line.equipmentNumber ?? '', line.catalogPartId?.toLowerCase() ?? '',
    line.partType ?? '', line.quantity, line.markupPercent ?? null,
  ])
}

function retainsCompletion(sent: DraftMaterial, saved: DraftMaterial): boolean {
  const details = sent.catalogDetails
  return (!details || !!saved.catalogDetails) &&
    (!details?.requiresCost || sent.unitCost === saved.unitCost) &&
    (!details?.requiresDescription || sent.description.trim() === saved.description.trim()) &&
    (!details?.requiresUom || sent.uom?.trim() === saved.uom?.trim())
}

export function missingMaterialSellingPrices(
  sent: DraftMaterial[], received: DraftMaterial[], previouslySaved: DraftMaterial[],
): boolean {
  const savedIds = new Set(previouslySaved.map(line => line.id.toLowerCase()))
  const sentIds = new Set(sent.map(line => line.id.toLowerCase()))
  const byId = new Map(received.map(line => [line.id.toLowerCase(), line]))
  const unmatchedNew: DraftMaterial[] = []

  for (const line of sent) {
    const saved = byId.get(line.id.toLowerCase())
    if (saved) {
      if (!retainsCompletion(line, saved) || (line.sellingPrice != null && saved.sellingPrice !== line.sellingPrice)) return true
    } else if (line.sellingPrice != null || line.catalogDetails != null) {
      if (savedIds.has(line.id.toLowerCase())) return true
      unmatchedNew.push(line)
    }
  }

  const candidates = received.filter(line =>
    !sentIds.has(line.id.toLowerCase()) && !savedIds.has(line.id.toLowerCase()))
  for (const line of unmatchedNew) {
    const match = candidates.findIndex(saved =>
      signature(saved) === signature(line) && (line.sellingPrice == null || saved.sellingPrice === line.sellingPrice) &&
        retainsCompletion(line, saved))
    if (match < 0) return true
    candidates.splice(match, 1)
  }
  return false
}
