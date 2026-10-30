export const EQUIPMENT_LOOKUP_BATCH_SIZE = 50

export function parseEquipmentList(text: string): string[] {
  return [...new Set(text.split(/[,;\s]+/).map((value) => value.trim()).filter(Boolean))]
}

// Space-only input counts as a list only when every value looks like a number, so names like "Main lobby" still search.
export function isEquipmentList(text: string): boolean {
  const values = text.trim().split(/[,;\s]+/).filter(Boolean)
  if (values.length < 2) return false
  return /[,;\r\n\t]/.test(text) || values.every((value) => /\d/.test(value))
}

export function planEquipmentAdd<T extends { re_equipment: string }>(
  selectedNumbers: string[], numbers: string[], matches: T[], limit = Infinity,
): { add: T[]; notFound: string[]; alreadySelected: string[]; overLimit: string[] } {
  const byNumber = new Map<string, T>()
  for (const match of matches) {
    const key = match.re_equipment.toLocaleLowerCase()
    if (!byNumber.has(key)) byNumber.set(key, match)
  }
  const selected = new Set(selectedNumbers.map((number) => number.toLocaleLowerCase()))
  const plan = { add: [] as T[], notFound: [] as string[], alreadySelected: [] as string[], overLimit: [] as string[] }
  for (const number of numbers) {
    const match = byNumber.get(number.toLocaleLowerCase())
    if (selected.has(number.toLocaleLowerCase())) plan.alreadySelected.push(number)
    else if (!match) plan.notFound.push(number)
    else if (selected.size >= limit) plan.overLimit.push(number)
    else {
      plan.add.push(match)
      selected.add(match.re_equipment.toLocaleLowerCase())
    }
  }
  return plan
}
