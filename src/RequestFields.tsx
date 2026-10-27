import { useState } from 'react'
import { decimalInputDisplay } from './data/numberDisplay'
import { statedRateError } from './data/requestValidation'
import {
  Re_repairestimatesre_workcenterrequest,
  Re_repairestimatesre_hasbeenapproved,
  Re_repairestimatesre_nationalaccount,
  Re_repairestimatesre_emergency,
  Re_repairestimatesre_customerbudgeted,
  Re_repairestimatesre_papertype,
  Re_repairestimatesre_consultantinvolved,
  Re_repairestimatesre_competingbids,
  Re_repairestimatesre_proposallanguage,
  Re_repairestimatesre_timecategory,
  Re_repairestimatesre_billingplan,
  type Re_repairestimatesBase,
} from './generated/models/Re_repairestimatesModel'

type Field = {
  key: keyof Re_repairestimatesBase
  en: string
  fr: string
  type?: 'number' | 'textarea' | 'email' | 'tel'
  integer?: boolean
  percent?: boolean
  max?: number
  maxLength?: number
  options?: Record<number, string>
}

const requestFields = [
  { key: 're_supervisor', en: 'Supervisor (optional)', fr: 'Superviseur (facultatif)' },
  { key: 're_workcenterrequest', en: 'Work-centre request', fr: 'Centre de travail demandé', options: Re_repairestimatesre_workcenterrequest },
  { key: 're_numberoftechs', en: 'Number of technicians', fr: 'Nombre de techniciens', type: 'number', integer: true, max: 3 },
  { key: 're_hasbeenapproved', en: 'Has it been approved?', fr: 'Déjà approuvé ?', options: Re_repairestimatesre_hasbeenapproved },
  { key: 're_nationalaccount', en: 'National Account', fr: 'Compte national', options: Re_repairestimatesre_nationalaccount },
  { key: 're_emergency', en: 'Emergency / unit shutdown', fr: 'Urgence / équipement à l’arrêt', options: Re_repairestimatesre_emergency },
  { key: 're_subcontractorcost', en: 'Subcontractor cost ($, captured only)', fr: 'Coût de sous-traitance ($, saisie uniquement)', type: 'number' },
  { key: 're_customerbudgeted', en: 'Customer budgeted for repair?', fr: 'Réparation prévue au budget du client ?', options: Re_repairestimatesre_customerbudgeted },
  { key: 're_papertype', en: 'KONE paper / customer paper', fr: 'Contrat KONE / contrat client', options: Re_repairestimatesre_papertype },
  { key: 're_consultantinvolved', en: 'Consultant involved?', fr: 'Consultant impliqué ?', options: Re_repairestimatesre_consultantinvolved },
  { key: 're_competingbids', en: 'Competing bids', fr: 'Offres concurrentes', options: Re_repairestimatesre_competingbids },
  { key: 're_statedlaborrate', en: 'Stated labor billing rate ($/hour)', fr: 'Taux de facturation stipulé ($/heure)', type: 'number' },
  { key: 're_proposallanguage', en: 'Proposal language', fr: 'Langue de la proposition', options: Re_repairestimatesre_proposallanguage },
] as const satisfies readonly Field[]

const costFields = [
  { key: 're_timecategory', en: 'Labor time category', fr: 'Catégorie de temps de travail', options: Re_repairestimatesre_timecategory },
  { key: 're_additionallaborhours', en: 'Additional labor hours', fr: 'Heures de travail supplémentaires', type: 'number' },
  { key: 're_additionalmaterial', en: 'Additional material ($)', fr: 'Matériaux supplémentaires ($)', type: 'number' },
  { key: 're_additionalmiscellaneous', en: 'Additional miscellaneous ($)', fr: 'Frais divers supplémentaires ($)', type: 'number' },
  { key: 're_usetax', en: 'Use tax (%)', fr: 'Taxe d’utilisation (%)', type: 'number', percent: true },
  { key: 're_freight', en: 'Freight (%)', fr: 'Fret (%)', type: 'number', percent: true },
  { key: 're_additionalscope', en: 'Additional scope', fr: 'Portée supplémentaire', type: 'textarea' },
] as const satisfies readonly Field[]

const pricingFields = [
  { key: 're_konesparessalespricevk13', en: 'KONE spares sales price (VK13, custom estimates only)', fr: 'Prix de vente des pièces KONE (VK13, devis personnalisés uniquement)', type: 'number' },
  { key: 're_sellprice', en: 'Sell price ($, entered proposal price)', fr: 'Prix de vente ($, prix proposé saisi)', type: 'number' },
  { key: 're_billingplan', en: 'Billing plan', fr: 'Plan de facturation', options: Re_repairestimatesre_billingplan },
  { key: 're_margincomments', en: 'Comments on booked vs recommended margin', fr: 'Commentaires sur la marge prévue et recommandée', type: 'textarea' },
] as const satisfies readonly Field[]

