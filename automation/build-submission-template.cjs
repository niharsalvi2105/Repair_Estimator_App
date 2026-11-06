const Excel = require('exceljs')
const fs = require('node:fs/promises')
const path = require('node:path')

const summaryFields = [
  ['EstimateNumber', 'A4:B4'], ['Revision', 'C4:D4'], ['Currency', 'E4:F4'], ['CalculationVersion', 'G4:H4'],
  ['OpportunityName', 'C7:H8'], ['AccountName', 'C9:F9'], ['AccountNumber', 'G9:H9'], ['ContactName', 'C10:H10'],
  ['ContactEmail', 'C11:F11'], ['ContactPhone', 'G11:H11'], ['Branch', 'C12:F12'], ['Market', 'G12:H12'],
  ['LocationDescription', 'C13:H14'], ['Province', 'C15:F15'], ['Salesperson', 'G15:H15'],
  ['EquipmentType', 'C16:F16'], ['JobType', 'G16:H16'], ['ProposalLanguage', 'C17:D17'],
  ['EquipmentCount', 'G17:H17'], ['PackageNames', 'A20:H22'], ['ScopePreview', 'A24:H28'],
  ['PackageCost', 'C32:D32'], ['AdditionalCost', 'G32:H32'], ['LaborCost', 'C33:D33'],
  ['MaterialCost', 'G33:H33'], ['TaxAmount', 'C34:D34'], ['FreightAmount', 'G34:H34'],
  ['TotalCost', 'C37:D38'], ['SellPrice', 'G37:H38'], ['SuggestedPrice', 'C40:D40'],
  ['KoneSuggestedPrice', 'G40:H40'], ['RecommendedCmii', 'C41:D41'], ['ActualCmii', 'G41:H41'],
  ['BaseCmii', 'C42:D42'], ['CmiiVariance', 'G42:H42'], ['AmIncentive', 'C43:D43'],
  ['BdIncentive', 'G43:H43'], ['BillingPlan', 'C45:H45'], ['NotesPreview', 'A48:H51'],
  ['SubmissionId', 'C54:H54'], ['GeneratedOn', 'C55:H55'],
]

function configure(sheet) {
  for (let c = 1; c <= 8; c++) sheet.getColumn(c).width = 12
  sheet.properties.defaultRowHeight = 12
  sheet.views = [{ showGridLines: false }]
  sheet.pageSetup = { paperSize: 1, orientation: 'portrait', fitToPage: true,
    fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
    margins: { left: .3, right: .3, top: .35, bottom: .4, header: .1, footer: .2 } }
  sheet.headerFooter.oddHeader = '&RClassification: KONE Internal'
  sheet.headerFooter.oddFooter = '&LRepair Estimator | Internal submission&RPage &P of &N'
}

function band(sheet, row, text) {
  sheet.mergeCells(`A${row}:H${row}`)
  const c = sheet.getCell(`A${row}`)
  c.value = text
  c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0067A6' } }
  c.alignment = { vertical: 'middle' }
  sheet.getRow(row).height = 19
}

function label(sheet, address, text) {
  const c = sheet.getCell(address)
  c.value = text
  c.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF24465B' } }
  c.alignment = { vertical: 'middle', wrapText: true }
}

