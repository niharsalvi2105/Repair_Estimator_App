interface ExportCell {
  key: string
  text: string | null
  number: number | null
}

interface ExportRow {
  id: string
  cells: ExportCell[]
}

interface ExportPayload {
  schemaVersion: string
  templateVersion: string
  submissionId: string
  revision: string
  mode: 'sample' | 'expanded'
  header: ExportRow
  equipment: ExportRow[]
  packages: ExportRow[]
  labor: ExportRow[]
  materials: ExportRow[]
  costs: ExportRow[]
}

interface ExportResult {
  submissionId: string
  revision: string
  templateVersion: string
  mode: string
  equipmentCount: number
  packageCount: number
  laborCount: number
  materialCount: number
  costCount: number
  totalTrueCost: number
  sellPrice: number
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validRow(value: unknown): value is ExportRow {
  if (!object(value) || typeof value.id !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.id) ||
    !Array.isArray(value.cells) || value.cells.length > 250) return false
  const keys = new Set<string>()
  for (const cell of value.cells) {
    if (!object(cell) || typeof cell.key !== 'string' || !/^(re_[a-z0-9]+|transactioncurrencyid)$/.test(cell.key) ||
      keys.has(cell.key) || !(cell.text === null || typeof cell.text === 'string' && cell.text.length <= 32700) ||
      !(cell.number === null || typeof cell.number === 'number' && Number.isFinite(cell.number))) return false
    keys.add(cell.key)
  }
  return true
}

function validate(json: string): ExportPayload {
  assert(encodeURIComponent(json).replace(/%[A-F0-9]{2}|./g, 'x').length <= 900000, 'EXPORT_PAYLOAD_LIMIT')
  const value: unknown = JSON.parse(json)
  assert(object(value), 'EXPORT_PAYLOAD_INVALID')
  if (!object(value)) throw new Error('EXPORT_PAYLOAD_INVALID')
  assert(value.schemaVersion === '1' && value.templateVersion === '1', 'EXPORT_VERSION_INVALID')
  assert(typeof value.submissionId === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.submissionId) &&
    typeof value.revision === 'string' && /^[0-9]+$/.test(value.revision), 'EXPORT_ID_INVALID')
  assert(value.mode === 'sample' || value.mode === 'expanded', 'EXPORT_MODE_INVALID')
  assert(validRow(value.header), 'EXPORT_HEADER_INVALID')
  let count = 0
  for (const key of ['equipment', 'packages', 'labor', 'materials', 'costs']) {
    const rows = value[key]
    assert(Array.isArray(rows) && rows.every(validRow), 'EXPORT_ROWS_INVALID')
    if (!Array.isArray(rows)) throw new Error('EXPORT_ROWS_INVALID')
    assert(new Set(rows.map(row => row.id)).size === rows.length, 'EXPORT_DUPLICATE_ROW')
    count += rows.length
  }
  assert(count <= 1000 && Array.isArray(value.equipment) && value.equipment.length > 0 &&
    Array.isArray(value.packages) && value.packages.length > 0, 'EXPORT_ROWS_LIMIT')
  assert(Array.isArray(value.equipment) && value.equipment.every(validRow) &&
    Array.isArray(value.packages) && value.packages.every(validRow) &&
    Array.isArray(value.labor) && value.labor.every(validRow) &&
    Array.isArray(value.materials) && value.materials.every(validRow) &&
    Array.isArray(value.costs) && value.costs.every(validRow), 'EXPORT_ROWS_INVALID')
  return {
    schemaVersion: value.schemaVersion, templateVersion: value.templateVersion,
    submissionId: value.submissionId, revision: value.revision, mode: value.mode,
    header: value.header, equipment: value.equipment, packages: value.packages,
    labor: value.labor, materials: value.materials, costs: value.costs,
  }
}

function cell(row: ExportRow, key: string): ExportCell | undefined {
  return row.cells.find(value => value.key === key)
}

function text(row: ExportRow, key: string): string {
  const value = cell(row, key)
  return value?.text ?? (value?.number !== null && value?.number !== undefined ? String(value.number) : '')
}

function number(row: ExportRow, key: string): number {
  const value = cell(row, key)?.number
  assert(typeof value === 'number' && Number.isFinite(value), `EXPORT_NUMBER_REQUIRED:${key}`)
  if (typeof value !== 'number') throw new Error(`EXPORT_NUMBER_REQUIRED:${key}`)
  return value
}

function safeText(value: string): string {
  let index = 0
  while (index < value.length && (value.charCodeAt(index) < 32 || /\s/.test(value[index]))) index++
  return '=+-@'.includes(value[index] ?? '\uffff') ? "'" + value : value
}