const partnerFields = [
  { key: 're_prospectaccount', en: 'Prospect account number', fr: 'Numéro de compte prospect', maxLength: 50 },
  { key: 're_soldto', en: 'Sold-to', fr: 'Donneur d’ordre', maxLength: 50 },
  { key: 're_billto', en: 'Bill-to', fr: 'Destinataire de facture', maxLength: 50 },
  { key: 're_payer', en: 'Payer', fr: 'Payeur', maxLength: 50 },
  { key: 're_notesforcttteam', en: 'Notes for CTT team', fr: 'Notes pour l’équipe CTT', type: 'textarea' },
] as const satisfies readonly Field[]

type InputKey = (typeof requestFields | typeof costFields | typeof pricingFields | typeof partnerFields)[number]['key']
export type RequestInputs = Partial<Record<InputKey, string>>

const frenchChoices: Record<string, string> = {
  Yes: 'Oui', No: 'Non', Unknown: 'Inconnu', Route: 'Tournée', Repair: 'Réparation',
  'Customer Paper': 'Contrat client', 'Kone Paper': 'Contrat KONE', NA: 'Sans objet',
  None: 'Aucune', Known: 'Connues', Suspected: 'Soupçonnées',
  English: 'Anglais', French: 'Français', 'Straight Time': 'Heures normales',
  'Double Time': 'Temps double', 'Final 100%': 'Solde 100 %', 'Other: See Notes': 'Autre : voir les notes',
}

export function RequestFields({ stage, language, value, onChange, readOnly = false, custom = false }: {
  stage: 'request' | 'cost' | 'pricing' | 'partner'
  language: 'en' | 'fr'
  value: RequestInputs
  onChange: (key: InputKey, value: string) => void
  readOnly?: boolean
  custom?: boolean
}) {
  const [focusedKey, setFocusedKey] = useState<InputKey>()
  const fields: readonly (Omit<Field, 'key'> & { key: InputKey })[] = {
    request: requestFields, cost: costFields, pricing: pricingFields, partner: partnerFields,
  }[stage]
  return (
    <div className="input-grid">
      {fields.filter((field) => field.key !== 're_konesparessalespricevk13' || custom).map((field) => {
        const id = `request-${field.key}`
        const key = field.key
        const label = language === 'fr' ? field.fr : field.en
        const rateField = key === 're_statedlaborrate'
        const error = rateField ? statedRateError(value[key], language) : undefined
        return (
          <div className="field-label" key={key}>
            <label htmlFor={id}>{label}</label>
            {field.options ? (
              <select id={id} className="text-input" value={value[key] ?? ''} disabled={readOnly} onChange={(event) => onChange(key, event.target.value)}>
                <option value="">{language === 'fr' ? 'Choisir une option' : 'Select an option'}</option>
                {Object.entries(field.options).map(([option, text]) => (
                  <option value={option} key={option}>{language === 'fr' ? frenchChoices[text] ?? text : text}</option>
                ))}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea id={id} className="text-input request-textarea" value={value[key] ?? ''}
                onChange={(event) => onChange(key, event.target.value)} readOnly={readOnly} />
            ) : (
              <input id={id} className="text-input" type={field.type ?? 'text'}
                aria-invalid={error ? true : undefined}
                aria-describedby={rateField ? `${id}-help${error ? ` ${id}-error` : ''}` : undefined}
                min={field.type === 'number' ? field.integer ? 1 : 0 : undefined}
                max={field.percent ? 100 : field.max}
                step={field.type === 'number' ? field.integer ? 1 : 'any' : undefined}
                maxLength={field.maxLength ?? (field.type ? undefined : 100)}
                readOnly={readOnly}
                value={field.type === 'number' && !field.integer && focusedKey !== key
                  ? decimalInputDisplay(value[key] ?? '') : value[key] ?? ''}
                onFocus={() => setFocusedKey(key)} onBlur={() => setFocusedKey(undefined)}
                onChange={(event) => onChange(key, event.target.value)} />
            )}
            {rateField && <p className="field-help" id={`${id}-help`}>{language === 'fr'
              ? 'Facultatif. Taux horaire de vente négocié, et non le prix total du devis. Laissez vide (ou zéro) pour le calcul standard du CMII. Un taux faible peut empêcher le calcul des prix; le serveur valide la marge lors de l’enregistrement.'
              : 'Optional. Negotiated hourly selling rate, not the total estimate price. Leave blank (or zero) for standard CMII pricing. A low rate may prevent pricing; the server validates the margin on save.'}</p>}
            {error && <p id={`${id}-error`} role="alert">{error}</p>}
          </div>
        )
      })}
    </div>
  )
}
