import { useState } from 'react'
import { calculatePartMaterial, type MaterialScope, type PartMarket, type PartMaterialInput } from '../data/partMaterials'
import { previewPartConfiguration as config, previewParts } from './materialPreviewFixtures'
import '../App.css'
import './materialPreview.css'

type PreviewLine = PartMaterialInput & { id: string; scope: MaterialScope }
type Language = 'en' | 'fr'

function text(language: Language, en: string, fr: string) { return language === 'fr' ? fr : en }

const errors: Record<string, [string, string]> = {
  quantity: ['Enter a positive quantity (maximum 100,000).', 'Saisissez une quantité positive (maximum 100 000).'],
  cost: ['Enter a valid positive unit cost.', 'Saisissez un coût unitaire positif valide.'],
  price: ['A valid positive VK13 price is required.', 'Un prix VK13 positif valide est requis.'],
  markup: ['Enter a markup from 0 to 100%.', 'Saisissez une majoration de 0 à 100 %.'],
  selectPart: ['Select a catalog part.', 'Sélectionnez une pièce du catalogue.'],
  manualDetails: ['Enter the part number and description.', 'Saisissez le numéro et la description de la pièce.'],
  koneCatalogRequired: ['KONE parts require a catalog selection.', 'Les pièces KONE doivent provenir du catalogue.'],
  classification: ['Part classification does not match the catalog.', 'Le type de pièce ne correspond pas au catalogue.'],
  source: ['Catalog source information is incomplete.', 'Les informations du catalogue sont incomplètes.'],
  pricingUnit: ['The catalog pricing unit is invalid.', 'L’unité de prix du catalogue est invalide.'],
  configuration: ['Pricing configuration is invalid.', 'La configuration des prix est invalide.'],
  market: ['Select a supported market.', 'Sélectionnez un marché pris en charge.'],
}

function result(line: PreviewLine, market: PartMarket) {
  try { return { value: calculatePartMaterial(line, market, config) } }
  catch (reason) { return { error: reason instanceof Error ? reason.message : String(reason) } }
}