function write(range: ExcelScript.Range, value: string | number): void {
  if (typeof value === 'string') {
    range.setNumberFormat('@')
    range.setValue(safeText(value))
  } else {
    range.setNumberFormat('#,##0.00')
    range.setValue(value)
  }
}

function anchor(workbook: ExcelScript.Workbook, name: string): ExcelScript.Range {
  const item = workbook.getNamedItem(name)
  assert(item !== undefined, `EXPORT_ANCHOR_MISSING:${name}`)
  if (!item) throw new Error(`EXPORT_ANCHOR_MISSING:${name}`)
  return item.getRange()
}

function styleRows(sheet: ExcelScript.Worksheet, start: number, rows: number, columns: number, detail: boolean): void {
  const format = sheet.getRangeByIndexes(start, 0, rows, columns).getFormat()
  format.setWrapText(true)
  format.setRowHeight(36)
  if (detail) format.setColumnWidth(110)
}

function appendRows(sheet: ExcelScript.Worksheet, start: number, title: string, rows: ExportRow[], detail: boolean): number {
  const keys = Array.from(new Set(rows.flatMap(row => row.cells.map(value => value.key)))).sort()
  write(sheet.getRangeByIndexes(start, 0, 1, 1), title)
  const width = detail ? keys.length * 2 + 1 : 9
  const titleFormat = sheet.getRangeByIndexes(start, 0, 1, width).getFormat()
  titleFormat.getFill().setColor('#DCE6F1')
  titleFormat.getFont().setBold(true)
  let next = start + 1
  if (detail) {
    sheet.getRangeByIndexes(next++, 0, 1, keys.length * 2 + 1).setValues([
      ['Snapshot ID', ...keys.flatMap(key => [key, `${key} (label/text)`])],
    ])
    for (const row of rows) {
      write(sheet.getRangeByIndexes(next, 0, 1, 1), row.id)
      keys.forEach((key, index) => {
        const value = cell(row, key)
        write(sheet.getRangeByIndexes(next, index * 2 + 1, 1, 1), value?.number ?? '')
        write(sheet.getRangeByIndexes(next, index * 2 + 2, 1, 1), value?.text ?? '')
      })
      next++
    }
  } else {
    write(sheet.getRangeByIndexes(next, 0, 1, 1), 'Snapshot ID')
    write(sheet.getRangeByIndexes(next, 1, 1, 1), 'Field')
    write(sheet.getRangeByIndexes(next, 6, 1, 1), 'Numeric value')
    write(sheet.getRangeByIndexes(next++, 8, 1, 1), 'Label / text')
    for (const row of rows) {
      for (const value of row.cells) {
        write(sheet.getRangeByIndexes(next, 0, 1, 1), row.id)
        write(sheet.getRangeByIndexes(next, 1, 1, 1), value.key)
        write(sheet.getRangeByIndexes(next, 6, 1, 1), value.number ?? '')
        write(sheet.getRangeByIndexes(next, 8, 1, 1), value.text ?? '')
        next++
      }
    }
  }
  styleRows(sheet, start, next - start, width, detail)
  return next + 2
}

function fillCustom(workbook: ExcelScript.Workbook, sheet: ExcelScript.Worksheet, payload: ExportPayload): void {
  const materialStart = anchor(workbook, 'MaterialStart').getRowIndex()
  const laborStart = anchor(workbook, 'LaborStart').getRowIndex()
  const end = anchor(workbook, 'CustomRowsEnd').getRowIndex()
  const extra = Math.max(0, payload.materials.length - (end - materialStart), payload.labor.length - (end - laborStart))
  for (let i = 0; i < extra; i++) {
    const added = sheet.getRangeByIndexes(end + i, 0, 1, 19).getEntireRow().insert(ExcelScript.InsertShiftDirection.down)
    added.copyFrom(sheet.getRangeByIndexes(end + i - 1, 0, 1, 19).getEntireRow(), ExcelScript.RangeCopyType.all)
    added.clear(ExcelScript.ClearApplyTo.contents)
  }
  for (let index = 0; index < payload.materials.length; index++) {
    const row = payload.materials[index]
    const start = materialStart + index
    write(sheet.getRangeByIndexes(start, 0, 1, 1), 'Estimate scope')
    write(sheet.getRangeByIndexes(start, 1, 1, 1), text(row, 're_entereddescription'))
    write(sheet.getRangeByIndexes(start, 4, 1, 1), text(row, 're_vendor'))
    write(sheet.getRangeByIndexes(start, 6, 1, 1), text(row, 're_partnumber'))
    write(sheet.getRangeByIndexes(start, 7, 1, 1), number(row, 're_quantity'))
    write(sheet.getRangeByIndexes(start, 8, 1, 1), cell(row, 're_unitcostprecise')?.number ?? number(row, 're_unitcost'))
    write(sheet.getRangeByIndexes(start, 9, 1, 1), number(row, 're_totalcost'))
  }
  let hours = 0
  for (let index = 0; index < payload.labor.length; index++) {
    const row = payload.labor[index]
    const role = number(row, 're_laborrole') - 126110000
    const time = number(row, 're_timecategory') - 126110000
    const amount = number(row, 're_hours')
    const start = laborStart + index
    write(sheet.getRangeByIndexes(start, 11, 1, 1), 'Estimate scope')
    write(sheet.getRangeByIndexes(start, 12 + role * 2 + time, 1, 1), amount)
    write(sheet.getRangeByIndexes(start, 18, 1, 1), number(row, 're_totalcost'))
    hours += amount
  }
  write(anchor(workbook, 'CustomHours'), hours)
}