async function buildSubmissionTemplate() {
  const book = new Excel.Workbook()
  book.creator = 'Repair Estimator'
  const sheet = book.addWorksheet('Estimate')
  configure(sheet)
  for (let r = 1; r <= 56; r++) {
    sheet.getRow(r).height = 12
    for (let c = 1; c <= 8; c++) sheet.getCell(r, c).font = { name: 'Calibri', size: 10 }
  }
  const image = book.addImage({ buffer: await fs.readFile(path.join(__dirname, '..', 'src', 'assets', 'kone-logo.jpg')), extension: 'jpeg' })
  sheet.addImage(image, { tl: { col: 0, row: 0 }, ext: { width: 82, height: 33 } })
  sheet.mergeCells('C1:H2')
  sheet.getCell('C1').value = 'REPAIR ESTIMATE | SUBMISSION'
  sheet.getCell('C1').font = { name: 'Calibri', size: 17, bold: true, color: { argb: 'FF0067A6' } }
  sheet.getCell('C1').alignment = { horizontal: 'right', vertical: 'middle' }
  for (const address of ['A3:B3', 'C3:D3', 'E3:F3', 'G3:H3']) sheet.mergeCells(address)
  sheet.getRow(3).height = 14
  for (const [address, text] of [['A3', 'REQUEST NUMBER'], ['C3', 'REVISION'], ['E3', 'CURRENCY'], ['G3', 'CALCULATION']])
    label(sheet, address, text)
  for (const [name, range] of summaryFields) {
    sheet.mergeCells(range)
    const first = range.split(':')[0]
    book.definedNames.add(`'Estimate'!${range}`, name)
    const c = sheet.getCell(first)
    c.value = ''
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F6FA' } }
    c.alignment = { vertical: 'middle', wrapText: true }
    c.border = { bottom: { style: 'hair', color: { argb: 'FFD0DDE6' } } }
  }
  band(sheet, 6, '01  OPPORTUNITY & CUSTOMER')
  for (const [row, text] of [[7, 'Opportunity name'], [9, 'Account / number'], [10, 'Contact'],
    [11, 'Email / phone'], [12, 'Branch / market'], [13, 'Functional location'],
    [15, 'Province / salesperson'], [16, 'Equipment / job type'], [17, 'Proposal language']]) {
    sheet.mergeCells(`A${row}:B${row}`)
    label(sheet, `A${row}`, text)
  }
  label(sheet, 'E17', 'Equipment count')
  for (let r = 9; r <= 17; r++) if (![13, 14].includes(r)) sheet.getRow(r).height = 18
  band(sheet, 19, '02  PACKAGES & SCOPE')
  sheet.mergeCells('A23:H23')
  label(sheet, 'A23', 'Scope summary - full text and assignments in Details')
  band(sheet, 30, '03  SAVED COSTS & PRICING')
  for (const [row, left, right] of [
    [32, 'Package estimated cost', 'Additional costs *'], [33, 'Labor cost', 'Material cost'],
    [34, 'Use-tax amount *', 'Freight amount *'], [37, 'TOTAL TRUE COST', 'ENTERED SELL PRICE'],
    [40, 'Suggested sell price', 'Suggested with KONE'],
    [41, 'Recommended CMII', 'Actual CMII'], [42, 'Base target CMII', 'CMII variance (pp)'],
    [43, 'AM incentive', 'BD incentive'],
  ]) {
    sheet.mergeCells(`A${row}:B${row}`); sheet.mergeCells(`E${row}:F${row}`)
    label(sheet, `A${row}`, left); label(sheet, `E${row}`, right)
    sheet.getRow(row).height = 20
  }
  sheet.mergeCells('A35:H35')
  sheet.getCell('A35').value = '* Additional costs include custom lines. Tax/freight are already included; do not add them again.'
  sheet.getCell('A35').font = { name: 'Calibri', size: 8, italic: true }
  sheet.getCell('A35').alignment = { wrapText: true }
  sheet.getRow(35).height = 22
  sheet.mergeCells('A45:B45'); label(sheet, 'A45', 'Billing plan')
  band(sheet, 47, '04  NOTES FOR CTT / QUOTING TEAM')
  sheet.mergeCells('A52:H52')
  sheet.getCell('A52').value = 'Saved Dataverse values only. See Details for complete scope, inputs and line items. No workbook pricing formulas.'
  sheet.getCell('A52').font = { name: 'Calibri', size: 8, italic: true }
  sheet.getCell('A52').alignment = { wrapText: true }
  sheet.getRow(52).height = 22
  sheet.mergeCells('A54:B54'); label(sheet, 'A54', 'Submission reference')
  sheet.mergeCells('A55:B55'); label(sheet, 'A55', 'Generated (UTC)')
  sheet.pageSetup.printArea = 'A1:H55'
  sheet.pageSetup.fitToHeight = 1
  const details = book.addWorksheet('Details')
  configure(details)
  details.getColumn(1).width = 22
  for (let c = 1; c <= 8; c++) {
    details.getColumn(c).font = { name: 'Calibri', size: 10 }
    if (c > 1) details.getColumn(c).width = 10.5
  }
  band(details, 1, 'REPAIR ESTIMATE | COMPLETE SUBMISSION DETAILS')
  details.getCell('A1').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF24465B' } }
  details.mergeCells('A3:H4')
  details.getCell('A3').value = 'Populated by FillSubmission.ts from the saved submission payload. Complete fields, equipment, package assignments, scope, labor and materials appear here. This blank template contains no customer records.'
  details.getCell('A3').alignment = { wrapText: true }
  details.pageSetup.printArea = 'A1:H5'
  const control = book.addWorksheet('_Template', { state: 'veryHidden' })
  control.getCell('A1').value = 'RepairEstimatorSubmission:2'
  return book
}

async function main() {
  const directory = process.argv[2]
  if (!directory) throw new Error('Provide the output directory.')
  await fs.mkdir(directory, { recursive: true })
  const book = await buildSubmissionTemplate()
  const filename = path.join(directory, 'RepairEstimator-Submission-v2.xlsx')
  const handle = await fs.open(filename, 'wx')
  try { await handle.writeFile(Buffer.from(await book.xlsx.writeBuffer())) }
  finally { await handle.close() }
  console.log(filename)
}

module.exports = { buildSubmissionTemplate, summaryFields }
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1 })