function MaterialPartRow({ line, language, market, update, remove }: {
  line: PreviewLine
  language: Language
  market: PartMarket
  update: (change: Partial<PreviewLine>) => void
  remove: () => void
}) {
  const [search, setSearch] = useState('')
  const t = (en: string, fr: string) => text(language, en, fr)
  const calculated = result(line, market)
  const locale = language === 'fr' ? 'fr-CA' : 'en-US'
  const currency = market === 'MKO' ? 'USD' : 'CAD'
  const amount = (value: number, precise = false) => `${value.toLocaleString(locale,
    { minimumFractionDigits: 2, maximumFractionDigits: precise ? 10 : 2 })} ${currency}`
  const options = previewParts.filter((part) => part.type === line.type
    && `${part.number} ${part.description}`.toLowerCase().includes(search.trim().toLowerCase()))
  const available = line.part && !options.some((part) => part.id === line.part?.id) ? [line.part, ...options] : options
  return <fieldset className="custom-cost-line material-preview-line">
    <legend>{t('Material', 'Matériau')}</legend>
    <div className="input-grid">
      <label className="field-label">{t('Part type', 'Type de pièce')}
        <select className="text-input" value={line.type} onChange={(event) => {
          setSearch('')
          update({ type: event.target.value === 'kone' ? 'kone' : 'non-kone', source: 'catalog', part: undefined,
            manualNumber: '', manualDescription: '', manualUnitCost: '' })
        }}>
          <option value="kone">KONE</option><option value="non-kone">{t('Non-KONE', 'Non-KONE')}</option>
        </select>
      </label>
      {line.type === 'non-kone' && <label className="field-label">{t('Entry source', 'Source de saisie')}
        <select className="text-input" value={line.source} onChange={(event) => update({
          source: event.target.value === 'manual' ? 'manual' : 'catalog', part: undefined,
          manualNumber: '', manualDescription: '', manualUnitCost: '',
        })}>
          <option value="catalog">{t('Catalog', 'Catalogue')}</option>
          <option value="manual">{t('Manual entry', 'Saisie manuelle')}</option>
        </select>
      </label>}
      {line.source === 'catalog' ? <>
        <label className="field-label">{t('Search part number or description', 'Rechercher un numéro ou une description')}
          <input className="text-input" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className="field-label">{t('Catalog part', 'Pièce du catalogue')}
          <select className="text-input" value={line.part?.id ?? ''} onChange={(event) => update({
            part: previewParts.find((part) => part.id === event.target.value && part.type === line.type),
          })}>
            <option value="">{t('Select a part', 'Sélectionner une pièce')}</option>
            {available.map((part) => <option value={part.id} key={part.id}>{part.number} — {part.description}</option>)}
          </select>
        </label>
        {!options.length && <p className="field-help" role="status">{t('No matching catalog parts. Change the search.', 'Aucune pièce trouvée. Modifiez la recherche.')}</p>}
        {line.part && <p className="material-source-details">
          {line.part.description} · {line.part.uom} · {t('Pricing unit', 'Unité de prix')}: {line.part.pricingUnit}
          {' · '}{t('Source', 'Source')}: {line.part.sourceVersion}
        </p>}
      </> : <>
        <label className="field-label">{t('Part number', 'Numéro de pièce')}
          <input className="text-input" maxLength={100} value={line.manualNumber} onChange={(event) => update({ manualNumber: event.target.value })} />
        </label>
        <label className="field-label">{t('Description', 'Description')}
          <input className="text-input" maxLength={2000} value={line.manualDescription} onChange={(event) => update({ manualDescription: event.target.value })} />
        </label>
        <label className="field-label">{t('Unit cost', 'Coût unitaire')} ({currency})
          <input className="text-input" type="number" min="0.000001" step="any" value={line.manualUnitCost}
            onChange={(event) => update({ manualUnitCost: event.target.value })} />
        </label>
        <p className="field-help">{t('Manual cost is already in estimate currency; no USD conversion is applied.',
          'Le coût manuel est déjà dans la devise du devis; aucune conversion USD n’est appliquée.')}</p>
      </>}
      <label className="field-label">{t('Quantity', 'Quantité')}
        <input className="text-input" type="number" min="0.01" max="100000" step="0.01" value={line.quantity}
          onChange={(event) => update({ quantity: event.target.value })} />
      </label>
      {line.type === 'kone' && <label className="field-label">{t('KONE markup (%)', 'Majoration KONE (%)')}
        <input className="text-input" type="number" min="0" max="100" step="0.01" value={line.markupPercent}
          onChange={(event) => update({ markupPercent: event.target.value })} />
      </label>}
    </div>
    {calculated.error && <p role="alert" className="error-box">{errors[calculated.error]
      ? errors[calculated.error][language === 'fr' ? 1 : 0] : calculated.error}</p>}
    {calculated.value && <dl className="package-cost-details material-preview-values">
      <dt>{t('Unit cost (unrounded)', 'Coût unitaire (non arrondi)')}</dt><dd data-value="unit-cost">{amount(calculated.value.unitCost, true)}</dd>
      {calculated.value.unitPrice !== undefined && <>
        <dt>{t('Catalog unit selling price', 'Prix de vente unitaire du catalogue')}</dt><dd>{amount(calculated.value.unitPrice, true)}</dd>
      </>}
      <dt>{t('Material cost before tax/freight', 'Coût des matériaux avant taxe/fret')}</dt><dd data-value="base-cost">{amount(calculated.value.materialCost)}</dd>
      <dt>{t('Cost including 5% tax + 14% freight', 'Coût avec taxe de 5 % + fret de 14 %')}</dt><dd data-value="total-cost">{amount(calculated.value.totalCost)}</dd>
      {calculated.value.markupAmount !== undefined && <>
        <dt>{t('Markup on VK13 (not cost)', 'Majoration du VK13 (pas du coût)')}</dt><dd data-value="markup">{amount(calculated.value.markupAmount)}</dd>
        <dt>{t('KONE selling contribution', 'Contribution au prix de vente KONE')}</dt><dd data-value="selling">{amount(calculated.value.sellingContribution ?? 0)}</dd>
      </>}
    </dl>}
    {line.type === 'kone' && <p className="field-help">{t(
      'VK13 × quantity × (1 + 5% KONE tax + 10% KONE freight + selected markup). Markup does not increase internal cost. This is not a complete estimate selling price.',
      'VK13 × quantité × (1 + taxe KONE de 5 % + fret KONE de 10 % + majoration choisie). La majoration ne modifie pas le coût interne. Ceci n’est pas le prix de vente total du devis.')}</p>}
    <button className="button tertiary" type="button" onClick={remove}>{t('Remove material', 'Supprimer le matériau')}</button>
  </fieldset>
}

