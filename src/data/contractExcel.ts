import type { Cell, Worksheet } from 'exceljs'
import { validContractNumber } from './contractEquipment.ts'

export const MAX_CONTRACT_EXCEL_BYTES = 5 * 1024 * 1024
export function parseContractWorksheet(sheet: Worksheet) {
  let column: number | undefined
  sheet.getRow(1).eachCell((cell, index) => {
    if (typeof cell.value !== 'string' || cell.value.trim().toLowerCase() !== 'contract number' || column != null)
      throw new Error('Use one Contract Number column only. Download the contract template.')
    column = index
  })
  if (column == null) throw new Error('Missing Contract Number column. Download the contract template.')
  const numbers: string[] = []
  const duplicates: string[] = []
  const seen = new Set<string>()
  function identifier(cell: Cell, row: number) {
    if (cell.value == null) return ''
    if (typeof cell.value === 'string') return cell.value.trim()
    if (typeof cell.value === 'number' && Number.isSafeInteger(cell.value) && cell.value >= 0 &&
      String(cell.value).length <= 15)
      return /^0+$/.test(cell.numFmt) ? String(cell.value).padStart(cell.numFmt.length, '0') : String(cell.value)
    throw new Error(`Row ${row}: store contract numbers as text; formulas, dates and errors are not allowed.`)
  }
  sheet.eachRow((row, index) => {
    if (index === 1) return
    row.eachCell((cell, position) => {
      if (position !== column && cell.value != null) throw new Error(`Row ${index}: use the one-column contract template.`)
    })
    const number = identifier(row.getCell(column!), index)
    if (!number) return
    if (!validContractNumber(number)) throw new Error(`Row ${index}: enter one contract number, at most 100 characters.`)
    const key = number.toLowerCase()
    if (seen.has(key)) { duplicates.push(number); return }
    seen.add(key); numbers.push(number)
    if (numbers.length > 1000) throw new Error('The contract file exceeds 1000 identifiers. Split the request.')
  })
  if (!numbers.length) throw new Error('The contract worksheet is empty.')
  return { numbers, duplicates }
}
export async function readContractExcel(data: ArrayBuffer) {
  if (data.byteLength > MAX_CONTRACT_EXCEL_BYTES) throw new Error('Contract Excel files must be no larger than 5 MB.')
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  try { await workbook.xlsx.load(data) }
  catch { throw new Error('Cannot read the contract workbook. Upload a valid, unprotected .xlsx file.') }
  if (!workbook.worksheets[0] || workbook.worksheets.slice(1).some((sheet) => sheet.actualRowCount))
    throw new Error('Use one populated contract worksheet only.')
  return parseContractWorksheet(workbook.worksheets[0])
}
export async function contractExcelTemplate() {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Contracts')
  sheet.columns = [{ header: 'Contract Number', width: 30 }]
  sheet.getColumn(1).numFmt = '@'
  sheet.getRow(1).font = { bold: true }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  return workbook.xlsx.writeBuffer()
}
