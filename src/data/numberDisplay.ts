export function decimalInputDisplay(value: string): string {
  if (!value.trim()) return value
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : value
}