// Office Scripts invokes this entry point; it must remain self-contained (no imports or network calls).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function main(workbook: ExcelScript.Workbook, payloadJson: string): ExportResult {
  const payload = validate(payloadJson)
  assert(payload.packages.every(row => [0, 1].includes(number(row, 're_iscustompackage'))), 'EXPORT_PACKAGE_KIND_INVALID')
  const custom = payload.packages.some(row => number(row, 're_iscustompackage') === 1)
  const total = number(payload.header, 're_totaltruecost')
  const sell = number(payload.header, 're_sellprice')
  assert(total >= 0 && sell > 0, 'EXPORT_PRICE_INVALID')
  assert(number(payload.header, 're_numberofequipment') === payload.equipment.length, 'EXPORT_EQUIPMENT_COUNT_MISMATCH')
  const sheet = workbook.getWorksheet('VBP Submission')
  assert(sheet !== undefined && workbook.getWorksheets().length === 1, 'EXPORT_TEMPLATE_SHAPE_INVALID')
  if (!sheet) throw new Error('EXPORT_TEMPLATE_SHAPE_INVALID')
  assert(anchor(workbook, 'TemplateVersion').getValue() === `1:${custom ? 'custom' : 'standard'}`, 'EXPORT_TEMPLATE_VERSION_INVALID')
  assert(anchor(workbook, 'SubmissionId').getValue() === '', 'EXPORT_TEMPLATE_ALREADY_FILLED')
  const mapped = [
    're_salesperson', 're_supervisor', 're_branch', 're_buildingname', 're_equipmenttype',
    're_numberofequipment', 're_customername', 're_customeremail', 're_customerphone', 're_jobtype',
    're_workcenterrequest', 're_numberoftechs', 're_hasbeenapproved', 're_nationalaccount',
    're_emergency', 're_subcontractorcost', 're_customerbudgeted', 're_papertype',
    're_consultantinvolved', 're_competingbids', 're_statedlaborrate', 're_prospectaccount',
    're_soldto', 're_billto', 're_payer', 're_packagelaborhours', 're_timecategory',
    're_packagematerialcost', 're_packageestimatedcost', 're_additionallaborhours',
    're_additionalmaterial', 're_usetaxamount', 're_freightamount', 're_additionalmiscellaneous',
    're_totaladditionalcost', 're_sellprice', 're_totaltruecost', 're_actualcmii',
    're_recommendedcmii', 're_suggestedprice', 're_suggestedpricewithkonematerial',
    're_billingplan', 're_margincomments', 're_notesforcttteam', 're_usetax', 're_freight',
    're_konematerialcost', 're_custommaterialcost', 're_customlaborcost', 'transactioncurrencyid',
    're_proposallanguage', 're_miscellaneouscost', 're_laborcost', 're_materialcost',
    're_calculationversion', 're_konesparessalespricevk13',
  ]
  // Validate every destination before modifying the independent template copy.
  const choices = ['re_timecategory', 're_workcenterrequest', 're_hasbeenapproved', 're_nationalaccount',
    're_emergency', 're_customerbudgeted', 're_papertype', 're_consultantinvolved', 're_competingbids', 're_billingplan']
  for (const key of choices) {
    const value = cell(payload.header, key)
    assert(value?.number == null || !!value.text, `EXPORT_LABEL_REQUIRED:${key}`)
  }
  const anchors = [...mapped, 'Continuation', 'SubmissionId', 'EstimateNumber', 'Revision',
    'PackageNames', 'PackageScopes', 'AdditionalScope', 'EquipmentOverflow', 'PackageOverflow']
  for (let index = 1; index <= 14; index++) anchors.push(`EquipmentNumber${index}`, `EquipmentName${index}`)
  for (let index = 1; index <= 3; index++) anchors.push(`Package${index}`)
  if (custom) {
    anchors.push('CustomHours', 'MaterialStart', 'LaborStart', 'CustomRowsEnd')
    for (const row of payload.materials) for (const key of ['re_quantity', 're_unitcost', 're_totalcost'])
      number(row, key)
    for (const row of payload.labor) {
      assert([126110000, 126110001, 126110002].includes(number(row, 're_laborrole')) &&
        [126110000, 126110001].includes(number(row, 're_timecategory')), 'EXPORT_LABOR_KIND_INVALID')
      number(row, 're_hours'); number(row, 're_totalcost')
    }
  }
  anchors.forEach(key => anchor(workbook, key))
  if (custom) fillCustom(workbook, sheet, payload)
  for (const key of mapped) {
    const value = cell(payload.header, key)
    const choice = choices.includes(key)
    write(anchor(workbook, key), choice ? text(payload.header, key) : value?.number ?? value?.text ?? '')
    if (['re_actualcmii', 're_recommendedcmii', 're_usetax', 're_freight'].includes(key))
      anchor(workbook, key).setNumberFormat('0.00%')
  }
  write(anchor(workbook, 'SubmissionId'), payload.submissionId)
  write(anchor(workbook, 'EstimateNumber'), text(payload.header, 're_name'))
  write(anchor(workbook, 'Revision'), payload.revision)
  for (let index = 0; index < Math.min(14, payload.equipment.length); index++) {
    write(anchor(workbook, `EquipmentNumber${index + 1}`), text(payload.equipment[index], 're_equipmentnumber'))
    write(anchor(workbook, `EquipmentName${index + 1}`), text(payload.equipment[index], 're_equipmentnamesnapshot'))
  }
  const french = /French|fran[çc]ais/i.test(text(payload.header, 're_proposallanguage'))
  const packageName = (row: ExportRow): string => text(row, french ? 're_packagenamefr' : 're_packagenameen') || text(row, 're_packagenameen')
  const packageScope = (row: ExportRow): string => text(row, french ? 're_proposalscopefr' : 're_proposalscopeen') || text(row, 're_proposalscopeen')
  for (let index = 0; index < Math.min(3, payload.packages.length); index++)
    write(anchor(workbook, `Package${index + 1}`), packageName(payload.packages[index]))
  const allNames = payload.packages.map(packageName).join('\n')
  const allScopes = payload.packages.map(row => packageName(row) + ': ' + packageScope(row)).join('\n')
  write(anchor(workbook, 'PackageNames'), allNames.length <= 32700 ? allNames : 'See complete package names in Packages detail below.')
  write(anchor(workbook, 'PackageScopes'), allScopes.length <= 32700 ? allScopes : 'See complete scopes in Packages detail below.')
  write(anchor(workbook, 'EquipmentOverflow'), payload.equipment.length > 14 ? `${payload.equipment.length - 14} additional units: see Equipment detail.` : '')
  write(anchor(workbook, 'PackageOverflow'), payload.packages.length > 3 ? `${payload.packages.length - 3} additional packages: see Packages detail.` : '')
  write(anchor(workbook, 'AdditionalScope'), text(payload.header, 're_additionalscope'))
  const sections = [
    { name: 'Equipment', rows: payload.equipment }, { name: 'Packages', rows: payload.packages },
    { name: 'Labor', rows: payload.labor }, { name: 'Materials', rows: payload.materials },
    { name: 'Costs', rows: payload.costs },
  ]
  // Continuations stay on the sample worksheet. The expanded alternative uses one sheet per snapshot collection.
  let next = anchor(workbook, 'Continuation').getRowIndex()
  next = appendRows(sheet, next, 'Frozen header fields', [payload.header], false)
  if (payload.mode === 'sample') {
    for (const section of sections) next = appendRows(sheet, next, section.name, section.rows, false)
  } else {
    for (const section of sections) {
      const detailSheet = workbook.addWorksheet(section.name)
      appendRows(detailSheet, 0, section.name, section.rows, true)
      const width = new Set(section.rows.flatMap(row => row.cells.map(value => value.key))).size * 2 + 1
      detailSheet.addTable(detailSheet.getRangeByIndexes(1, 0, section.rows.length + 1, width), true)
        .setName(`Export${section.name}`)
    }
  }
  const used = sheet.getUsedRange()
  if (used) sheet.getPageLayout().setPrintArea(used)
  return {
    submissionId: payload.submissionId, revision: payload.revision, templateVersion: payload.templateVersion, mode: payload.mode,
    equipmentCount: payload.equipment.length, packageCount: payload.packages.length,
    laborCount: payload.labor.length, materialCount: payload.materials.length, costCount: payload.costs.length,
    totalTrueCost: total, sellPrice: sell,
  }
}
