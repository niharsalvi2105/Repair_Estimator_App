const Excel = require('exceljs')
const fs = require('node:fs/promises')
const path = require('node:path')

const headerKeys = [
  're_salesperson', 're_supervisor', 're_branch', 're_buildingname', 're_equipmenttype',
  're_numberofequipment', 're_customername', 're_customeremail', 're_customerphone', 're_jobtype',
  're_workcenterrequest', 're_numberoftechs', 're_hasbeenapproved', 're_nationalaccount',
  're_emergency', 're_subcontractorcost', 're_customerbudgeted', 're_papertype',
  're_consultantinvolved', 're_competingbids', 're_statedlaborrate',
]
const headerLabels = [
  'Salesperson', 'Supervisor', 'Branch', 'Building', 'Equipment type', 'Equipment count',
  'Customer', 'Customer email', 'Customer phone', 'Job type', 'Work center request',
  'Technician count', 'Approval', 'National account', 'Emergency', 'Subcontractor cost',
  'Customer budgeted', 'Paper type', 'Consultant involved', 'Competing bids', 'Stated labor rate',
]
const allMapped = [
  ...headerKeys, 're_prospectaccount', 're_soldto', 're_billto', 're_payer',
  're_packagelaborhours', 're_timecategory', 're_packagematerialcost', 're_packageestimatedcost',
  're_additionallaborhours', 're_additionalmaterial', 're_usetaxamount', 're_freightamount',
  're_additionalmiscellaneous', 're_totaladditionalcost', 're_sellprice', 're_totaltruecost',
  're_actualcmii', 're_recommendedcmii', 're_suggestedprice', 're_suggestedpricewithkonematerial',
  're_billingplan', 're_margincomments', 're_notesforcttteam', 're_usetax', 're_freight',
  're_konematerialcost', 're_custommaterialcost', 're_customlaborcost', 'transactioncurrencyid',
  're_proposallanguage', 're_miscellaneouscost', 're_laborcost', 're_materialcost',
  're_calculationversion', 're_konesparessalespricevk13',
]

