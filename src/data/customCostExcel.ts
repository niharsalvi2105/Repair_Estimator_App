import type { Cell, Worksheet } from 'exceljs'
import type { DraftLabor, DraftMaterial } from './draftContract'

export type CustomCostKind = 'labor' | 'material'

export const CUSTOM_COST_EXCEL_HEADERS: Record<CustomCostKind, readonly string[]> = {
  labor: ['Equipment Number', 'Mechanic ST', 'Mechanic DT', 'Helper ST', 'Helper DT', 'Adjuster ST', 'Adjuster DT'],
  material: ['Equipment Number', 'Material Description', 'Vendor Name', 'Part Mfg', 'Part #', 'Quantity', 'Unit Cost'],
}
export const MAX_CUSTOM_COST_EXCEL_BYTES = 5 * 1024 * 1024

type Language = 'en' | 'fr'

function fail(language: Language, en: string, fr: string): never {
  throw new Error(language === 'fr' ? fr : en)
}

function cellText(cell: Cell, language: Language, row: number): string {
  const value = cell.value
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fail(language,
    `Row ${row}: use plain text or numbers, not formulas, dates, links or errors.`,
    `Ligne ${row} : utilisez du texte ou des nombres, sans formules, dates, liens ni erreurs.`)
}

function equipmentNumber(cell: Cell, language: Language, row: number, label = 'Equipment Number'): string {
  const value = cell.value
  if (typeof value === 'string') return value
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || String(value).length > 15)
    return fail(language,
      `Row ${row}: store ${label} as text to preserve its exact value.`,
      `Ligne ${row} : enregistrez ${label} comme texte pour préserver sa valeur exacte.`)
  if (/^0+$/.test(cell.numFmt)) return String(value).padStart(cell.numFmt.length, '0')
  return String(value)
}

function numberValue(value: string, language: Language, row: number, label: string, max: number, required: boolean): number {
  if (!value && !required) return 0
  if (!/^\d+(?:\.\d{1,2})?$/.test(value))
    return fail(language, `Row ${row}: ${label} must be a number with at most two decimal places.`,
      `Ligne ${row} : ${label} doit être un nombre avec au plus deux décimales.`)
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > max)
    return fail(language, `Row ${row}: ${label} must be from 0 to ${max}.`,
      `Ligne ${row} : ${label} doit être compris entre 0 et ${max}.`)
  if (required && number === 0)
    return fail(language, `Row ${row}: ${label} must be greater than 0.`,
      `Ligne ${row} : ${label} doit être supérieur à 0.`)
  return number
}

function decimalCellValue(cell: Cell, language: Language, row: number, label: string, max: number, required: boolean): number {
  const value = cellText(cell, language, row)
  if (typeof cell.value === 'number') {
    const number = cell.value
    const scaled = number * 100
    const rounded = Math.round(scaled) / 100
    if (!Number.isFinite(number) || Math.abs(scaled - Math.round(scaled)) > Number.EPSILON * Math.max(1, Math.abs(scaled)) * 2)
      return fail(language, `Row ${row}: ${label} must have at most two decimal places.`,
        `Ligne ${row} : ${label} doit avoir au plus deux décimales.`)
    if (number < 0 || number > max)
      return fail(language, `Row ${row}: ${label} must be from 0 to ${max}.`,
        `Ligne ${row} : ${label} doit être compris entre 0 et ${max}.`)
    if (required && number === 0)
      return fail(language, `Row ${row}: ${label} must be greater than 0.`,
        `Ligne ${row} : ${label} doit être supérieur à 0.`)
    return rounded
  }
  return numberValue(value, language, row, label, max, required)
}

function quantityValue(cell: Cell, language: Language, row: number): number {
  const value = cellText(cell, language, row)
  if (!/^\d+$/.test(value))
    return fail(language, `Row ${row}: Quantity must be a whole number from 1 to 100000.`,
      `Ligne ${row} : Quantity doit être un entier de 1 à 100000.`)
  const quantity = Number(value)
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000)
    return fail(language, `Row ${row}: Quantity must be a whole number from 1 to 100000.`,
      `Ligne ${row} : Quantity doit être un entier de 1 à 100000.`)
  return quantity
}

