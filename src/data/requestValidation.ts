export function statedRateError(value: string | undefined, language: 'en' | 'fr'): string | undefined {
  if (!value?.trim()) return undefined
  if (!Number.isFinite(Number(value)) || Number(value) < 0)
    return language === 'fr'
      ? 'Saisissez un taux horaire valide supérieur ou égal à zéro, ou laissez ce champ vide.'
      : 'Enter a valid hourly rate of zero or more, or leave this field blank.'
  return undefined
}

export function pricingUnavailableMessage(language: 'en' | 'fr'): string {
  return language === 'fr'
    ? 'Le brouillon est enregistré, mais les prix et le CMII ne sont pas disponibles. Si un taux de facturation stipulé est saisi, vérifiez le taux horaire négocié; laissez-le vide s’il ne s’applique pas. Enregistrez de nouveau. Si le problème persiste, demandez à votre administrateur de vérifier les entrées, les règles de marge et la configuration. Ne soumettez pas ce devis sans calcul valide.'
    : 'The draft is saved, but pricing and CMII are unavailable. If a stated labor billing rate is entered, check the negotiated hourly selling rate; leave it blank if it does not apply. Save again. If the problem persists, ask your administrator to check the inputs, margin rules and configuration. Do not submit this estimate without valid pricing.'
}
