function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid generated master schema.')
  return value as Record<string, unknown>
}

export function projectMasterSchema(value: unknown) {
  const schema = record(value)
  const item = record(record(schema.schema).items)
  const fields = Object.entries(record(item.properties))
    .filter(([name, value]) => name.startsWith('re_') && !record(value)['x-ms-dataverse-attribute-of']
      && !record(value)['x-ms-dataverse-primary-id'])
    .map(([name, value]) => {
      const field = record(value)
      const labels = Array.isArray(field.enum) ? field.enum : []
      const values = Array.isArray(field['x-ms-enum-values']) ? field['x-ms-enum-values'] : []
      const navigation = field['x-ms-dataverse-navigation-properties']
      return {
        name, label: String(field.title), kind: String(field['x-ms-dataverse-type']),
        required: field.required === true, readOnly: field['x-ms-read-only'] === true,
        ...(typeof field.maxLength === 'number' ? { maxLength: field.maxLength } : {}),
        options: values.map((value, index) => ({ value: Number(value), label: String(labels[index]) })),
        ...(Array.isArray(navigation) ? { navigation: String(navigation[0]) } : {}),
        create: !field['x-ms-read-only'], update: !field['x-ms-read-only'],
      }
    })
  return {
    summary: {
      logicalName: String(schema.name), entitySet: String(item['x-ms-dataverse-entityset']),
      id: String(item['x-ms-dataverse-primary-id']), primary: String(item['x-ms-dataverse-primary-name']),
      nameFields: fields.filter((field) => /(?:name|jobtype)(?:en|fr)$/.test(field.name) && field.kind === 'StringType')
        .map((field) => field.name),
    },
    fields,
  }
}
