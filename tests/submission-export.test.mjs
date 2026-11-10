import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import Excel from 'exceljs'

const require = createRequire(import.meta.url)
const { buildTemplate } = require('../automation/build-templates.cjs')
const unzip = require('unzipper')
const script = ts.transpileModule(readFileSync(new URL('../automation/office-scripts/FillEstimate.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
}).outputText
const main = vm.runInNewContext(script + '\nmain', {
  ExcelScript: { InsertShiftDirection: { down: 'down' }, RangeCopyType: { all: 'all' }, ClearApplyTo: { contents: 'contents' } },
})
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const field = (key, value, text = null) => ({
  key, number: typeof value === 'number' ? value : null, text: typeof value === 'string' ? value : text,
})
const row = (n, ...cells) => ({ id: id(n), cells })

function payload({ custom = false, mode = 'sample', units = 2, packages = 1 } = {}) {
  return {
    schemaVersion: '1', templateVersion: '1', submissionId: id(10000), revision: '12345', mode,
    header: row(10001, field('re_name', '0000000025'), field('re_totaltruecost', 49.66248),
      field('re_sellprice', 100), field('re_numberofequipment', units), field('re_usetax', 0.03),
      field('re_freight', 0.12), field('re_actualcmii', 0.5033752),
      field('re_customerphone', '+123456789'), field('re_notesforcttteam', '=HYPERLINK("bad")'),
      field('re_billingplan', 126110000, 'Upon completion')),
    equipment: Array.from({ length: units }, (_, i) => row(i + 1,
      field('re_equipmentnumber', String(i + 1).padStart(8, '0')), field('re_equipmentnamesnapshot', `Unit ${i + 1}`))),
    packages: Array.from({ length: packages }, (_, i) => row(i + 100,
      field('re_packagenameen', `Package ${i + 1}`), field('re_proposalscopeen', `Scope ${i + 1}`),
      field('re_iscustompackage', custom ? 1 : 0, custom ? 'Oui' : 'Non'))),
    labor: [], materials: [row(200, field('re_partnumber', '000123'), field('re_unitcostprecise', 49.66248),
      field('re_unitcost', 49.66), field('re_totalcost', 49.66), field('re_quantity', 1),
      field('re_entereddescription', 'Part description'), field('re_vendor', 'Supplier'),
      field('re_linetype', 126110000, 'Catalog'))],
    costs: [row(300, field('re_name', 'Extra cost'), field('re_amount', 12.34))],
  }
}

function adapter(book) {
  const range = (sheet, r, c, rows = 1, columns = 1) => {
    function each(fn) {
      for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) fn(sheet.getCell(r + i + 1, c + j + 1))
    }
    return {
      r, c, rows, columns,
      getValue: () => sheet.getCell(r + 1, c + 1).value ?? '',
      getRowIndex: () => r,
      setValue: value => { sheet.getCell(r + 1, c + 1).value = value },
      setValues: values => values.forEach((line, i) => line.forEach((value, j) => {
        sheet.getCell(r + i + 1, c + j + 1).value = value
      })),
      setNumberFormat: value => each(cell => { cell.numFmt = value }),
      getFormat: () => ({
        getFill: () => ({ setColor: color => each(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color.slice(1) } }
        }) }),
        getFont: () => ({ setBold: bold => each(cell => { cell.font = { ...cell.font, bold } }) }),
        setWrapText: wrapText => each(cell => { cell.alignment = { ...cell.alignment, wrapText } }),
        setRowHeight: height => { for (let i = 0; i < rows; i++) sheet.getRow(r + i + 1).height = height },
        setColumnWidth: width => { for (let i = 0; i < columns; i++) sheet.getColumn(c + i + 1).width = width / 7 },
      }),
      getEntireRow: () => range(sheet, r, 0, rows, 19),
      insert: () => {
        sheet.spliceRows(r + 1, 0, [])
        return range(sheet, r, c, rows, columns)
      },
      copyFrom: source => each(cell => {
        const sourceCell = sheet.getCell(source.r + 1, source.c + cell.col - c)
        cell.value = sourceCell.value
        cell.style = structuredClone(sourceCell.style)
      }),
      clear: () => each(cell => { cell.value = null }),
    }
  }
  const worksheet = sheet => ({
    getRangeByIndexes: (r, c, rows, columns) => range(sheet, r, c, rows, columns),
    getUsedRange: () => range(sheet, 0, 0, sheet.rowCount, sheet.columnCount),
    getPageLayout: () => ({ setPrintArea: value => {
      sheet.pageSetup.printArea = `A1:${sheet.getCell(value.rows, value.columns).address}`
    } }),
    addTable: (value, hasHeaders) => ({
      setName: name => sheet.addTable({
        name, ref: sheet.getCell(value.r + 1, value.c + 1).address, headerRow: hasHeaders,
        columns: Array.from({ length: value.columns }, (_, i) => ({
          name: String(sheet.getCell(value.r + 1, value.c + i + 1).value),
        })),
        rows: Array.from({ length: value.rows - 1 }, (_, i) => Array.from({ length: value.columns }, (_, j) =>
          sheet.getCell(value.r + i + 2, value.c + j + 1).value ?? '')),
      }),
    }),
  })
  return {
    getNamedItem: name => {
      const address = book.definedNames.getRanges(name).ranges[0]
      if (!address) return undefined
      const match = /^'VBP Submission'!\$([A-Z]+)\$(\d+)$/.exec(address)
      assert.ok(match, `Unexpected anchor ${address}`)
      const cell = book.getWorksheet('VBP Submission').getCell(`${match[1]}${match[2]}`)
      return { getRange: () => range(cell.worksheet, cell.row - 1, cell.col - 1) }
    },
    getWorksheet: name => book.getWorksheet(name) ? worksheet(book.getWorksheet(name)) : undefined,
    getWorksheets: () => book.worksheets.map(worksheet),
    addWorksheet: name => worksheet(book.addWorksheet(name)),
  }
}

