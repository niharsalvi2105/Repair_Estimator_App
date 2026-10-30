import type { DraftLabor, DraftMaterial } from './draftContract'

export function customCostsError(packageIds: string[], labor: DraftLabor[], materials: DraftMaterial[], language: 'en' | 'fr'): string | undefined {
  if (materials.some((line) => (line.pricingSource != null && (
    !['package', 'manual'].includes(line.pricingSource) || line.catalogPartId || line.markupPercent != null ||
    line.unitPrice != null || line.refreshPart ||
    (line.pricingSource === 'package' ? line.partType !== 'kone' || line.unitCost !== 0 : line.partType !== 'non-kone'))) ||
    (line.partType === 'kone' && line.pricingSource !== 'package' && (!line.catalogPartId ||
    line.markupPercent == null || !Number.isFinite(line.markupPercent) || line.markupPercent < 0 ||
    line.markupPercent > 100 || Math.round(line.markupPercent * 100) / 100 !== line.markupPercent)) ||
    (line.partType === 'non-kone' && line.markupPercent != null)))
    return language === 'fr' ? 'Vérifiez la source des prix. Les montants KONE du forfait ne permettent aucun coût par pièce ni majoration supplémentaire. Les pièces KONE du catalogue exigent une majoration de 0 à 100 %.'
      : 'Check the pricing source. Package KONE amounts cannot carry per-part charges or extra markup. Catalog KONE parts require a markup from 0 to 100%.'
  const valid = packageIds.every((id) =>
    labor.some((line) => line.packageId === id) && materials.some((line) => line.packageId === id))
    && labor.every((line) => packageIds.includes(line.packageId ?? '') && Number.isFinite(line.hours) && line.hours > 0)
    && materials.every((line) => packageIds.includes(line.packageId ?? '') && line.description.trim()
      && Number.isFinite(line.quantity) && line.quantity > 0 && Number.isFinite(line.unitCost)
      && (line.pricingSource === 'package' ? line.unitCost === 0 : line.unitCost > 0))
  return valid ? undefined : language === 'fr'
    ? 'Chaque forfait CSTM exige une main-d’œuvre avec des heures positives et un matériau avec description et quantité positive. Le coût unitaire doit être positif, sauf pour les références KONE utilisant les montants du forfait. Affectez chaque ligne à un forfait CSTM.'
    : 'Each CSTM package requires labor with positive hours and material with a description and positive quantity. Unit cost must be positive except for KONE references using package amounts. Assign every custom line to a CSTM package.'
}

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
