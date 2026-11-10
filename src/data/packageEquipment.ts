export type PackageEquipmentSelection = { equipmentNumbers?: string[] | null }

export function packageEquipmentNumbers(selection: PackageEquipmentSelection, equipment: { number: string }[]): string[] {
  const available = equipment.map((unit) => unit.number)
  if (selection.equipmentNumbers == null) return available
  return available.filter((number) => selection.equipmentNumbers?.includes(number))
}

export function validPackageEquipment(selection: PackageEquipmentSelection, equipment: { number: string }[]): boolean {
  const numbers = selection.equipmentNumbers
  return numbers == null || (Array.isArray(numbers) && numbers.length > 0 &&
    new Set(numbers).size === numbers.length &&
    numbers.every((number) => typeof number === 'string' && equipment.some((unit) => unit.number === number)))
}

export function validCustomCostEquipment(
  lines: { packageId?: string | null; equipmentNumber?: string | null }[],
  packages: { id: string; equipmentNumbers: string[] }[],
): boolean {
  return lines.every(line => {
    const number = line.equipmentNumber
    return !number || (number.length <= 20 && !/\s/.test(number) &&
      packages.some(p => p.id === line.packageId && p.equipmentNumbers.includes(number)))
  })
}
