export type ChoiceOption = { value: number; en: string; fr?: string }
export type DraftChoices = Record<string, ChoiceOption[]>

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid Dataverse choice metadata.')
  return value as Record<string, unknown>
}

function options(value: unknown): ChoiceOption[] {
  if (!Array.isArray(value) || !value.length) throw new Error('Invalid Dataverse choice metadata.')
  const seen = new Set<number>()
  return value.map((entry: unknown) => {
    const option = object(entry)
    if (typeof option.value !== 'number' || !Number.isInteger(option.value) ||
      option.value < 0 || option.value > 2147483647 || seen.has(option.value) ||
      typeof option.en !== 'string' || !option.en.trim() ||
      (option.fr != null && typeof option.fr !== 'string'))
      throw new Error('Invalid Dataverse choice metadata.')
    seen.add(option.value)
    return { value: option.value, en: option.en, fr: typeof option.fr === 'string' && option.fr.trim() ? option.fr : undefined }
  })
}

export function parseDraftChoices(value: unknown, required: readonly string[]): DraftChoices {
  const record = object(value)
  if (record.mode !== 'choices' || !Array.isArray(record.fields))
    throw new Error('Dataverse choices were not returned by the draft service.')
  const result: DraftChoices = {}
  for (const entry of record.fields) {
    const field = object(entry)
    if (typeof field.key !== 'string' || !field.key || field.key in result)
      throw new Error('Invalid Dataverse choice metadata.')
    result[field.key] = options(field.options)
  }
  const missing = required.filter((key) => !result[key])
  if (missing.length) throw new Error(`Dataverse choices are missing for ${missing.join(', ')}.`)
  return result
}

export type StringMapRow = {
  attributename?: string; attributevalue?: number; value?: string; langid?: number; displayorder?: number
}

// Dataverse stores one stringmap row per published choice option and provisioned language.
export function parseStringMapChoices(rows: readonly StringMapRow[], required: readonly string[]): DraftChoices {
  const fields = new Map<string, Map<number, { order: number; labels: Map<number, string> }>>()
  for (const row of rows) {
    const { attributename: key, attributevalue: value, value: label, langid } = row
    if (typeof key !== 'string' || !required.includes(key) || typeof value !== 'number' || !Number.isInteger(value) ||
      value < 0 || value > 2147483647 || typeof label !== 'string' || !label.trim() || typeof langid !== 'number')
      throw new Error('Invalid Dataverse choice metadata.')
    const options = fields.get(key) ?? new Map()
    fields.set(key, options)
    const option = options.get(value) ?? { order: row.displayorder ?? Number.MAX_SAFE_INTEGER, labels: new Map() }
    options.set(value, option)
    option.labels.set(langid, label)
  }
  const result: DraftChoices = {}
  for (const [key, options] of fields)
    result[key] = [...options].sort(([a, x], [b, y]) => x.order - y.order || a - b).map(([value, { labels }]) => ({
      value, en: labels.get(1033) ?? [...labels.values()][0], fr: labels.get(1036),
    }))
  const missing = required.filter((key) => !result[key])
  if (missing.length) throw new Error(`Dataverse choices are missing for ${missing.join(', ')}.`)
  return result
}

// Global choice behind each repair estimate choice column (matches backend DraftPlugin.ChoiceFields).
export const choiceOptionSets: Readonly<Record<string, string>> = {
  re_workcenterrequest: 're_workcenterrequestchoice',
  re_hasbeenapproved: 're_yesnounknowchoice',
  re_nationalaccount: 're_yesnounknowchoice',
  re_emergency: 're_yesno',
  re_customerbudgeted: 're_yesno',
  re_papertype: 're_papertype',
  re_consultantinvolved: 're_yesno',
  re_competingbids: 're_competingbidstatus',
  re_proposallanguage: 're_proposallanguagechoice',
  re_timecategory: 're_timecateogry',
  re_billingplan: 're_billingplan',
}

type LocalizedLabel = { Label?: unknown; LanguageCode?: unknown }

export function parseOptionSetMetadata(value: unknown): ChoiceOption[] {
  const options = (value as { Options?: unknown } | null)?.Options
  if (!Array.isArray(options) || !options.length) throw new Error('Invalid Dataverse choice metadata.')
  const seen = new Set<number>()
  return options.map((option) => {
    const { Value, Label } = option as { Value?: unknown; Label?: { LocalizedLabels?: LocalizedLabel[]; UserLocalizedLabel?: LocalizedLabel } }
    const labels = Array.isArray(Label?.LocalizedLabels) ? Label.LocalizedLabels : []
    const text = (code: number) => {
      const label = labels.find((entry) => entry?.LanguageCode === code)?.Label
      return typeof label === 'string' && label.trim() ? label : undefined
    }
    const fallback = Label?.UserLocalizedLabel?.Label
    const en = text(1033) ?? (typeof fallback === 'string' && fallback.trim() ? fallback : undefined)
    if (typeof Value !== 'number' || !Number.isInteger(Value) || Value < 0 || Value > 2147483647 || seen.has(Value) || !en)
      throw new Error('Invalid Dataverse choice metadata.')
    seen.add(Value)
    return { value: Value, en, fr: text(1036) }
  })
}