function getHeaderPositions(sheet: Worksheet, kind: CustomCostKind, language: Language): Map<string, number> {
  const positions = new Map<string, number>()
  sheet.getRow(1).eachCell((cell, column) => {
    const header = cellText(cell, language, 1).trim().toLowerCase()
    if (positions.has(header))
      fail(language, `Duplicate column: ${header || '(blank)'}.`, `Colonne en double : ${header || '(vide)'}.`)
    positions.set(header, column)
  })
  const expected = CUSTOM_COST_EXCEL_HEADERS[kind]
  for (const header of expected) {
    if (!positions.has(header.toLowerCase()))
      fail(language,
        `Missing column "${header}". Use the ${kind} template.`,
        `Colonne "${header}" manquante. Utilisez le modèle ${kind === 'labor' ? 'de main-d’œuvre' : 'de matériaux'}.`)
  }
  const allowed = new Set(expected.map((header) => header.toLowerCase()))
  for (const header of positions.keys()) {
    if (!allowed.has(header))
      fail(language, `Unexpected column: ${header || '(blank)'}.`,
        `Colonne inattendue : ${header || '(vide)'}.`)
  }
  return positions
}

function validateDataColumns(sheet: Worksheet, positions: Map<string, number>, language: Language): void {
  const knownColumns = new Set(positions.values())
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    row.eachCell((cell, column) => {
      cellText(cell, language, rowNumber)
      if (!knownColumns.has(column) && cell.value != null)
        fail(language, `Row ${rowNumber}: data appears under a blank column heading.`,
          `Ligne ${rowNumber} : des données apparaissent sous un en-tête de colonne vide.`)
    })
  })
}

function laborRows(sheet: Worksheet, positions: Map<string, number>, language: Language, packageId: string,
  allowedEquipment: string[], maxLines: number): DraftLabor[] {
  const entries: DraftLabor[] = []
  const equipmentColumn = positions.get('equipment number')!
  const roles = [
    { header: 'mechanic st', role: 126110000, time: 126110000 },
    { header: 'mechanic dt', role: 126110000, time: 126110001 },
    { header: 'helper st', role: 126110001, time: 126110000 },
    { header: 'helper dt', role: 126110001, time: 126110001 },
    { header: 'adjuster st', role: 126110002, time: 126110000 },
    { header: 'adjuster dt', role: 126110002, time: 126110001 },
  ]
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const values = roles.map(({ header }) => cellText(row.getCell(positions.get(header)!), language, rowNumber))
    if (values.every((value) => !value || value === '0')) return
    const number = equipmentNumber(row.getCell(equipmentColumn), language, rowNumber)
    if (!number || /\s/.test(number) || number.length > 20)
      fail(language, `Row ${rowNumber}: Equipment Number is required, must contain no whitespace and allow at most 20 characters.`,
        `Ligne ${rowNumber} : Equipment Number est requis, sans espace et avec 20 caractères maximum.`)
    if (!allowedEquipment.includes(number))
      fail(language, `Row ${rowNumber}: Equipment Number "${number}" is not in the selected package.`,
        `Ligne ${rowNumber} : Equipment Number "${number}" ne fait pas partie du forfait sélectionné.`)
    values.forEach((_, index) => {
      const hours = decimalCellValue(row.getCell(positions.get(roles[index].header)!), language, rowNumber,
        roles[index].header, 100000, false)
      if (hours > 0) {
        entries.push({
          id: globalThis.crypto.randomUUID(),
          packageId,
          equipmentNumber: number,
          role: roles[index].role,
          time: roles[index].time,
          hours,
        })
        if (entries.length > maxLines)
          fail(language, `The workbook exceeds the remaining line limit (${maxLines}).`,
            `Le classeur dépasse la limite de lignes restante (${maxLines}).`)
      }
    })
  })
  if (!entries.length) fail(language, 'The labor worksheet contains no positive hours.', 'La feuille de main-d’œuvre ne contient aucune heure positive.')
  return entries
}

