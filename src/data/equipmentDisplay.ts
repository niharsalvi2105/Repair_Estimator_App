export type EquipmentSourceDetails = {
  re_description?: string
  re_manufacturer?: string
  re_constructionyear?: number
}

export function equipmentDisplayDetails(equipment: EquipmentSourceDetails & {
  re_oem?: string
  re_equipmentage?: number
}, year = new Date().getFullYear()) {
  const constructionYear = equipment.re_constructionyear
  const age = equipment.re_equipmentage
  return {
    description: equipment.re_description?.trim() || '',
    manufacturer: equipment.re_manufacturer?.trim() || equipment.re_oem?.trim() || '',
    age: typeof age === 'number' && Number.isFinite(age) && age >= 0 ? age
      : typeof constructionYear === 'number' && Number.isInteger(constructionYear)
        && constructionYear > 0 && constructionYear <= year ? year - constructionYear : undefined,
  }
}