function named(book, name) {
  const address = book.definedNames.getRanges(name).ranges[0].split('!')[1].replaceAll('$', '')
  return book.getWorksheet('VBP Submission').getCell(address)
}

test('French estimate export retains explicit clears but falls back for missing translations', async () => {
  for (const cleared of [false, true]) {
    const book = buildTemplate('custom')
    const data = payload({ custom: true })
    data.header.cells.push(field('re_proposallanguage', 126110001, 'French'))
    data.packages[0].cells.push(field('re_customnamefrcleared', cleared ? 1 : 0),
      field('re_customscopefrcleared', cleared ? 1 : 0))
    main(adapter(book), JSON.stringify(data))
    assert.equal(named(book, 'PackageNames').value, cleared ? '' : 'Package 1')
    assert.equal(named(book, 'PackageScopes').value, cleared ? ': ' : 'Package 1: Scope 1')
  }
})

for (const custom of [false, true]) for (const mode of ['sample', 'expanded']) {
  test(`Excel export ${custom ? 'custom' : 'standard'} / ${mode} keeps typed snapshots and identifiers`, async () => {
    const book = buildTemplate(custom ? 'custom' : 'standard')
    const data = payload({ custom, mode, units: 16, packages: 4 })
    const result = main(adapter(book), JSON.stringify(data))
    assert.equal(result.equipmentCount, 16)
    assert.equal(result.packageCount, 4)
    assert.equal(result.costCount, 1)
    assert.equal(named(book, 're_usetax').value, 0.03)
    assert.equal(named(book, 're_usetax').numFmt, '0.00%')
    assert.equal(named(book, 'EquipmentNumber1').value, '00000001')
    assert.equal(named(book, 'EquipmentOverflow').value, '2 additional units: see Equipment detail.')
    assert.equal(named(book, 'PackageOverflow').value, '1 additional packages: see Packages detail.')
    assert.equal(named(book, 're_billingplan').value, 'Upon completion')
    assert.equal(named(book, 're_notesforcttteam').value, '\'=HYPERLINK("bad")')
    assert.equal(book.worksheets.length, mode === 'sample' ? 1 : 6)
    assert.equal(book.getWorksheet('VBP Submission').getColumn(1).width, 28)
    const restored = new Excel.Workbook()
    const bytes = Buffer.from(await book.xlsx.writeBuffer())
    await restored.xlsx.load(bytes)
    const values = restored.worksheets.flatMap(sheet => sheet.getSheetValues().flat())
    for (const expected of ['00000016', '000123', 49.66248, 'Catalog', 'Extra cost', 12.34]) {
      assert.ok(values.includes(expected), `Missing frozen value ${expected}`)
    }
    const archive = await unzip.Open.buffer(bytes)
    const workbookXml = (await archive.files.find(file => file.path === 'xl/workbook.xml').buffer()).toString()
    assert.match(workbookXml, /name="_xlnm.Print_Area"[^>]*>[^<]+<\/definedName>/)
    const summary = book.getWorksheet('VBP Submission')
    assert.ok(workbookXml.includes(`$${summary.getCell(summary.rowCount, summary.columnCount).address}`))
    assert.throws(() => main(adapter(book), JSON.stringify(data)), /EXPORT_TEMPLATE_(ALREADY_FILLED|SHAPE_INVALID)/)
  })
}

