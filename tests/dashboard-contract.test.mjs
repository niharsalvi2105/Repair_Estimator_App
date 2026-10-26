import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDashboard } from '../src/data/dashboardContract.ts'

const fixture = () => ({
  mode: 'dashboard', ownerId: 'user', market: 126110000, year: 2026,
  generatedAt: '2026-10-26T11:15:58Z', total: 3, marginCount: 2, averageCmii: -0.25,
  statuses: [{ status: 126110000, count: 2 }, { status: 126110002, count: 1 }],
  jobTypes: [{ id: null, en: null, fr: null, count: 3 }],
})
test('dashboard accepts negative averages, real zero counts and empty results', () => {
  assert.equal(parseDashboard(fixture(), 126110000, 'USER').averageCmii, -0.25)
  assert.equal(parseDashboard({ ...fixture(), total: 0, marginCount: 0, averageCmii: null,
    statuses: [], jobTypes: [] }, 126110000, 'user').total, 0)
})
test('dashboard rejects mixed scopes, misleading averages and inconsistent aggregates', () => {
  for (const changes of [
    { ownerId: 'other' }, { market: 126110001 }, { year: 2025 }, { generatedAt: 'invalid' },
    { total: 4 }, { marginCount: 4 }, { marginCount: 0 }, { averageCmii: NaN },
    { statuses: [{ status: 7, count: 3 }] },
    { statuses: [{ status: 126110000, count: 1 }, { status: 126110000, count: 2 }] },
    { jobTypes: [{ id: 'id', en: '', fr: 'French', count: 3 }] },
  ]) assert.throws(() => parseDashboard({ ...fixture(), ...changes }, 126110000, 'user'))
})
