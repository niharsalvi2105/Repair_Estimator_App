export const reportingTimeZone = 'America/Chicago'

export function reportingYear(date: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: reportingTimeZone, year: 'numeric',
  }).format(date))
}

export function formatReportingTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: reportingTimeZone, year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(value))
}
