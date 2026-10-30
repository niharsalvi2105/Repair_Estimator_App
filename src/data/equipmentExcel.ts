import type { Cell, Worksheet } from 'exceljs'

export const EQUIPMENT_EXCEL_HEADERS = ['Equipment Number', 'Equipment Name', 'Age', 'Location', 'Manufacturer'] as const
export const MAX_EQUIPMENT_EXCEL_BYTES = 5 * 1024 * 1024
export type EquipmentExcelRow = { number: string; name: string; age?: number; location: string; oem: string }
type Language = 'en' | 'fr'

function fail(language: Language, en: string, fr: string): never {
  throw new Error(language === 'fr' ? fr : en)
}

function text(cell: Cell, language: Language, row: number): string {
  const value = cell.value
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isSafeInteger(value) && value >= 0 && /^0+$/.test(cell.numFmt))
      return String(value).padStart(cell.numFmt.length, '0')
    return String(value)
  }
  return fail(language, `Row ${row}: use plain text or numbers, not formulas, dates, links or errors.`,
    `Ligne ${row} : utilisez du texte ou des nombres, sans formules, dates, liens ni erreurs.`)
}

export function parseEquipmentWorksheet(sheet: Worksheet, language: Language, maxRows: number) {
  const positions = new Map<string, number>()
  sheet.getRow(1).eachCell((cell, index) => {
    const header = text(cell, language, 1).toLowerCase()
    if (positions.has(header)) fail(language, `Duplicate column: ${header}.`, `Colonne en double : ${header}.`)
    positions.set(header, index)
  })
  for (const header of EQUIPMENT_EXCEL_HEADERS)
    if (!positions.has(header.toLowerCase()))
      fail(language, `Missing column "${header}". Use the equipment template.`, `Colonne "${header}" manquante. Utilisez le modèle d’équipements.`)
  const rows: EquipmentExcelRow[] = []
  const duplicates: string[] = []
  const seen = new Map<string, EquipmentExcelRow>()
  sheet.eachRow((row, index) => {
    if (index === 1) return
    const values = EQUIPMENT_EXCEL_HEADERS.map((header) => text(row.getCell(positions.get(header.toLowerCase())!), language, index))
    if (values.every((value) => !value)) return
    const [number, name, ageText, location, oem] = values
    if (!number || number.length > 20 || /[,;\s]/.test(number))
      fail(language, `Row ${index}: Equipment Number is required (one identifier, at most 20 characters).`,
        `Ligne ${index} : Equipment Number est requis (un identifiant, 20 caractères maximum).`)
    const numberCell = row.getCell(positions.get('equipment number')!)
    if (typeof numberCell.value === 'number' && (!Number.isSafeInteger(numberCell.value) || numberCell.value < 0 ||
      String(numberCell.value).length > 15))
      fail(language, `Row ${index}: store the equipment number as text to preserve its exact value.`,
        `Ligne ${index} : enregistrez le numéro d’équipement comme texte pour préserver sa valeur exacte.`)
    if ([name, location, oem].some((value) => value.length > 100))
      fail(language, `Row ${index}: name, location and manufacturer allow at most 100 characters each.`,
        `Ligne ${index} : nom, emplacement et fabricant acceptent 100 caractères chacun maximum.`)
    const age = ageText === '' ? undefined : Number(ageText)
    if (age !== undefined && (!/^\d+$/.test(ageText) || !Number.isInteger(age) || age < 0 || age > 200))
      fail(language, `Row ${index}: Age must be a whole number from 0 to 200, or blank.`,
        `Ligne ${index} : Age doit être un entier de 0 à 200, ou vide.`)
    const entry = { number, name, age, location, oem }
    const key = number.toLowerCase()
    const previous = seen.get(key)
    if (previous) {
      if (previous.name !== name || previous.age !== age || previous.location !== location || previous.oem !== oem)
        fail(language, `Row ${index}: conflicting details for duplicate equipment ${number}.`,
          `Ligne ${index} : détails contradictoires pour l’équipement en double ${number}.`)
      duplicates.push(number)
      return
    }
    seen.set(key, entry)
    rows.push(entry)
    if (rows.length > maxRows)
      fail(language, `The workbook exceeds the estimate's remaining equipment budget (${maxRows}). Split the request.`,
        `Le classeur dépasse la capacité restante du devis (${maxRows}). Divisez la demande.`)
  })
  if (!rows.length) fail(language, 'The equipment worksheet is empty.', 'La feuille d’équipements est vide.')
  return { rows, duplicates }
}

export async function readEquipmentExcel(data: ArrayBuffer, language: Language, maxRows: number) {
  if (data.byteLength > MAX_EQUIPMENT_EXCEL_BYTES)
    fail(language, 'The Excel file must be no larger than 5 MB.', 'Le fichier Excel ne doit pas dépasser 5 Mo.')
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(data)
  } catch {
    fail(language, 'Cannot read this workbook. Upload a valid, unprotected .xlsx file.',
      'Impossible de lire ce classeur. Téléversez un fichier .xlsx valide et non protégé.')
  }
  const sheet = workbook.worksheets[0]
  if (!sheet) fail(language, 'The workbook contains no worksheet.', 'Le classeur ne contient aucune feuille.')
  if (workbook.worksheets.slice(1).some((other) => other.actualRowCount > 0))
    fail(language, 'Use one equipment worksheet only. Remove other populated sheets before uploading.',
      'Utilisez une seule feuille d’équipements. Retirez les autres feuilles remplies avant le téléversement.')
  return parseEquipmentWorksheet(sheet, language, maxRows)
}

export async function equipmentExcelTemplate() {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Equipment')
  sheet.columns = EQUIPMENT_EXCEL_HEADERS.map((header) => ({ header, width: header === 'Age' ? 12 : 28 }))
  sheet.getColumn(1).numFmt = '@'
  sheet.getRow(1).font = { bold: true }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  return workbook.xlsx.writeBuffer()
}