export default function MaterialCatalogPreview() {
  const [language, setLanguage] = useState<Language>('en')
  const [market, setMarket] = useState<PartMarket>('MKO')
  const [lines, setLines] = useState<PreviewLine[]>([])
  const [manualAddition, setManualAddition] = useState('')
  const t = (en: string, fr: string) => text(language, en, fr)
  const currency = market === 'MKO' ? 'USD' : 'CAD'
  const money = (value: number) => `${value.toLocaleString(language === 'fr' ? 'fr-CA' : 'en-US',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
  function add(scope: MaterialScope) {
    setLines((current) => [...current, {
      id: crypto.randomUUID(), scope, type: 'kone', source: 'catalog', manualNumber: '', manualDescription: '',
      manualUnitCost: '', quantity: '1', markupPercent: String(config.defaultMarkupPercent),
    }])
  }
  function changeMarket(next: PartMarket) {
    setMarket(next)
    setManualAddition('')
    setLines((current) => current.map((line) => line.source === 'manual' ? { ...line, manualUnitCost: '' } : line))
  }
  const results = lines.map((line) => ({ line, result: result(line, market) }))
  const manualValue = manualAddition.trim() ? Number(manualAddition) : 0
  const invalidManual = !Number.isFinite(manualValue) || manualValue < 0 || manualValue > 1000000000
  const incomplete = results.some((item) => !item.result.value) || invalidManual
  const packageCost = results.filter((item) => item.line.scope === 'package')
    .reduce((sum, item) => sum + (item.result.value?.totalCost ?? 0), 0)
  const additionalCost = results.filter((item) => item.line.scope === 'additional')
    .reduce((sum, item) => sum + (item.result.value?.totalCost ?? 0), 0)
  const selling = results.reduce((sum, item) => sum + (item.result.value?.sellingContribution ?? 0), 0)
  return <main className="material-catalog-preview">
    <header>
      <h1>{t('Spare-parts material preview', 'Aperçu des pièces et matériaux')}</h1>
      <p className="warning-box" role="status">{t(
        'Development preview — synthetic catalog only. Nothing is saved, imported or sent to Dataverse. Refreshing discards this preview. Production integration is blocked.',
        'Aperçu de développement — catalogue fictif uniquement. Rien n’est enregistré, importé ou envoyé à Dataverse. Actualiser efface cet aperçu. L’intégration en production est bloquée.')}</p>
      <a href="/">{t('Back to application', 'Retour à l’application')}</a>
    </header>
    <section className="form-card input-grid">
      <label className="field-label">{t('Interface language', 'Langue de l’interface')}
        <select className="text-input" value={language} onChange={(event) => setLanguage(event.target.value === 'fr' ? 'fr' : 'en')}>
          <option value="en">English</option><option value="fr">Français</option>
        </select>
      </label>
      <label className="field-label">{t('Market', 'Marché')}
        <select className="text-input" value={market} onChange={(event) => {
          const value = event.target.value
          if (value === 'MKO' || value === 'CKE' || value === 'CKQ') changeMarket(value)
        }}>
          <option>MKO</option><option>CKE</option><option>CKQ</option>
        </select>
      </label>
      <p className="material-source-details">{t('Configuration', 'Configuration')}: {config.version}<br />
        {market === 'MKO' ? t('USD cost and price unchanged.', 'Coût et prix USD inchangés.')
          : t('CAD price = USD × 1.4; CAD cost = USD × 1.23 × 1.4. The 1.23 factor is cost-only, not labeled as tax.',
            'Prix CAD = USD × 1,4; coût CAD = USD × 1,23 × 1,4. Le facteur 1,23 s’applique uniquement au coût, sans être désigné comme taxe.')}
      </p>
    </section>
    {(['package', 'additional'] as const).map((scope) => <section className="form-card" key={scope} data-scope={scope}>
      <h2>{scope === 'package' ? t('CSTM package materials', 'Matériaux du forfait CSTM') : t('Additional materials', 'Matériaux supplémentaires')}</h2>
      <p>{scope === 'package' ? t('Assigned to demo CSTM package only; no equipment multiplier.', 'Attribués au forfait CSTM fictif; sans multiplicateur d’équipements.')
        : t('Requires CSTM. Counted once outside package materials.', 'Nécessite CSTM. Comptés une seule fois hors des matériaux du forfait.')}</p>
      {lines.filter((line) => line.scope === scope).map((line) => <MaterialPartRow key={line.id} line={line}
        language={language} market={market}
        update={(change) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, ...change } : item))}
        remove={() => setLines((current) => current.filter((item) => item.id !== line.id))} />)}
      <button className="button secondary" type="button" onClick={() => add(scope)}>{t('Add material', 'Ajouter un matériau')}</button>
    </section>)}
    <section className="form-card">
      <h2>{t('Material totals preview', 'Aperçu des totaux des matériaux')}</h2>
      <label className="field-label">{t('Separate manual additional amount', 'Montant supplémentaire manuel distinct')} ({currency})
        <input className="text-input" type="number" min="0" max="1000000000" step="any" value={manualAddition}
          onChange={(event) => setManualAddition(event.target.value)} />
      </label>
      <p className="field-help">{t('Separate from itemized rows; never enter the same part in both. Manual amounts clear on market change.',
        'Distinct des lignes détaillées; ne saisissez jamais la même pièce aux deux endroits. Les montants manuels s’effacent lors du changement de marché.')}</p>
      {incomplete ? <p className="error-box" role="alert">{t('Complete all material rows and correct invalid amounts before reviewing totals.',
        'Complétez toutes les lignes et corrigez les montants invalides avant de consulter les totaux.')}</p>
        : <dl className="package-cost-details">
          <dt>{t('CSTM material cost', 'Coût des matériaux CSTM')}</dt><dd data-total="package">{money(packageCost)}</dd>
          <dt>{t('Itemized additional cost', 'Coût supplémentaire détaillé')}</dt><dd data-total="additional">{money(additionalCost)}</dd>
          <dt>{t('Separate manual cost including tax/freight', 'Coût manuel distinct avec taxe/fret')}</dt><dd>{money(manualValue * 1.19)}</dd>
          <dt>{t('Combined material cost', 'Coût combiné des matériaux')}</dt><dd data-total="combined">{money(packageCost + additionalCost + manualValue * 1.19)}</dd>
          <dt>{t('KONE selling contribution (separate from cost)', 'Contribution KONE au prix de vente (distincte du coût)')}</dt><dd data-total="selling">{money(selling)}</dd>
        </dl>}
    </section>
  </main>
}
