import test from 'node:test'
import assert from 'node:assert/strict'
import { reportingYear, formatReportingTime } from '../src/data/reportingTime.ts'
import { parseDashboard } from '../src/data/dashboardContract.ts'

test('Central reporting year changes at Lisle midnight, not UTC midnight', () => {
  assert.equal(reportingYear(new Date('2027-01-01T05:59:59Z')), 2026)
  assert.equal(reportingYear(new Date('2027-01-01T06:00:00Z')), 2027)
  const row = { mode: 'dashboard', ownerId: 'user', market: 126110000, year: 2026,
    generatedAt: '2027-01-01T05:59:59Z', total: 0, marginCount: 0, averageCmii: null,
    statuses: [], jobTypes: [] }
  assert.equal(parseDashboard(row, 126110000, 'user').year, 2026)
  assert.throws(() => parseDashboard({ ...row, generatedAt: '2027-01-01T06:00:00Z' }, 126110000, 'user'))
})

test('Central display follows both daylight-saving transitions and is independent of locale', () => {
  for (const [instant, expected] of [
    ['2026-03-08T07:59:00Z', /1:59 AM CST/],
    ['2026-03-08T08:00:00Z', /3:00 AM CDT/],
    ['2026-11-01T06:59:00Z', /1:59 AM CDT/],
    ['2026-11-01T07:00:00Z', /1:00 AM CST/],
  ]) assert.match(formatReportingTime(instant, 'en-US'), expected)
  assert.match(formatReportingTime('2026-10-26T11:15:58Z', 'fr-CA'), /6 h 15/)
})
