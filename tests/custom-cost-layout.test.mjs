import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const customCostLines = readFileSync(new URL('../src/CustomCostLines.tsx', import.meta.url), 'utf8')
const excelUpload = readFileSync(new URL('../src/CustomCostExcelUpload.tsx', import.meta.url), 'utf8')

test('CSTM material breakdown and import precede the labor breakdown and import', () => {
  const materialStart = customCostLines.indexOf('<section className="custom-cost-breakdown" aria-label={fr ? \'Détail des matériaux\' : \'Material Breakdown\'}>')
  const materialImport = customCostLines.indexOf("{importPanel('material')}", materialStart)
  const laborStart = customCostLines.indexOf('<section className="custom-cost-breakdown" aria-label={fr ? \'Détail des heures de main-d’œuvre\' : \'Labor Hours Breakdown\'}>')
  const laborImport = customCostLines.indexOf("{importPanel('labor')}", laborStart)

  assert.ok(materialStart >= 0 && materialStart < materialImport && materialImport < laborStart && laborStart < laborImport)
  assert.match(customCostLines.slice(materialStart, materialImport), /Add material/)
  assert.match(customCostLines.slice(laborStart, laborImport), /Add labor/)
  assert.match(excelUpload, /fr \? 'main-d’œuvre' : 'Labor'/)
  assert.match(excelUpload, /fr \? 'matériaux' : 'Materials'/)
})