import test from 'node:test'
import assert from 'node:assert/strict'
import { userInitials } from '../src/data/userInitials.ts'

test('initials use the first and last parts of the signed-in name', () => {
  assert.equal(userInitials('  Gawade Ashutosh '), 'GA')
  assert.equal(userInitials('Responsive Test User'), 'RU')
})

test('single names and accented characters remain readable', () => {
  assert.equal(userInitials('Élodie'), 'É')
  assert.equal(userInitials('jean dupont'), 'JD')
})

test('missing names use a neutral marker, not hardcoded brand initials', () => {
  assert.equal(userInitials(''), '?')
  assert.equal(userInitials('   '), '?')
})