function materialRows(sheet: Worksheet, positions: Map<string, number>, language: Language, packageId: string,
  allowedEquipment: string[], maxLines: number): DraftMaterial[] {
  const entries: DraftMaterial[] = []
  const column = (header: string) => positions.get(header.toLowerCase())!
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const fields = ['material description', 'vendor name', 'part mfg', 'part #', 'quantity', 'unit cost']
    const values = fields.map((header) => cellText(row.getCell(column(header)), language, rowNumber))
    if (values.every((value) => !value.trim())) return
    const number = equipmentNumber(row.getCell(column('equipment number')), language, rowNumber)
    if (!number || /\s/.test(number) || number.length > 20)
      fail(language, `Row ${rowNumber}: Equipment Number is required, must contain no whitespace and allow at most 20 characters.`,
        `Ligne ${rowNumber} : Equipment Number est requis, sans espace et avec 20 caractères maximum.`)
    if (!allowedEquipment.includes(number))
      fail(language, `Row ${rowNumber}: Equipment Number "${number}" is not in the selected package.`,
        `Ligne ${rowNumber} : Equipment Number "${number}" ne fait pas partie du forfait sélectionné.`)

    const [description, vendor, partMfg] = values.slice(0, 3).map((value) => value.trim())
    const part = equipmentNumber(row.getCell(column('part #')), language, rowNumber, 'Part #').trim()
    const manufacturer = partMfg.toLowerCase()
    if (manufacturer !== 'kone' && manufacturer !== 'non-kone')
      fail(language, `Row ${rowNumber}: Part Mfg must be KONE or Non-KONE.`,
        `Ligne ${rowNumber} : Part Mfg doit être KONE ou Non-KONE.`)
    if (!part || part.length > 100)
      fail(language, `Row ${rowNumber}: Part # is required and allows at most 100 characters.`,
        `Ligne ${rowNumber} : Part # est requis et accepte 100 caractères maximum.`)
    if (description.length > 2000 || vendor.length > 100)
      fail(language, `Row ${rowNumber}: Material Description allows 2000 characters and Vendor Name allows 100.`,
        `Ligne ${rowNumber} : Material Description accepte 2000 caractères et Vendor Name 100.`)

    const quantity = quantityValue(row.getCell(column('quantity')), language, rowNumber)
    const isKone = manufacturer === 'kone'
    const unitCost = decimalCellValue(row.getCell(column('unit cost')), language, rowNumber, 'Unit Cost', 1_000_000_000, !isKone)
    if (isKone && unitCost !== 0)
      fail(language, `Row ${rowNumber}: KONE Unit Cost must be blank or zero; catalog pricing is resolved separately.`,
        `Ligne ${rowNumber} : Unit Cost KONE doit être vide ou égal à zéro; le prix du catalogue est résolu séparément.`)
    if (!isKone && !description)
      fail(language, `Row ${rowNumber}: Non-KONE materials require Material Description.`,
        `Ligne ${rowNumber} : les matériaux Non-KONE exigent Material Description.`)

    entries.push({
      id: globalThis.crypto.randomUUID(),
      packageId,
      equipmentNumber: number,
      description,
      vendor,
      part,
      quantity,
      unitCost,
      partType: isKone ? 'kone' : 'non-kone',
      ...(isKone ? {} : { pricingSource: 'manual' as const }),
    })
    if (entries.length > maxLines)
      fail(language, `The workbook exceeds the remaining line limit (${maxLines}).`,
        `Le classeur dépasse la limite de lignes restante (${maxLines}).`)
  })
  if (!entries.length) fail(language, 'The materials worksheet contains no material rows.', 'La feuille de matériaux ne contient aucune ligne de matériau.')
  return entries
}

