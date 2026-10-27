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

export function submissionErrorMessage(detail: string, language: 'en' | 'fr'): string {
  const messages = [
    ['RE-100|SELL_PRICE_REQUIRED', 'Enter a selling price greater than zero.', 'Saisissez un prix de vente supérieur à zéro.'],
    ['RE-101|MARGIN_COMMENT_REQUIRED', 'Add a margin justification in Pricing & margin before submitting.', 'Ajoutez une justification de marge dans Prix et marge avant de soumettre.'],
    ['RE-102|PRICING_NOT_AVAILABLE', 'Pricing is unavailable. Correct the inputs or configuration before submitting.', 'Le calcul des prix est indisponible. Corrigez les entrées ou la configuration avant de soumettre.'],
    ['RE-103|BILLING_PLAN_REQUIRED', 'Select a billing plan in Pricing & margin before submitting.', 'Sélectionnez un plan de facturation dans Prix et marge avant de soumettre.'],
  ]
  const matched = messages.filter(([code]) => detail.includes(code))
  return matched.length ? `${matched.map((row) => row[language === 'fr' ? 2 : 1]).join(' ')} (${detail})` : detail
}
