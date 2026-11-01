import ExcelJS from 'exceljs'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const CONTRACT_MASTER_HEADERS = [
  'Sales_Organization__c', 'Plant_Section__c', 'Name', 'Status', 'Contract__c', 'CS_Service_Contract_Status__c',
]
export function contractMasterValue(cell) {
  if (cell.value == null) return ''
  if (typeof cell.value === 'string') return cell.value.trim()
  if (typeof cell.value === 'number' && Number.isSafeInteger(cell.value) && cell.value >= 0 && String(cell.value).length <= 15)
    return /^0+$/.test(cell.numFmt) ? String(cell.value).padStart(cell.numFmt.length, '0') : String(cell.value)
  throw new Error('Identifiers must be exact text or safe whole numbers, without formulas.')
}
export function contractMapping(values) {
  const [market, branch, equipment, equipmentStatus, contract, status] = values
  if (!contract) return { skipped: 'missingContract' }
  if (status !== 'Active' || equipmentStatus !== 'VALID') return { skipped: 'inactive' }
  if (!['MKO', 'MKOM', 'MKOF', 'CKE', 'CKQ'].includes(market) ||
    !/^\d{1,20}$/.test(branch) || !/^[^\s,;]{1,20}$/.test(equipment) ||
    !/^[\p{L}\p{N}.-]{1,100}$/u.test(contract))
    throw new Error('Invalid market, branch, equipment or contract identifier.')
  return { mapping: { market: ['MKOM', 'MKOF'].includes(market) ? 'MKO' : market, branchNumber: branch,
    equipmentNumber: equipment, re_contractnumber: contract, re_contractstatus: 'Active' } }
}

async function main() {
  const [input, output] = process.argv.slice(2)
  if (!input || !output || process.argv.length !== 4)
    throw new Error('Usage: node backend\\prepare-contract-equipment.mjs <Equipment-Master.xlsx> <new-output-directory>')
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(resolve(input), {
    sharedStrings: 'cache', styles: 'cache', hyperlinks: 'ignore', worksheets: 'emit',
  })
  const stats = { sourceRows: 0, missingContract: 0, inactive: 0, duplicates: 0, approved: 0, rejected: 0 }
  const mappings = new Map()
  const rejected = []
  const ambiguous = new Set()
  let found = false
  for await (const sheet of reader) {
    if (sheet.name !== 'Equipment Master') {
      for await (const row of sheet) { if (row.number >= 4) break }
      continue
    }
    found = true
    let positions
    for await (const row of sheet) {
      if (row.number === 1) {
        const columns = new Map()
        row.eachCell((cell, index) => {
          const header = contractMasterValue(cell)
          if (columns.has(header)) throw new Error(`Duplicate master header: ${header}`)
          columns.set(header, index)
        })
        positions = CONTRACT_MASTER_HEADERS.map((header) => {
          if (!columns.has(header)) throw new Error(`Missing master column: ${header}`)
          return columns.get(header)
        })
        continue
      }
      if (!positions) throw new Error('Equipment Master headers are missing.')
      stats.sourceRows++
      try {
        const result = contractMapping(positions.map((index) => contractMasterValue(row.getCell(index))))
        if (result.skipped) { stats[result.skipped]++; continue }
        const mapping = result.mapping
        const key = `${mapping.market}:${mapping.branchNumber}:${mapping.equipmentNumber.toLowerCase()}`
        if (ambiguous.has(key)) { rejected.push({ row: row.number, reason: 'Conflicting equipment contract mapping', key }); continue }
        const previous = mappings.get(key)
        if (previous && previous.mapping.re_contractnumber.toLowerCase() !== mapping.re_contractnumber.toLowerCase()) {
          mappings.delete(key); ambiguous.add(key)
          rejected.push({ row: previous.row, reason: 'Conflicting equipment contract mapping', key },
            { row: row.number, reason: 'Conflicting equipment contract mapping', key })
        } else if (previous) stats.duplicates++
        else mappings.set(key, { row: row.number, mapping })
      } catch (error) { rejected.push({ row: row.number, reason: error.message }) }
    }
    break
  }
  if (!found) throw new Error('The workbook contains no Equipment Master worksheet.')
  stats.approved = mappings.size; stats.rejected = rejected.length
  const columns = ['market', 'branchNumber', 'equipmentNumber', 're_contractnumber', 're_contractstatus']
  const quote = (value) => `"${value.replaceAll('"', '""')}"`
  const csv = [columns.join(','), ...[...mappings.values()].map(({ mapping }) =>
    columns.map((column) => quote(mapping[column])).join(','))].join('\r\n') + '\r\n'
  await mkdir(resolve(output), { recursive: true })
  await writeFile(join(resolve(output), 'equipment-contract-mapping.csv'), csv, { flag: 'wx' })
  await writeFile(join(resolve(output), 'equipment-contract-import-report.json'), JSON.stringify({
    sourceVersion: basename(input), preparedOn: new Date().toISOString(), productionImported: false,
    matchExistingBy: ['market', 'branchNumber', 'equipmentNumber'], stats, rejected,
  }, null, 2), { flag: 'wx' })
  console.log(JSON.stringify(stats))
  console.log('Local mapping only. Resolve existing branch/equipment IDs before an authorized import; no live records changed.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error) => { console.error(error.message); process.exitCode = 1 })
