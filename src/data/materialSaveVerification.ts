import type { DraftMaterial } from './draftContract'

function signature(line: DraftMaterial): string {
  return JSON.stringify([
    line.packageId ?? '', line.equipmentNumber ?? '', line.catalogPartId?.toLowerCase() ?? '',
    line.partType ?? '', line.quantity, line.markupPercent ?? null,
  ])
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
      if (line.sellingPrice != null && saved.sellingPrice !== line.sellingPrice) return true
    } else if (line.sellingPrice != null) {
      if (savedIds.has(line.id.toLowerCase())) return true
      unmatchedNew.push(line)
    }
  }

  const candidates = received.filter(line =>
    !sentIds.has(line.id.toLowerCase()) && !savedIds.has(line.id.toLowerCase()))
  for (const line of unmatchedNew) {
    const match = candidates.findIndex(saved =>
      signature(saved) === signature(line) && saved.sellingPrice === line.sellingPrice)
    if (match < 0) return true
    candidates.splice(match, 1)
  }
  return false
}
