import test from 'node:test'
import assert from 'node:assert/strict'
import { parseEquipmentList, isEquipmentList, planEquipmentAdd } from '../src/data/equipmentPaste.ts'

test('splits on comma, semicolon, space and new line, trimming blanks and duplicates', () => {
  const expected = ['20000711', '20000712', '20000713']
  assert.deepEqual(parseEquipmentList('20000711,20000712,20000713'), expected)
  assert.deepEqual(parseEquipmentList('20000711;20000712;20000713'), expected)
  assert.deepEqual(parseEquipmentList('20000711 20000712 20000713'), expected)
  assert.deepEqual(parseEquipmentList('20000711\r\n20000712\n20000713\n'), expected)
  assert.deepEqual(parseEquipmentList(' 20000711 ,, ;20000712;\t20000711 , 20000713 '), expected)
  assert.deepEqual(parseEquipmentList(' ; , \n'), [])
})

test('only multi-value input is treated as a list', () => {
  assert.equal(isEquipmentList('20000711'), false)
  assert.equal(isEquipmentList(' 20000711 '), false)
  assert.equal(isEquipmentList('20000711,20000712'), true)
  assert.equal(isEquipmentList('20000711 20000712'), true)
  assert.equal(isEquipmentList('Main lobby'), false)
  assert.equal(isEquipmentList('Elevator 3'), false)
  assert.equal(isEquipmentList('Main lobby;Elevator 3'), true)
})

test('plans matches in pasted order and reports missing, duplicate and over-limit numbers', () => {
  const eq = (n) => ({ re_equipment: n })
  const plan = planEquipmentAdd(['A1'], ['a1', 'B2', 'C3', 'D4', 'E5'], [eq('B2'), eq('A1'), eq('D4'), eq('E5')], 3)
  assert.deepEqual(plan.add.map((e) => e.re_equipment), ['B2', 'D4'])
  assert.deepEqual(plan.alreadySelected, ['a1'])
  assert.deepEqual(plan.notFound, ['C3'])
  assert.deepEqual(plan.overLimit, ['E5'])
})
