import ExcelJS from 'exceljs'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const headers = [
  'Condition Type', 'Sales Organization', 'Distribution Channel', 'Material', 'Material Description',
  'Valid From', 'Valid to', 'Price (USD)', 'Condition currency', 'Pricing unit', 'Unit of measure',
  'Cost (USD)', 'Condition currency', 'Condition record no.', 'Price (CAD)', 'Condition currency',
  'Cost (CAD)', 'Condition currency',
]
const columns = [
  're_sourcekey', 're_partnumber', 're_name', 're_descriptionen', 're_parttype', 're_usdcost', 're_usdprice',
  're_sourcecurrency', 're_pricingunit', 're_uom', 're_salesorganization', 're_distributionchannel',
  're_conditionrecord', 're_sourceversion', 're_effectivefrom', 're_effectiveto', 're_refreshedon',
]

function date(value) {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : undefined
}
function amount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1000000000 &&
    value === Number(value.toFixed(6)) ? value.toFixed(6) : undefined
}
function text(cell) {
  return typeof cell.value === 'string' ? cell.value.trim()
    : typeof cell.value === 'number' ? cell.text.trim() : ''
}

export function preparePartCatalog(workbook, { asOf, sourceVersion, refreshedOn }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || date(new Date(`${asOf}T00:00:00Z`)) !== asOf)
    throw new Error('Use a valid --as-of YYYY-MM-DD date.')
  if (!sourceVersion?.trim() || sourceVersion.length > 100 || !date(new Date(refreshedOn)))
    throw new Error('A valid source version (at most 100 characters) and refresh timestamp are required.')
  const sheet = workbook.getWorksheet('Material')
  if (!sheet || headers.some((header, i) => sheet.getRow(1).getCell(i + 1).text !== header))
    throw new Error('The Material worksheet headers do not match the approved workbook contract.')
  const candidates = []
  const rejected = []
  const counts = new Map()
  const stats = { sourceRows: 0, expired: 0, future: 0, effective: 0, approved: 0, rejected: 0 }
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    stats.sourceRows++
    const number = text(row.getCell(4))
    const description = text(row.getCell(5))
    const from = date(row.getCell(6).value)
    const to = date(row.getCell(7).value)
    const reasons = []
    if (!from || !to || from > to) reasons.push('Invalid validity dates')
    else if (to < asOf) { stats.expired++; return }
    else if (from > asOf) { stats.future++; return }
    else stats.effective++
    const sourceKey = `Material:${text(row.getCell(1))}:${text(row.getCell(2))}:${text(row.getCell(3))}:${number}`
    counts.set(sourceKey, (counts.get(sourceKey) ?? 0) + 1)
    const cost = amount(row.getCell(12).value)
    const price = amount(row.getCell(8).value)
    const condition = text(row.getCell(1))
    const organization = text(row.getCell(2))
    const channel = text(row.getCell(3))
    const record = text(row.getCell(14))
    const uom = text(row.getCell(11))
    if (!number || number.length > 100) reasons.push('Missing/oversized part number')
    if (!description || description.length > 2000) reasons.push('Missing/oversized material description')
    if (!cost) reasons.push('USD cost must be positive with at most six decimal places')
    if (!price) reasons.push('USD price must be positive with at most six decimal places')
    if (text(row.getCell(9)) !== 'USD' || text(row.getCell(13)) !== 'USD') reasons.push('Invalid source currency')
    if (row.getCell(10).value !== 1) reasons.push('Only pricing unit 1 is approved')
    if (!uom || uom.length > 20) reasons.push('Missing/oversized unit of measure')
    if (condition !== 'ZR00' || organization !== 'MKOM' || channel !== '01') reasons.push('Unapproved source context')
    if (!record || record.length > 100) reasons.push('Missing/oversized condition record')
    if (reasons.length) rejected.push({ row: rowNumber, partNumber: number, reasons })
    else candidates.push({
      row: rowNumber,
      values: {
        re_sourcekey: sourceKey,
        re_partnumber: number, re_name: number, re_descriptionen: description, re_parttype: 126110000,
        re_usdcost: cost, re_usdprice: price, re_sourcecurrency: 'USD', re_pricingunit: '1',
        re_uom: uom, re_salesorganization: organization, re_distributionchannel: channel,
        re_conditionrecord: record, re_sourceversion: sourceVersion, re_effectivefrom: from,
        re_effectiveto: to, re_refreshedon: refreshedOn,
      },
    })
  })
  const approved = []
  for (const candidate of candidates) {
    if (counts.get(candidate.values.re_sourcekey) > 1)
      rejected.push({ row: candidate.row, partNumber: candidate.values.re_partnumber, reasons: ['Ambiguous effective source key'] })
    else approved.push(candidate.values)
  }
  stats.approved = approved.length
  stats.rejected = rejected.length
  return { approved, report: { asOf, sourceVersion, refreshedOn, productionImported: false, stats, rejected } }
}

function csv(rows) {
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  return [columns.join(','), ...rows.map((row) => columns.map((column) => quote(row[column])).join(','))].join('\r\n') + '\r\n'
}

async function main() {
  const [input, output, flag, asOf] = process.argv.slice(2)
  if (!input || !output || flag !== '--as-of' || !asOf || process.argv.length !== 6)
    throw new Error('Usage: node backend\\prepare-part-catalog.mjs <workbook.xlsx> <output-directory> --as-of YYYY-MM-DD')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(resolve(input))
  const { approved, report } = preparePartCatalog(workbook, {
    asOf, sourceVersion: basename(input), refreshedOn: new Date().toISOString(),
  })
  await mkdir(resolve(output), { recursive: true })
  await writeFile(join(resolve(output), 'spare-parts-approved.csv'), csv(approved), { flag: 'wx' })
  await writeFile(join(resolve(output), 'spare-parts-import-report.json'), JSON.stringify(report, null, 2), { flag: 'wx' })
  console.log(JSON.stringify(report.stats))
  console.log('Local extract only. Review exclusions and deploy schema/configuration before an authorized Dataverse import.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1 })
}