export async function customCostExcelTemplate(kind: CustomCostKind, equipmentNumbers: string[]) {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Repair Estimator'
  workbook.subject = kind === 'labor' ? 'Labor import template' : 'Material import template'
  const sheet = workbook.addWorksheet(kind === 'labor' ? 'Labor' : 'Materials')
  const headers = CUSTOM_COST_EXCEL_HEADERS[kind]
  sheet.columns = headers.map((header, index) => ({
    header,
    width: index === 0 ? 23 : kind === 'labor' ? 18 : [1, 2, 3].includes(index) ? 25 : 16,
  }))
  sheet.getColumn(1).numFmt = '@'
  if (kind === 'material') sheet.getColumn(5).numFmt = '@'
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF174A6E' } }
  sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true }
  sheet.getRow(1).height = 30
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }
  for (let row = 2; row <= 101; row++) {
    sheet.getCell(row, 1).numFmt = '@'
    if (kind === 'labor') {
      for (let column = 2; column <= headers.length; column++) sheet.getCell(row, column).numFmt = '0.00'
    } else {
      sheet.getCell(row, 6).numFmt = '0'
      sheet.getCell(row, 7).numFmt = '0.00'
      sheet.getCell(row, 4).dataValidation = { type: 'list', allowBlank: true, formulae: ['"KONE,Non-KONE"'] }
    }
  }

  const instructions = workbook.addWorksheet('Instructions')
  instructions.columns = sheet.columns.map(column => ({ width: column.width }))
  instructions.getColumn(1).numFmt = '@'
  const title = kind === 'labor' ? 'Labor import template' : 'Material import template'
  instructions.mergeCells('A1:G1')
  instructions.getCell('A1').value = title
  instructions.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF174A6E' } }
  instructions.getCell('A3').value = 'How to use'
  instructions.getCell('A3').font = { bold: true, size: 12 }
  const guidance = kind === 'labor'
    ? [
      'Enter one equipment number per row, then enter hours in the matching role and shift columns.',
      'Blank or zero hours are skipped. Positive hours may have up to two decimal places.',
      'Each positive role/shift value imports as a separate labor line.',
      'Equipment Number must exactly match an item in the selected package; keep leading zeros.',
    ]
    : [
      'Enter one material per row and select KONE or Non-KONE in Part Mfg.',
      'Non-KONE rows require description, part number, whole-number quantity and positive unit cost; vendor is optional.',
      'KONE rows require a part number and quantity. Leave Unit Cost blank or enter zero; catalog pricing is resolved separately.',
      'Equipment Number must exactly match an item in the selected package; keep leading zeros.',
    ]
  guidance.forEach((text, index) => {
    const row = index + 4
    instructions.getCell(row, 1).value = `${index + 1}.`
    instructions.mergeCells(`B${row}:G${row}`)
    instructions.getCell(row, 2).value = text
    instructions.getCell(row, 2).alignment = { wrapText: true, vertical: 'middle' }
    instructions.getRow(row).height = 32
  })
  instructions.mergeCells('A10:G10')
  instructions.getCell('A10').value = 'Illustrative example (not imported)'
  instructions.getCell('A10').font = { bold: true, size: 12 }
  const exampleHeaders = [...headers]
  instructions.getRow(11).values = exampleHeaders
  instructions.getRow(11).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  instructions.getRow(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF477A96' } }
  instructions.getRow(11).alignment = { wrapText: true, vertical: 'middle' }
  instructions.getRow(11).height = 30
  instructions.getRow(12).values = kind === 'labor'
    ? ['EXAMPLE-ONLY-001', 2, 0, 1.5, 0, 0, 0]
    : ['EXAMPLE-ONLY-001', 'Illustrative bearing', 'Example Supplier', 'Non-KONE', 'EX-100', 2, 12.5]
  instructions.getRow(12).alignment = { wrapText: true }
  instructions.getRow(12).height = 32
  instructions.mergeCells('A14:G14')
  instructions.getCell('A14').value = 'Equipment in the selected package'
  instructions.getCell('A14').font = { bold: true }
  if (equipmentNumbers.length) {
    equipmentNumbers.forEach((number, index) => { instructions.getCell(index + 15, 1).value = number })
  } else {
    instructions.getCell('A15').value = '(No equipment selected)'
  }
  instructions.views = [{ state: 'frozen', ySplit: 1 }]
  return workbook.xlsx.writeBuffer()
}

export function readCustomCostExcel(
  data: ArrayBuffer, kind: 'labor', language: Language, packageId: string, allowedEquipment: string[], maxLines: number,
): Promise<DraftLabor[]>
export function readCustomCostExcel(
  data: ArrayBuffer, kind: 'material', language: Language, packageId: string, allowedEquipment: string[], maxLines: number,
): Promise<DraftMaterial[]>
export function readCustomCostExcel(
  data: ArrayBuffer, kind: CustomCostKind, language: Language, packageId: string, allowedEquipment: string[], maxLines: number,
): Promise<DraftLabor[] | DraftMaterial[]>
export async function readCustomCostExcel(
  data: ArrayBuffer, kind: CustomCostKind, language: Language, packageId: string, allowedEquipment: string[], maxLines: number,
): Promise<DraftLabor[] | DraftMaterial[]> {
  if (data.byteLength > MAX_CUSTOM_COST_EXCEL_BYTES)
    fail(language, 'The Excel file must be no larger than 5 MB.', 'Le fichier Excel ne doit pas dépasser 5 Mo.')
  if (!Number.isSafeInteger(maxLines) || maxLines < 0)
    fail(language, 'The remaining line limit is invalid.', 'La limite de lignes restante est invalide.')
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(data)
  } catch {
    fail(language, 'Cannot read this workbook. Upload a valid, unprotected .xlsx file.',
      'Impossible de lire ce classeur. Téléversez un fichier .xlsx valide et non protégé.')
  }
  const dataSheets = workbook.worksheets.filter((sheet) => sheet.name !== 'Instructions')
  if (dataSheets.length !== 1)
    fail(language, 'Use one data worksheet and an optional sheet named Instructions.',
      'Utilisez une seule feuille de données et, au besoin, une feuille nommée Instructions.')
  const sheet = dataSheets[0]
  if (!sheet || sheet.actualRowCount === 0)
    fail(language, 'The worksheet is empty.', 'La feuille est vide.')
  const positions = getHeaderPositions(sheet, kind, language)
  validateDataColumns(sheet, positions, language)
  return kind === 'labor'
    ? laborRows(sheet, positions, language, packageId, allowedEquipment, maxLines)
    : materialRows(sheet, positions, language, packageId, allowedEquipment, maxLines)
}
