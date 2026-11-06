interface SubmissionCell { key: string; text: string | null; number: number | null }
interface SubmissionRow { id: string; cells: SubmissionCell[] }
interface SubmissionPayload {
  schemaVersion: string; templateVersion: string; submissionId: string; revision: string; mode: string
  header: SubmissionRow; equipment: SubmissionRow[]; packages: SubmissionRow[]
  labor: SubmissionRow[]; materials: SubmissionRow[]; costs: SubmissionRow[]
}

function requireSubmission(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function submissionObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function submissionRow(value: unknown): value is SubmissionRow {
  if (!submissionObject(value) || typeof value.id !== 'string' ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.id) ||
    !Array.isArray(value.cells) || value.cells.length > 250) return false
  const keys = new Set<string>()
  return value.cells.every(c => {
    if (!submissionObject(c) || typeof c.key !== 'string' ||
      !/^(re_[a-z0-9_]+|transactioncurrencyid)$/.test(c.key) || keys.has(c.key) ||
      !(c.text === null || typeof c.text === 'string' && c.text.length <= 32700) ||
      !(c.number === null || typeof c.number === 'number' && Number.isFinite(c.number))) return false
    keys.add(c.key)
    return true
  })
}

function submissionPayload(json: string): SubmissionPayload {
  requireSubmission(encodeURIComponent(json).replace(/%[A-F0-9]{2}|./g, 'x').length <= 900000, 'SUBMISSION_PAYLOAD_LIMIT')
  const p: unknown = JSON.parse(json)
  requireSubmission(submissionObject(p) && p.schemaVersion === '1' && p.templateVersion === '1', 'SUBMISSION_PAYLOAD_VERSION')
  requireSubmission(typeof p.submissionId === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(p.submissionId) &&
    typeof p.revision === 'string' && /^[0-9]+$/.test(p.revision) &&
    (p.mode === 'sample' || p.mode === 'expanded') && submissionRow(p.header), 'SUBMISSION_HEADER_INVALID')
  let count = 0
  for (const key of ['equipment', 'packages', 'labor', 'materials', 'costs']) {
    const rows = p[key]
    requireSubmission(Array.isArray(rows) && rows.every(submissionRow) &&
      new Set(rows.map(r => r.id)).size === rows.length, `SUBMISSION_ROWS_INVALID:${key}`)
    count += rows.length
  }
  requireSubmission(Array.isArray(p.equipment) && p.equipment.every(submissionRow) &&
    Array.isArray(p.packages) && p.packages.every(submissionRow) &&
    Array.isArray(p.labor) && p.labor.every(submissionRow) &&
    Array.isArray(p.materials) && p.materials.every(submissionRow) &&
    Array.isArray(p.costs) && p.costs.every(submissionRow) &&
    count <= 1000 && p.equipment.length > 0 && p.packages.length > 0, 'SUBMISSION_ROWS_LIMIT')
  return { schemaVersion: p.schemaVersion, templateVersion: p.templateVersion,
    submissionId: p.submissionId, revision: p.revision, mode: p.mode, header: p.header,
    equipment: p.equipment, packages: p.packages, labor: p.labor, materials: p.materials, costs: p.costs }
}

function submissionCell(row: SubmissionRow, key: string): SubmissionCell | undefined {
  return row.cells.find(c => c.key === key)
}

function submissionText(row: SubmissionRow, key: string): string {
  const c = submissionCell(row, key)
  return c?.text ?? (c?.number == null ? '' : String(c.number))
}

function submissionNumber(row: SubmissionRow, key: string): number {
  const value = submissionCell(row, key)?.number
  requireSubmission(typeof value === 'number' && Number.isFinite(value), `SUBMISSION_NUMBER_REQUIRED:${key}`)
  return value
}

