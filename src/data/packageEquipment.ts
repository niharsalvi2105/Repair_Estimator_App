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
