export function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length ? [parts[0], ...(parts.length > 1 ? [parts[parts.length - 1]] : [])]
    .map((part) => Array.from(part)[0]).join('').toLocaleUpperCase() : '?'
}