function submissionWrite(range: ExcelScript.Range, value: string | number, format = '#,##0.00'): void {
  range.setNumberFormat(typeof value === 'string' ? '@' : format)
  let index = 0
  if (typeof value === 'string')
    while (index < value.length && (value.charCodeAt(index) < 32 || /\s/.test(value[index]))) index++
  range.setValue(typeof value === 'string' && '=+-@'.includes(value[index] ?? '\uffff') ? "'" + value : value)
}

const submissionLabels: Record<string, string> = {
  re_name: 'Request number', re_estimatename: 'Opportunity name', re_customeraccount: 'Account name',
  re_accountnumber: 'Account number', re_customercontact: 'Selected Contact', re_customername: 'Customer / Contact name',
  re_customeremail: 'Customer email', re_customerphone: 'Customer phone', re_branch: 'Branch', re_market: 'Market',
  re_country: 'Country', re_buildingprovincestate: 'Building province / state', re_buildingname: 'Functional location description',
  re_equipmenttype: 'Equipment type', re_jobtype: 'Job type', re_salesperson: 'Salesperson', re_supervisor: 'Supervisor',
  re_numberofequipment: 'Equipment count', re_proposallanguage: 'Proposal language',
  re_workcenterrequest: 'Work-centre request', re_numberoftechs: 'Number of technicians',
  re_hasbeenapproved: 'Has it been approved?', re_nationalaccount: 'National Account', re_emergency: 'Emergency / unit shutdown',
  re_subcontractorcost: 'Subcontractor cost (captured only; excluded from totals)', re_customerbudgeted: 'Customer budgeted',
  re_papertype: 'Paper type', re_consultantinvolved: 'Consultant involved', re_competingbids: 'Competing bids',
  re_statedlaborrate: 'Stated labor billing rate', re_timecategory: 'Labor time category',
  re_additionallaborhours: 'Additional labor hours', re_additionalmaterial: 'Additional material',
  re_additionalmiscellaneous: 'Additional miscellaneous', re_usetax: 'Use-tax rate', re_freight: 'Freight rate',
  re_additionalscope: 'Additional scope', re_sellprice: 'Entered selling price', re_totaltruecost: 'Total true cost',
  re_suggestedprice: 'Suggested sell price', re_suggestedpricewithkonematerial: 'Suggested price with KONE',
  re_konesparessalespricevk13: 'Legacy aggregate VK13', re_billingplan: 'Billing plan',
  re_margincomments: 'Margin justification', re_notesforcttteam: 'Notes for CTT team',
  re_prospectaccount: 'Prospect account number', re_soldto: 'Sold-to', re_billto: 'Bill-to', re_payer: 'Payer',
  re_calculationversion: 'Calculation version', re_calculatedon: 'Calculated (UTC)',
  re_actualcmii: 'Actual CMII', re_recommendedcmii: 'Recommended CMII', re_basetargetcmii: 'Base target CMII',
  re_cmiivariance: 'CMII variance (fraction)', re_amincentive: 'AM incentive', re_bdincentive: 'BD incentive',
  re_packageestimatedcost: 'Package estimated cost', re_totaladditionalcost: 'Additional costs including custom lines',
  re_customlaborcost: 'Custom labor cost', re_custommaterialcost: 'Custom material before tax/freight',
  re_konematerialcost: 'KONE material cost', re_laborcost: 'Labor cost', re_materialcost: 'Material cost',
  re_miscellaneouscost: 'Miscellaneous cost', re_usetaxamount: 'Use-tax amount (included)', re_freightamount: 'Freight amount (included)',
  transactioncurrencyid: 'Estimate currency',
  re_equipmentnumber: 'Equipment number', re_equipmentnamesnapshot: 'Equipment name',
  re_functionallocation: 'Functional location number', re_oem: 'OEM', re_equipmentage: 'Equipment age',
  re_packagenumber: 'Package number', re_packagenameen: 'Package name (EN)', re_packagenamefr: 'Package name (FR)',
  re_proposalscopeen: 'Scope of work (EN)', re_proposalscopefr: 'Scope of work (FR)',
  re_equipmentnumbers: 'Assigned equipment numbers', re_quantity: 'Quantity', re_mechanichoursperunit: 'Mechanic hours per unit',
  re_materialcostperunit: 'Material cost per unit', re_materialbeforemarkup: 'Material before markup',
  re_totalhours: 'Total hours', re_totalmaterial: 'Total material', re_iscustompackage: 'Custom package',
  re_istimematerial: 'Time and material', re_packagepricedkone: 'Package-priced KONE',
  re_laborrole: 'Labor role', re_hours: 'Hours', re_hourlycost: 'Hourly cost', re_totalcost: 'Line total cost',
  re_estimatepackage: 'Assigned package', re_partnumber: 'Part number', re_entereddescription: 'Entered material description',
  re_descriptionen: 'Description (EN)', re_descriptionfr: 'Description (FR)', re_vendor: 'Vendor',
  re_unitcost: 'Unit cost', re_unitcostprecise: 'Precise unit cost', re_unitpriceprecise: 'Precise unit selling price',
  re_extendedcost: 'Extended cost', re_taxamount: 'Line tax amount',
  re_parttype: 'Part classification', re_materialpricingmode: 'Material pricing source',
  re_markuppct: 'Markup (%)', re_uom: 'Unit of measure', re_taxapplicable: 'Tax applicable', re_freightapplicable: 'Freight applicable',
}

