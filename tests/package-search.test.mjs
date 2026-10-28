import test from 'node:test'
import assert from 'node:assert/strict'
import { filterPackages, localizeScope } from '../src/data/packageSearch.ts'

const packages = [
  { re_packagenumber: 'PSR-100', re_packagenameen: 'Door operator', re_packagenamefr: 'Opérateur de porte', re_proposalscopeen: 'Replace the door motor', re_proposalscopefr: 'Remplacer le moteur' },
  { re_packagenumber: 'PSR-200', re_packagenameen: 'Controller', re_proposalscopeen: 'Upgrade drive and board' },
]

test('empty query returns every package', () => {
  assert.equal(filterPackages(packages, '  ').length, 2)
})

test('matches package number, name and scope anywhere in the text', () => {
  assert.deepEqual(filterPackages(packages, 'psr-2').map((p) => p.re_packagenumber), ['PSR-200'])
  assert.deepEqual(filterPackages(packages, 'operator').map((p) => p.re_packagenumber), ['PSR-100'])
  assert.deepEqual(filterPackages(packages, 'drive').map((p) => p.re_packagenumber), ['PSR-200'])
  assert.deepEqual(filterPackages(packages, 'moteur').map((p) => p.re_packagenumber), ['PSR-100'])
})

test('all terms must match', () => {
  assert.equal(filterPackages(packages, 'door board').length, 0)
  assert.equal(filterPackages(packages, 'door motor').length, 1)
})

test('scope falls back to English when French is missing', () => {
  assert.equal(localizeScope(packages[1], 'fr'), 'Upgrade drive and board')
  assert.equal(localizeScope(packages[0], 'fr'), 'Remplacer le moteur')
})
