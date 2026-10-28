import type { RepairPackage } from './repairEstimatorRepository'

type Language = 'en' | 'fr'
type PackageName = Pick<RepairPackage, 're_packagenameen' | 're_packagenamefr'>
type PackageScope = Pick<RepairPackage, 're_proposalscopeen' | 're_proposalscopefr'>
type Searchable = PackageName & PackageScope & Pick<RepairPackage, 're_packagenumber'>

export function localizePackage(repairPackage: PackageName, language: Language): string {
  if (language === 'fr' && repairPackage.re_packagenamefr) return repairPackage.re_packagenamefr
  return repairPackage.re_packagenameen
}

export function localizeScope(repairPackage: PackageScope, language: Language): string {
  const scope = language === 'fr' && repairPackage.re_proposalscopefr
    ? repairPackage.re_proposalscopefr
    : repairPackage.re_proposalscopeen
  return scope?.trim() ?? ''
}

// Every whitespace-separated term must appear in the number, either-language name or either-language scope.
export function filterPackages<T extends Searchable>(packages: T[], query: string): T[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return packages
  return packages.filter((repairPackage) => {
    const text = [
      repairPackage.re_packagenumber, repairPackage.re_packagenameen, repairPackage.re_packagenamefr,
      repairPackage.re_proposalscopeen, repairPackage.re_proposalscopefr,
    ].filter(Boolean).join('\n').toLocaleLowerCase()
    return terms.every((term) => text.includes(term))
  })
}