function submissionChunks(text: string, limit: number): string[] {
  const result: string[] = []
  for (const line of text.split(/\r\n|\r|\n/)) {
    if (!line) { result.push(''); continue }
    let remaining = line
    while (remaining.length) {
      let end = Math.min(limit, remaining.length)
      if (end < remaining.length && /[\uD800-\uDBFF]/.test(remaining[end - 1])) end--
      result.push(remaining.slice(0, end))
      remaining = remaining.slice(end)
    }
  }
  return result
}

// Excel invokes the standalone Office Script entry point.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function main(workbook: ExcelScript.Workbook, payloadJson: string, currencyCode: string, generatedUtc: string) {
  const p = submissionPayload(payloadJson)
  requireSubmission(/^[A-Z]{3}$/.test(currencyCode) && Number.isFinite(Date.parse(generatedUtc)) &&
    /Z$/.test(generatedUtc), 'SUBMISSION_CURRENCY_OR_TIME_INVALID')
  const h = p.header
  const total = submissionNumber(h, 're_totaltruecost')
  const sell = submissionNumber(h, 're_sellprice')
  const rec = submissionNumber(h, 're_recommendedcmii')
  requireSubmission(total >= 0 && sell > 0 && rec >= 0 && rec < 1 &&
    submissionNumber(h, 're_suggestedprice') >= 0 &&
    submissionNumber(h, 're_numberofequipment') === p.equipment.length, 'SUBMISSION_PRICING_INVALID')
  submissionNumber(h, 're_actualcmii')
  requireSubmission(submissionText(h, 're_calculationversion') !== '' &&
    submissionText(h, 're_calculationversion') !== 'unavailable', 'SUBMISSION_PRICING_UNAVAILABLE')
  for (const key of ['re_market', 're_proposallanguage', 're_workcenterrequest', 're_hasbeenapproved',
    're_nationalaccount', 're_emergency', 're_customerbudgeted', 're_papertype',
    're_consultantinvolved', 're_competingbids', 're_timecategory', 're_billingplan']) {
    const c = submissionCell(h, key)
    requireSubmission(c?.number == null || !!c.text, `SUBMISSION_LABEL_REQUIRED:${key}`)
  }
  const control = workbook.getWorksheet('_Template')
  const sheet = workbook.getWorksheet('Estimate')
  const details = workbook.getWorksheet('Details')
  requireSubmission(control && sheet && details && workbook.getWorksheets().length === 3 &&
    control.getRangeByIndexes(0, 0, 1, 1).getValue() === 'RepairEstimatorSubmission:2', 'SUBMISSION_TEMPLATE_INVALID')
  requireSubmission(control.getRangeByIndexes(1, 0, 1, 1).getValue() === '', 'SUBMISSION_TEMPLATE_ALREADY_FILLED')
  const destinations: Record<string, string | number> = {
    EstimateNumber: submissionText(h, 're_name'), Revision: p.revision, Currency: currencyCode,
    CalculationVersion: submissionText(h, 're_calculationversion'), OpportunityName: submissionText(h, 're_estimatename'),
    AccountName: submissionText(h, 're_customeraccount'), AccountNumber: submissionText(h, 're_accountnumber'),
    ContactName: submissionText(h, 're_customername'),
    ContactEmail: submissionText(h, 're_customeremail'), ContactPhone: submissionText(h, 're_customerphone'),
    Branch: submissionText(h, 're_branch'), Market: submissionText(h, 're_market'),
    LocationDescription: submissionText(h, 're_buildingname'), Province: submissionText(h, 're_buildingprovincestate'),
    Salesperson: submissionText(h, 're_salesperson'), EquipmentType: submissionText(h, 're_equipmenttype'),
    JobType: submissionText(h, 're_jobtype'), ProposalLanguage: submissionText(h, 're_proposallanguage'),
    EquipmentCount: p.equipment.length, TotalCost: total, SellPrice: sell,
    SuggestedPrice: submissionNumber(h, 're_suggestedprice'), RecommendedCmii: rec,
    ActualCmii: submissionNumber(h, 're_actualcmii'), BillingPlan: submissionText(h, 're_billingplan'),
    SubmissionId: p.submissionId, GeneratedOn: generatedUtc,
  }
  const amounts: Record<string, string> = {
    PackageCost: 're_packageestimatedcost', AdditionalCost: 're_totaladditionalcost',
    LaborCost: 're_laborcost', MaterialCost: 're_materialcost', TaxAmount: 're_usetaxamount',
    FreightAmount: 're_freightamount', KoneSuggestedPrice: 're_suggestedpricewithkonematerial',
    BaseCmii: 're_basetargetcmii', AmIncentive: 're_amincentive', BdIncentive: 're_bdincentive',
  }
  for (const name of Object.keys(amounts)) destinations[name] = submissionCell(h, amounts[name])?.number ?? ''
  const variance = submissionCell(h, 're_cmiivariance')?.number
  destinations.CmiiVariance = variance == null ? '' : variance * 100
  const french = /French|fran[çc]ais/i.test(submissionText(h, 're_proposallanguage'))
  const names = p.packages.map(row => submissionText(row, french ? 're_packagenamefr' : 're_packagenameen') ||
    submissionText(row, 're_packagenameen'))
  const preview = (value: string, limit: number): string =>
    value.length > limit || value.split('\n').length > 4 ? 'See Details for complete text (not truncated).' : value
  destinations.PackageNames = preview(names.join(' | '), 230)
  destinations.ScopePreview = preview(p.packages.map((row, i) => `${names[i]}: ${
    submissionText(row, french ? 're_proposalscopefr' : 're_proposalscopeen') || submissionText(row, 're_proposalscopeen')}`).join('\n'), 350)
  destinations.NotesPreview = preview(submissionText(h, 're_notesforcttteam'), 300)
  const shortFields: Record<string, number> = {
    OpportunityName: 120, AccountName: 42, AccountNumber: 20, ContactName: 64,
    ContactEmail: 44, ContactPhone: 20, Branch: 44, Market: 20, LocationDescription: 120,
    Province: 44, Salesperson: 20, EquipmentType: 44, JobType: 20, ProposalLanguage: 20, BillingPlan: 64,
  }
  for (const name of Object.keys(shortFields)) {
    const value = destinations[name]
    if (typeof value === 'string' && (value.length > shortFields[name] || /[\r\n]/.test(value)))
      destinations[name] = 'See Details'
  }
  for (const name of Object.keys(destinations))
    requireSubmission(workbook.getNamedItem(name), `SUBMISSION_ANCHOR_MISSING:${name}`)
  for (const name of Object.keys(destinations)) {
    const item = workbook.getNamedItem(name)
    if (!item) throw new Error(`SUBMISSION_ANCHOR_MISSING:${name}`)
    submissionWrite(item.getRange(), destinations[name], ['ActualCmii', 'RecommendedCmii', 'BaseCmii'].includes(name) ? '0.00%' :
      name === 'EquipmentCount' ? '0' : name === 'CmiiVariance' ? '0.00" pp"' : '#,##0.00')
  }
  const usedDetails = details.getUsedRange()
  if (usedDetails) { usedDetails.unmerge(); usedDetails.clear(ExcelScript.ClearApplyTo.contents) }
  let next = 0
  const section = (title: string): void => {
    const range = details.getRangeByIndexes(next++, 0, 1, 8)
    range.merge(false)
    submissionWrite(range, title)
    range.getFormat().getFill().setColor('#DCECF6')
    range.getFormat().getFont().setBold(true)
    range.getFormat().setRowHeight(22)
  }
  const entry = (label: string, value: string | number): void => {
    const lines = typeof value === 'number' ? [value] : submissionChunks(value, 72)
    const labels = submissionChunks(label, 36)
    for (let i = 0; i < Math.max(lines.length, labels.length); i++) {
      submissionWrite(details.getRangeByIndexes(next, 0, 1, 1), labels[i] ?? '(continued)')
      const range = details.getRangeByIndexes(next, 1, 1, 7)
      range.merge(false)
      const value = lines[i] ?? ''
      submissionWrite(range, value, typeof value === 'number' && Number.isInteger(value) ? '#,##0' : '#,##0.##########')
      details.getRangeByIndexes(next, 0, 1, 8).getFormat().setWrapText(true)
      details.getRangeByIndexes(next, 0, 1, 8).getFormat().setRowHeight(32)
      next++
    }
  }
  section(`REQUEST ${submissionText(h, 're_name')} | ${currencyCode}`)
  entry('Submission reference', p.submissionId); entry('Revision', p.revision); entry('Generated (UTC)', generatedUtc)
  entry('Financial note', 'Saved values only. Tax/freight and custom costs are included in totals, not added again. Subcontractor cost is captured only.')
  for (const collection of [
    { title: 'OPPORTUNITY / REQUEST / COST / PRICING FIELDS', rows: [h] },
    { title: 'EQUIPMENT', rows: p.equipment }, { title: 'PACKAGES / SCOPE / EQUIPMENT ASSIGNMENTS', rows: p.packages },
    { title: 'CUSTOM LABOR', rows: p.labor }, { title: 'CUSTOM MATERIALS', rows: p.materials },
    { title: 'OTHER SAVED COST ROWS', rows: p.costs },
  ]) {
    section(collection.title)
    if (!collection.rows.length) entry('Entries', 'None')
    for (let i = 0; i < collection.rows.length; i++) {
      const row = collection.rows[i]
      if (collection.rows.length > 1) section(`${collection.title} | ${i + 1}`)
      entry('Saved record ID', row.id)
      for (const c of row.cells) {
        const label = submissionLabels[c.key] ?? c.key
        if (c.text != null || c.number != null) {
          entry(label, c.text ?? c.number ?? '')
          if (c.text != null && c.number != null) entry(`${label} (stored number)`, c.number)
        }
      }
    }
  }
  details.getPageLayout().setPrintArea(details.getRangeByIndexes(0, 0, next, 8))
  submissionWrite(control.getRangeByIndexes(1, 0, 1, 1), p.submissionId)
  return { templateVersion: '2', submissionId: p.submissionId, revision: p.revision,
    currencyCode, totalTrueCost: total, sellPrice: sell, detailRows: next,
    equipmentCount: p.equipment.length, packageCount: p.packages.length, output: 'PDF' }
}