function buildTemplate(kind, layout) {
  if (!['standard', 'custom'].includes(kind)) throw new Error('Invalid template kind')
  const custom = kind === 'custom'
  const book = new Excel.Workbook()
  book.creator = 'Repair Estimator'
  book.created = new Date('2026-01-01T00:00:00Z')
  const sheet = book.addWorksheet('VBP Submission', { views: [{ showGridLines: false }] })
  for (let column = 1; column <= 19; column++) sheet.getColumn(column).width = column === 1 ? 28 : 12
  for (let row = 1; row <= (custom ? 92 : 64); row++) sheet.getRow(row).height = 22
  if (layout) {
    for (const column of layout.columns) if (column.width) sheet.getColumn(column.index).width = column.width
    for (const row of layout.rows) {
      if (row.height) sheet.getRow(row.index).height = row.height
      for (const entry of row.cells) sheet.getCell(entry.address).style = entry.style
    }
    for (const merge of layout.merges) sheet.mergeCells(merge)
  }
  const mappings = {}
  function name(key, address) {
    const range = sheet.getCell(address)
    if (range.isMerged && range.master.address !== address)
      throw new Error(`Anchor ${key}:${address} is not a merge master (${range.master.address})`)
    mappings[key] = address
    book.definedNames.add(`'VBP Submission'!$${address.replace(/\d+/g, '')}$${range.row}`, key)
    range.value = ''
    range.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
    range.alignment = { ...range.alignment, wrapText: true, vertical: 'top' }
  }
  function heading(address, text) {
    const range = sheet.getCell(address)
    if (range.isMerged && range.master.address !== address) throw new Error(`Label ${address} is not a merge master`)
    range.value = text
    range.font = { ...range.font, name: 'Calibri', bold: true, color: { argb: 'FF17365D' } }
  }
  heading('A2', 'Repair Estimator - VBP Submission')
  headerKeys.forEach((key, index) => {
    const row = index + (custom ? 7 : 6)
    heading(`A${row}`, headerLabels[index])
    name(key, `B${row}`)
  })
  const fixed = custom ? {
    PackageNames: 'C32', PackageScopes: 'C33', AdditionalScope: 'C34',
    re_sellprice: 'D71', re_totaltruecost: 'F71', re_actualcmii: 'I71',
    re_recommendedcmii: 'K73', re_suggestedprice: 'M73', re_suggestedpricewithkonematerial: 'O73',
    re_billingplan: 'D72', re_margincomments: 'B78', re_notesforcttteam: 'B86',
    re_prospectaccount: 'E10', re_soldto: 'E11', re_billto: 'E12', re_payer: 'E13',
    CustomHours: 'D35', re_custommaterialcost: 'D36', re_usetaxamount: 'D38',
  } : {
    PackageNames: 'B30', PackageScopes: 'B31', AdditionalScope: 'B32',
    re_packagelaborhours: 'C33', re_timecategory: 'C34', re_packagematerialcost: 'C35',
    re_packageestimatedcost: 'C36', re_additionallaborhours: 'G33', re_additionalmaterial: 'G34',
    re_usetax: 'E35', re_freight: 'E36', re_additionalmiscellaneous: 'G37', re_totaladditionalcost: 'E38',
    re_sellprice: 'C43', re_actualcmii: 'H43', re_recommendedcmii: 'N43', re_suggestedprice: 'Q43',
    re_margincomments: 'B50', re_notesforcttteam: 'B58',
  }
  for (const [key, address] of Object.entries(fixed)) name(key, address)
  if (custom) {
    name('MaterialStart', 'A44')
    name('LaborStart', 'L45')
    name('CustomRowsEnd', 'A59')
    heading('A43', 'Scope')
    heading('B43', 'Material description')
    heading('E43', 'Vendor')
    heading('F43', 'Manufacturer (if supplied)')
    heading('G43', 'Part number')
    heading('H43', 'Quantity')
    heading('I43', 'Unit cost')
    heading('J43', 'Total cost')
    heading('L43', 'Scope')
    heading('M43', 'Mechanic')
    heading('O43', 'Helper')
    heading('Q43', 'Adjuster')
    heading('S43', 'Total cost')
    for (const [address, label] of Object.entries({ M44: 'ST', N44: 'DT', O44: 'ST', P44: 'DT', Q44: 'ST', R44: 'DT' }))
      heading(address, label)
    heading('A83', 'Generated by Repair Estimator. No macros are required.')
  }
  for (let index = 0; index < 14; index++) {
    name(`EquipmentNumber${index + 1}`, `M${index + (custom ? 9 : 8)}`)
    name(`EquipmentName${index + 1}`, `P${index + (custom ? 9 : 8)}`)
  }
  for (let index = 0; index < 3; index++)
    name(`Package${index + 1}`, custom ? `F${9 + index * 4}` : `F${8 + index * 4}`)
  heading(custom ? 'M8' : 'M7', 'Equipment number')
  heading(custom ? 'P8' : 'P7', 'Equipment name')
  name('EquipmentOverflow', custom ? 'M23' : 'M22')
  let next = custom ? 96 : 68
  for (const key of allMapped.filter(key => !mappings[key])) {
    heading(`A${next}`, key.replace(/^re_/, ''))
    name(key, `G${next++}`)
  }
  for (const key of ['TemplateVersion', 'SubmissionId', 'EstimateNumber', 'Revision', 'PackageOverflow']) {
    heading(`A${next}`, key)
    name(key, `G${next++}`)
  }
  sheet.getCell(mappings.TemplateVersion).value = `1:${kind}`
  name('Continuation', `A${next + 2}`)
  sheet.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  return book
}

async function main() {
  const directory = process.argv[2]
  if (!directory) throw new Error('Usage: node automation\\build-templates.cjs <output-directory> [style-only-layout.json]')
  const layouts = process.argv[3] ? JSON.parse(await fs.readFile(process.argv[3], 'utf8')) : {}
  await fs.mkdir(directory, { recursive: true })
  for (const kind of ['standard', 'custom']) {
    const filename = path.join(directory, `RepairEstimator-${kind}-v1.xlsx`)
    // Do not overwrite a template already under business review.
    const output = await fs.open(filename, 'wx')
    try { await output.writeFile(Buffer.from(await buildTemplate(kind, layouts[kind]).xlsx.writeBuffer())) }
    finally { await output.close() }
    console.log(`Created ${path.basename(filename)}`)
  }
}
module.exports = { buildTemplate, allMapped }
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1 })
