import test from 'node:test'
import assert from 'node:assert/strict'
import { LABOR_COLUMNS, editLaborGridHours, laborGridCost, laborGridRows } from '../src/data/laborGrid.ts'

const line = (id, slot, hours, change = {}) => ({ id, packageId: 'p', equipmentNumber: '0001',
  ...LABOR_COLUMNS[slot], hours, ...change })

test('six role/time snapshots become one equipment row without changing their identities or saved rates', () => {
  const lines = LABOR_COLUMNS.map((_, slot) => line(String(slot), slot, slot + 1, { rate: slot + 100 }))
  const original = structuredClone(lines)
  const rows = laborGridRows(lines)
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].lines, original)
  assert.deepEqual(lines, original)
  assert.equal(laborGridCost(rows[0].lines, []), 2170)
})

test('duplicate role/time snapshots remain separate rows and retain their distinct rates', () => {
  const rows = laborGridRows([line('a', 0, 2, { rate: 10 }), line('b', 0, 3, { rate: 20 }),
    line('c', 1, 4), line('d', 1, 5)])
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map(row => row.lines.map(line => line.id)), [['a', 'c'], ['b', 'd']])
  assert.notEqual(rows[0].key, rows[1].key)
})

test('grouping never mixes packages, exact equipment identifiers or unassigned scope', () => {
  const rows = laborGridRows([line('a', 0, 1), line('b', 1, 1, { equipmentNumber: '1' }),
    line('c', 2, 1, { packageId: 'other' }), line('d', 3, 1, { equipmentNumber: '' }),
    line('e', 4, 1, { equipmentNumber: null })])
  assert.equal(rows.length, 4)
  assert.deepEqual(rows[3].lines.map(line => line.id), ['d', 'e'])
})

test('editing existing cells preserves trusted saved rates and editing empty cells creates only the target role/time', () => {
  let lines = [line('a', 0, 2, { rate: 17 }), line('other', 0, 9, { packageId: 'other' })]
  const key = laborGridRows(lines)[0].key
  lines = editLaborGridHours(lines, laborGridRows(lines)[0], 0, 3.25)
  assert.deepEqual(lines[0], line('a', 0, 3.25, { rate: 17 }))
  lines = editLaborGridHours(lines, laborGridRows(lines)[0], 5, 1.5)
  assert.equal(lines.length, 3)
  assert.deepEqual({ ...lines[1], id: 'new' }, line('new', 5, 1.5))
  assert.equal(lines[2].id, 'other')
  assert.equal(laborGridRows(lines)[0].key, key)
})

test('clearing a cell removes its snapshot, but an empty matrix row stays visibly incomplete', () => {
  let lines = [line('a', 0, 2), line('b', 5, 1)]
  lines = editLaborGridHours(lines, laborGridRows(lines)[0], 0, 0)
  assert.deepEqual(lines, [line('b', 5, 1)])
  lines = editLaborGridHours(lines, laborGridRows(lines)[0], 5, 0)
  assert.equal(lines.length, 1)
  assert.equal(lines[0].hours, 0)
  lines = editLaborGridHours(lines, laborGridRows(lines)[0], 3, 2.5)
  assert.equal(lines.length, 1)
  assert.equal(lines[0].role, 126110001)
  assert.equal(lines[0].time, 126110001)
  assert.equal(lines[0].hours, 2.5)
})

test('totals use saved rates before unique branch rates and never substitute missing rates with zero', () => {
  const rates = [{ ...LABOR_COLUMNS[0], rate: 10 }, { ...LABOR_COLUMNS[5], rate: 20 }]
  assert.equal(laborGridCost([line('a', 0, 2), line('b', 5, 3)], rates), 80)
  assert.equal(laborGridCost([line('a', 0, 2, { rate: 15 })], rates), 30)
  assert.equal(laborGridCost([line('a', 0, 2)], []), undefined)
  assert.equal(laborGridCost([line('a', 0, 2)], [...rates, rates[0]]), undefined)
  assert.equal(laborGridCost([line('a', 0, 0)], []), 0)
  assert.equal(laborGridCost([line('a', 0, -1)], rates), undefined)
  assert.equal(laborGridCost([line('a', 0, 0.1, { rate: 2.35 }), line('b', 1, 0.1, { rate: 2.35 })], []), 0.48)
})