test('Export rejects corrupt payload or missing destination before touching template', () => {
  for (const corrupt of [
    data => { data.header.cells.find(c => c.key === 're_numberofequipment').number = 3 },
    data => { data.equipment[0].id = 'not-a-guid' },
    data => { data.equipment.push(data.equipment[0]) },
    data => { data.header.cells.find(c => c.key === 're_billingplan').text = null },
    data => { data.packages[0].cells.find(c => c.key === 're_iscustompackage').number = 2 },
    data => { data.header.cells.push(field('re_sellprice', 50)) },
  ]) {
    const book = buildTemplate('standard')
    const data = payload()
    corrupt(data)
    assert.throws(() => main(adapter(book), JSON.stringify(data)), /EXPORT_/)
    assert.equal(named(book, 'SubmissionId').value, '')
    assert.equal(named(book, 're_sellprice').value, '')
  }
  const book = buildTemplate('standard')
  const api = adapter(book)
  const original = api.getNamedItem
  api.getNamedItem = name => name === 'EquipmentNumber14' ? undefined : original(name)
  assert.throws(() => main(api, JSON.stringify(payload())), /EXPORT_ANCHOR_MISSING/)
  assert.equal(named(book, 'SubmissionId').value, '')
  assert.equal(named(book, 're_sellprice').value, '')
})

test('Long combined scopes expand into complete detail without truncation', () => {
  const book = buildTemplate('standard')
  const data = payload({ packages: 2 })
  data.packages.forEach((p, i) => { p.cells.find(c => c.key === 're_proposalscopeen').text = String(i).repeat(20000) })
  main(adapter(book), JSON.stringify(data))
  assert.match(named(book, 'PackageScopes').value, /complete scopes/)
  const values = book.getWorksheet('VBP Submission').getSheetValues().flat()
  assert.ok(values.includes('0'.repeat(20000)))
  assert.ok(values.includes('1'.repeat(20000)))
})

test('Expanded detail supports zero labor and includes empty table headers', () => {
  const book = buildTemplate('standard')
  main(adapter(book), JSON.stringify(payload({ mode: 'expanded' })))
  assert.ok(book.getWorksheet('Labor').getTable('ExportLabor'))
})

test('Custom material and six labor combinations populate the original sections and extend styled rows', async () => {
  const book = buildTemplate('custom')
  const data = payload({ custom: true })
  data.materials = Array.from({ length: 17 }, (_, i) => ({ ...data.materials[0], id: id(200 + i),
    cells: data.materials[0].cells.map(cell => cell.key === 're_partnumber' ? field('re_partnumber', `000${i}`) : { ...cell }),
  }))
  data.labor = Array.from({ length: 17 }, (_, i) => row(500 + i,
    field('re_laborrole', 126110000 + Math.floor((i % 6) / 2), 'Role'),
    field('re_timecategory', 126110000 + i % 2, 'Time'), field('re_hours', i + 1), field('re_totalcost', (i + 1) * 100)))
  const originalSubmissionRow = named(book, 'SubmissionId').row
  main(adapter(book), JSON.stringify(data))
  const sheet = book.getWorksheet('VBP Submission')
  assert.equal(named(book, 'SubmissionId').row, originalSubmissionRow + 3)
  assert.equal(named(book, 'CustomHours').value, 153)
  assert.equal(sheet.getCell('G60').value, '00016')
  assert.equal(sheet.getCell('I60').value, 49.66248)
  assert.equal(sheet.getCell('J60').value, 49.66)
  assert.equal(sheet.getCell('L61').value, 'Estimate scope')
  assert.equal(sheet.getCell('S61').value, 1700)
  for (let i = 0; i < 6; i++) assert.equal(sheet.getCell(45 + i, 13 + i).value, i + 1)
  const restored = new Excel.Workbook()
  await restored.xlsx.load(await book.xlsx.writeBuffer())
  assert.equal(restored.getWorksheet('VBP Submission').getCell('G60').value, '00016')
})
