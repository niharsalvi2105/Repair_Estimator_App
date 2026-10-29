import { getClient, type IOperationResult } from '@microsoft/power-apps/data'
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo'

const client = getClient(dataSourcesInfo)

// Read-only Web API GETs declared in dataSourcesInfo (re_choicemetadata); no table registration needed.
const get = (operationName: string, body: Record<string, string>) => client.executeAsync<Record<string, string>, unknown>({
  dataverseRequest: { action: 'customapi', parameters: { operationName, tableName: 're_choicemetadata', body } },
}) as Promise<IOperationResult<unknown>>

export const getStringMaps = (filter: string) => get('StringMaps', { filter })
export const getGlobalOptionSet = (name: string) => get('GlobalOptionSet', { name })
