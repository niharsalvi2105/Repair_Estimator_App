import type { ChoiceOption } from './data/draftChoices'

export function ChoiceSelect({ id, language, value, options, onChange, readOnly, error, required }: {
  id: string; language: 'en' | 'fr'; value: string; options?: ChoiceOption[]
  onChange: (value: string) => void; readOnly: boolean
  error?: string; required?: boolean
}) {
  const fr = language === 'fr'
  const known = options?.some((option) => String(option.value) === value)
  const missing = Boolean(value && options && !known)
  return <>
    <select id={id} className="text-input" value={value} disabled={readOnly || !options}
      aria-invalid={!!error} aria-required={required}
      aria-describedby={[missing ? `${id}-missing` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined} onChange={(event) => onChange(event.target.value)}>
      <option value="">{fr ? 'Choisir une option' : 'Select an option'}</option>
      {value && !known && <option value={value} disabled>{fr ? 'Valeur enregistrée' : 'Saved value'} ({value})</option>}
      {options?.map((option) => <option key={option.value} value={option.value}>
        {fr ? option.fr ?? option.en : option.en}
      </option>)}
    </select>
    {missing && <p id={`${id}-missing`} role="alert" className="field-help">{fr
      ? 'La valeur enregistrée ne figure plus dans les choix publiés. Sélectionnez une valeur valide avant d’enregistrer.'
      : 'The saved value is no longer in the published choices. Select a valid value before saving.'}</p>}
  </>
}
