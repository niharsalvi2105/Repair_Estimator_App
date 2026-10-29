import type { IOperationResult } from '@microsoft/power-apps/data'
import { unwrap, withTimeout } from './dataverseOperation.ts'
import {
  choiceOptionSets, parseDraftChoices, parseOptionSetMetadata, parseStringMapChoices,
  type DraftChoices, type StringMapRow,
} from './draftChoices.ts'

type Transport = {
  stringMaps: (filter: string) => Promise<IOperationResult<unknown>>
  optionSet: (name: string) => Promise<IOperationResult<unknown>>
  draftApi: (input: string) => Promise<IOperationResult<{ ResultJson?: unknown } | undefined>>
}

const message = (reason: unknown) => reason instanceof Error ? reason.message : String(reason)

export function createDraftChoiceLoader(transport: Transport) {
  async function fromStringMaps(required: readonly string[]) {
    const filter = `objecttypecode eq 're_repairestimate' and (${required.map((key) => `attributename eq '${key}'`).join(' or ')})`
    const result = unwrap(await withTimeout(transport.stringMaps(filter))) as { value?: unknown; '@odata.nextLink'?: unknown } | undefined
    if (!Array.isArray(result?.value) || result['@odata.nextLink'])
      throw new Error('Dataverse returned incomplete choice labels.')
    return parseStringMapChoices(result.value as StringMapRow[], required)
  }

  async function fromOptionSets(required: readonly string[]) {
    const names = [...new Set(required.map((key) => {
      const name = choiceOptionSets[key]
      if (!name) throw new Error(`No Dataverse choice is mapped for ${key}.`)
      return name
    }))]
    const sets = new Map(await Promise.all(names.map(async (name) =>
      [name, parseOptionSetMetadata(unwrap(await withTimeout(transport.optionSet(name))))] as const)))
    return Object.fromEntries(required.map((key) => [key, sets.get(choiceOptionSets[key])!])) as DraftChoices
  }

  async function fromDraftApi(required: readonly string[]) {
    const result = unwrap(await withTimeout(transport.draftApi(JSON.stringify({ mode: 'choices' }))))
    if (typeof result?.ResultJson !== 'string')
      throw new Error('The choice service returned an invalid response.')
    return parseDraftChoices(JSON.parse(result.ResultJson), required)
  }

  return async function getDraftChoices(required: readonly string[]): Promise<DraftChoices> {
    if (!required.length || required.some((key) => !/^re_[a-z0-9_]+$/.test(key)))
      throw new Error('Invalid choice field request.')
    const failures: string[] = []
    for (const source of [fromOptionSets, fromStringMaps, fromDraftApi]) {
      try {
        return await source(required)
      } catch (reason) {
        failures.push(message(reason))
      }
    }
    console.error('Dataverse choices could not be loaded.', failures)
    throw new Error('Dataverse choices are temporarily unavailable.')
  }
}
