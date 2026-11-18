import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const quote = value => `'${String(value).replaceAll("'", "''")}'`
const call = (name, ...args) => `${name}(${args.join(',')})`
const field = (source, key) => `${source}?[${quote(key)}]`
const val = key => field("body('Get_estimate')", key)
const row = key => field('item()', key)
const eq = (a, b) => call('equals', a, b)
const choose = (condition, yes, no) => call('if', condition, yes, no)
const fallback = (...args) => call('coalesce', ...args)
const zero = value => fallback(value, '0')
const mul = (a, b) => call('mul', a, b)
const add = (...args) => args.reduce((a, b) => call('add', a, b))
const fr = "outputs('Is_French')"
const local = (en, french) => choose(fr, quote(french), quote(en))
const missing = local('Not provided', 'Non fourni')
const unavailable = local('Unavailable', 'Indisponible')
const notApplicable = local('Not applicable', 'Sans objet')
const locale = choose(fr, "'fr-CA'", "'en-US'")
const display = (value, format = '0.00') => choose(eq(value, 'null'), unavailable,
  call('formatNumber', value, quote(format), locale))
const percent = value => choose(eq(value, 'null'), unavailable,
  call('concat', display(mul(value, '100')), "'%'"))
const rawPercent = value => choose(eq(value, 'null'), notApplicable,
  call('concat', display(value), "'%'"))
const text = value => choose(call('empty', value), missing, value)
export const escapeExpression = value => [
  ['&', '&amp;'], ['<', '&lt;'], ['>', '&gt;'], ['"', '&quot;'], ["'", '&#39;'], ['{', '&#123;'],
].reduce((result, [from, to]) => call('replace', result, quote(from), quote(to)), call('string', value))
const htmlText = value => call('replace', call('replace', escapeExpression(value),
  "decodeUriComponent('%0D')", "''"), "decodeUriComponent('%0A')", "'<br>'")

export function compileHtml(html, lookup) {
  const args = []
  let end = 0
  for (const match of html.matchAll(/\{\{(\w+)\}\}/g)) {
    if (match.index > end) args.push(quote(html.slice(end, match.index)))
    args.push(lookup(match[1]))
    end = match.index + match[0].length
  }
  if (end < html.length) args.push(quote(html.slice(end)))
  return args.length === 1 ? (/\{\{\w+\}\}/.test(html) ? `@${args[0]}` : html)
    : `@${call('concat', ...args)}`
}

export function toSolutionClientData(generated, original) {
  if (!original?.properties?.definition || !original.schemaVersion)
    throw new Error('An existing solution workflow clientdata snapshot is required.')
  const aliases = new Map()
  const references = {}
  for (const [name, reference] of Object.entries(generated.connectionReferences)) {
    const existing = Object.entries(original.properties.connectionReferences ?? {}).find(([, value]) =>
      value.connection?.connectionReferenceLogicalName === reference.connectionReferenceLogicalName)
    const alias = existing?.[0] ?? reference.id.split('/').at(-1)
    if (references[alias]) throw new Error(`Ambiguous connector alias: ${alias}`)
    aliases.set(name, alias)
    references[alias] = { runtimeSource: 'embedded',
      connection: { connectionReferenceLogicalName: reference.connectionReferenceLogicalName },
      api: { name: reference.id.split('/').at(-1) } }
  }
  const definition = structuredClone(generated.definition)
  const normalize = value => {
    if (!value || typeof value !== 'object') return
    if (value.host?.connectionReferenceName) {
      const alias = aliases.get(value.host.connectionReferenceName)
      if (!alias) throw new Error(`Unbound solution connector: ${value.host.connectionReferenceName}`)
      value.host.connectionName = alias
      delete value.host.connectionReferenceName
    }
    Object.values(value).forEach(normalize)
  }
  normalize(definition)
  return {
    ...original,
    properties: {
      ...original.properties,
      definition,
      connectionReferences: references,
    },
  }
}

export function buildEstimateEmailFlow({ recipient, metadata, connectionReferences }) {
  if (!/^[^\s@<>;]+@[^\s@<>;]+\.[^\s@<>;]+$/.test(recipient ?? ''))
    throw new Error('Provide exactly one internal test recipient.')
  if (!metadata?.choices) throw new Error('Live choice metadata is required.')
  const bindings = Object.fromEntries(Object.values(connectionReferences ?? {}).map(reference => {
    if (!reference.connectionReferenceLogicalName || reference.source !== 'Embedded')
      throw new Error('Every connector requires an Embedded solution connection reference.')
    return [reference.connectionReferenceLogicalName, reference]
  }))
  const bindingName = connector => {
    const reference = Object.values(bindings).find(reference => reference.id?.endsWith(`/${connector}`))
    if (!reference) throw new Error(`Missing verified solution connection reference: ${connector}`)
    return reference.connectionReferenceLogicalName
  }
  const actions = {}
  const after = name => name ? { [name]: ['Succeeded'] } : {}
  const compose = (target, name, inputs, previous) => {
    target[name] = { type: 'Compose', inputs, runAfter: after(previous) }
    return name
  }
  const connector = (operationId, parameters, previous, connectorName = 'shared_commondataserviceforapps') => ({
    type: 'OpenApiConnection',
    inputs: { host: { apiId: `/providers/Microsoft.PowerApps/apis/${connectorName}`,
      connectionReferenceName: bindingName(connectorName), operationId }, parameters },
    runAfter: after(previous),
  })
  const label = (source, table, column) => {
    const options = metadata.choices[`${table}.${column}`]
    if (!options?.length) throw new Error(`Missing verified choice metadata: ${table}.${column}`)
    return options.reduceRight((result, option) => choose(eq(field(source, column), String(option.value)),
      local(option.en, option.fr), result), unavailable)
  }
  const headerChoice = column => label("body('Get_estimate')", 're_repairestimate', column)
  actions.Get_estimate = connector('GetItem', {
    entityName: 're_repairestimates',
    recordId: "@triggerBody()?['re_repairestimateid']",
    '$expand': 'transactioncurrencyid($select=isocurrencycode),re_customeraccount($select=accountnumber,name),re_Salesperson($select=fullname,internalemailaddress),re_Branch($select=re_branchname),re_BuildingProvinceState($select=re_nameen,re_namefr),re_EquipmentType($select=re_nameen,re_namefr),re_JobType($select=re_jobtypeen,re_jobtypefr)',
  })
  compose(actions, 'Is_French', `@${eq(val('re_proposallanguage'), '126110001')}`, 'Get_estimate')
  let previous = 'Is_French'
  for (const [name, entity, order, expand] of [
    ['equipment', 're_estimateequipments', 're_sequence asc,re_estimateequipmentid asc', undefined],
    ['packages', 're_estimatepackages', 're_sequence asc,re_estimatepackageid asc', undefined],
    ['labor', 're_estimatelaborlines', 're_estimatelaborlineid asc',
      're_EstimateEquipment($select=re_equipmentnumber),re_EstimatePackage($select=re_packagenumber)'],
    ['materials', 're_estimatemateriallines', 're_estimatemateriallineid asc',
      're_estimateequipment($select=re_equipmentnumber),re_EstimatePackage($select=re_packagenumber)'],
  ]) {
    const parameters = { entityName: entity,
      '$filter': "_re_repairestimate_value eq @{triggerBody()?['re_repairestimateid']}",
      '$orderby': order, ...(expand ? { '$expand': expand } : {}) }
    actions[`List_${name}`] = { ...connector('ListRecords', parameters, previous),
      runtimeConfiguration: { paginationPolicy: { minimumItemCount: 10000 } } }
    previous = `List_${name}`
  }
  for (const [source, condition] of [
    ['equipment', call('empty', row('re_equipmentnumber'))],
    ['packages', call('or', call('empty', row('re_packagenumber')), call('empty', row('re_estimatepackageid')),
      ...['re_quantity', 're_totalhours', 're_totalmaterial'].map(key => eq(row(key), 'null')))],
    ['labor', call('or', call('empty', row('_re_estimatepackage_value')),
      ...['re_hours', 're_hourlycost', 're_totalcost'].map(key => eq(row(key), 'null')))],
    ['materials', call('or', call('empty', row('_re_estimatepackage_value')),
      call('empty', row('re_entereddescription')),
      eq(fallback(row('re_unitcostprecise'), row('re_unitcost')), 'null'),
      ...['re_quantity', 're_extendedcost', 're_totalcost'].map(key => eq(row(key), 'null')))],
  ]) {
    actions[`Invalid_${source}`] = { type: 'Query', inputs: { from: `@body('List_${source}')?['value']`,
      where: `@${condition}` }, runAfter: after(previous) }
    previous = `Invalid_${source}`
  }
  const invalid = call('or', ...['equipment', 'packages', 'labor', 'materials'].map(name =>
    call('not', call('empty', `body('List_${name}')?['@odata.nextLink']`))),
  ...['equipment', 'packages', 'labor', 'materials'].map(name => call('not', call('empty', `body('Invalid_${name}')`))),
  call('not', eq(val('re_estimatestatus'), '126110002')),
  call('not', call('or', eq(val('re_proposallanguage'), '126110000'), eq(val('re_proposallanguage'), '126110001'))),
  call('empty', val('re_submittedon')), call('empty', val('re_calculatedon')),
  call('or', call('empty', val('re_calculationversion')), eq(val('re_calculationversion'), "'unavailable'")),
  ...['re_totaltruecost', 're_suggestedprice', 're_recommendedcmii', 're_sellprice'].map(key => eq(val(key), 'null')),
  call('empty', "body('List_equipment')?['value']"), call('empty', "body('List_packages')?['value']"),
  call('empty', "body('Get_estimate')?['transactioncurrencyid']?['isocurrencycode']"))
  actions.Check_submission = { type: 'If', expression: `@${invalid}`, runAfter: after(previous),
    actions: { Invalid_submission: { type: 'Terminate', inputs: { runStatus: 'Failed',
      runError: { code: 'ESTIMATE_EMAIL_INCOMPLETE', message: 'Submitted estimate, pricing, language or related rows are incomplete. No email sent.' } } } },
    else: { actions: {} } }
  previous = 'Check_submission'

  const header = {}
  const plain = {
    EstimateNumber: 're_name', OpportunityName: 're_estimatename', ContactName: 're_customername',
    ContactEmail: 're_customeremail', ContactPhone: 're_customerphone', SiteDescription: 're_buildingname',
    Supervisor: 're_supervisor', AdditionalScope: 're_additionalscope', MarginComments: 're_margincomments',
    NotesForCttTeam: 're_notesforcttteam', ProspectAccountNumber: 're_prospectaccount',
    SoldTo: 're_soldto', BillTo: 're_billto', Payer: 're_payer',
    CalculationVersion: 're_calculationversion',
  }
  for (const [token, column] of Object.entries(plain)) header[token] = text(val(column))
  const choices = {
    Market: 're_market', EstimateStatus: 're_estimatestatus', ProposalLanguage: 're_proposallanguage',
    WorkCentreRequest: 're_workcenterrequest', HasBeenApproved: 're_hasbeenapproved',
    NationalAccount: 're_nationalaccount', Emergency: 're_emergency', CustomerBudgeted: 're_customerbudgeted',
    PaperType: 're_papertype', ConsultantInvolved: 're_consultantinvolved', CompetingBids: 're_competingbids',
    TimeCategory: 're_timecategory', BillingPlan: 're_billingplan',
  }
  for (const [token, column] of Object.entries(choices)) header[token] = headerChoice(column)
  for (const [token, navigation, english, french] of [
    ['StateProvince', 're_BuildingProvinceState', 're_nameen', 're_namefr'],
    ['EquipmentType', 're_EquipmentType', 're_nameen', 're_namefr'],
    ['JobType', 're_JobType', 're_jobtypeen', 're_jobtypefr'],
  ]) {
    const en = `body('Get_estimate')?[${quote(navigation)}]?[${quote(english)}]`
    const translated = `body('Get_estimate')?[${quote(navigation)}]?[${quote(french)}]`
    header[token] = text(choose(fr, choose(call('empty', translated), en, translated), en))
  }
  const person = column => `body('Get_estimate')?['re_Salesperson']?[${quote(column)}]`
  header.CustomerName = text("body('Get_estimate')?['re_customeraccount']?['name']")
  header.AccountNumber = text("body('Get_estimate')?['re_customeraccount']?['accountnumber']")
  header.CurrencyCode = "body('Get_estimate')?['transactioncurrencyid']?['isocurrencycode']"
  header.Branch = text("body('Get_estimate')?['re_Branch']?['re_branchname']")
  header.EstimatorBranch = header.Branch
  header.EstimatorName = text(person('fullname'))
  header.Salesperson = header.EstimatorName
  header.PricingState = local('Calculated - saved server results', 'Calcule - resultats enregistres du serveur')
  header.EstimatorEmail = text(person('internalemailaddress'))
  for (const [token, column] of Object.entries({
    TotalSellingPrice: 're_sellprice', TotalTrueCost: 're_totaltruecost', SuggestedSellingPrice: 're_suggestedprice',
    SuggestedPriceWithKoneMaterial: 're_suggestedpricewithkonematerial', AmIncentive: 're_amincentive',
    BdIncentive: 're_bdincentive', PackageCostTotal: 're_packageestimatedcost', CustomLaborCost: 're_customlaborcost',
    CustomMaterialCost: 're_custommaterialcost', TotalAdditionalCost: 're_totaladditionalcost',
    UseTaxAmount: 're_usetaxamount', FreightAmount: 're_freightamount', AdditionalMaterial: 're_additionalmaterial',
    AdditionalMiscellaneous: 're_additionalmiscellaneous', SubcontractorCost: 're_subcontractorcost',
    StatedLaborRate: 're_statedlaborrate', KoneSparesSalesPrice: 're_konesparessalespricevk13',
  })) header[token] = display(val(column))
  for (const [token, column] of Object.entries({
    BaseTargetCmii: 're_basetargetcmii', RecommendedCmii: 're_recommendedcmii',
    ActualCmii: 're_actualcmii', CmiiVariance: 're_cmiivariance', UseTaxPercent: 're_usetax', FreightPercent: 're_freight',
  })) header[token] = percent(val(column))
  header.NumberOfTechnicians = display(val('re_numberoftechs'), '0')
  header.AdditionalLaborHours = display(val('re_additionallaborhours'))
  header.CalculatedOn = choose(eq(val('re_calculatedon'), 'null'), unavailable,
    call('concat', call('formatDateTime', val('re_calculatedon'), "'yyyy-MM-dd HH:mm'"), "' UTC'"))
  const billing = val('re_billingplan')
  const depositPercent = choose(eq(billing, '126110000'), '50', choose(eq(billing, '126110001'), '60', '0'))
  // Integer cents preserve the app's half-up down payment and remainder behavior.
  const cents = call('int', call('formatNumber', mul(val('re_sellprice'), '100'), "'0'", "'en-US'"))
  const depositCents = call('div', add(mul(cents, depositPercent), '50'), '100')
  const deposit = call('div', call('float', depositCents), '100')
  const customBilling = eq(billing, '126110003')
  header.DownPayment = choose(customBilling, local('See billing notes', 'Voir les notes de facturation'), display(deposit))
  header.FinalPayment = choose(customBilling, local('See billing notes', 'Voir les notes de facturation'),
    display(call('div', call('float', call('sub', cents, depositCents)), '100')))
  compose(actions, 'Header_values', Object.fromEntries(Object.entries(header).map(([key, value]) => [key, `@${htmlText(value)}`])), previous)
  previous = 'Header_values'
  for (const name of ['equipment', 'package', 'labor', 'material', 'email']) {
    actions[`Initialize_${name}`] = { type: 'InitializeVariable', inputs: { variables: [
      { name: `${name}_html`, type: 'string', value: '' }] }, runAfter: after(previous) }
    previous = `Initialize_${name}`
  }
  const templates = Object.fromEntries(['en', 'fr'].map(language => [language,
    readFileSync(resolve(root, language === 'fr' ? 'email.fr.html' : 'email.html'), 'utf8')]))
  const blocks = {}
  for (const type of ['equipment', 'package', 'labor', 'material']) {
    blocks[type] = {}
    for (const language of ['en', 'fr']) {
      const regex = new RegExp(`<!-- BEGIN repeat ${type} -->([\\s\\S]*?)<!-- END repeat ${type} -->`)
      const match = templates[language].match(regex)
      if (!match) throw new Error(`Missing ${language} ${type} repeat block`)
      blocks[type][language] = match[1]
      templates[language] = templates[language].replace(regex, `{{${type}_html}}`)
    }
  }
  const translatedPackage = (en, french, cleared) => choose(fr,
    choose(eq(row(cleared), 'true'), "''", choose(call('empty', row(french)), zeroText(row(en)), row(french))), zeroText(row(en)))
  function zeroText(value) { return fallback(value, "''") }
  const relatedNumber = nav => {
    const number = `item()?[${quote(nav)}]?['re_equipmentnumber']`
    return choose(call('empty', number), local('Shared across package equipment', 'Partage entre les equipements du forfait'), number)
  }
  const packageNumber = text("item()?['re_EstimatePackage']?['re_packagenumber']")
  const equipmentValues = {
    EquipmentNumber: text(row('re_equipmentnumber')), EquipmentName: text(row('re_equipmentnamesnapshot')),
    EquipmentLocation: text(row('re_functionallocation')), EquipmentCustomer: text(row('re_soldtoname')),
    EquipmentOem: text(row('re_oem')), EquipmentAge: display(row('re_equipmentage'), '0'),
    EquipmentMatched: choose(call('empty', row('_re_equipment_value')), local('No', 'Non'), local('Yes', 'Oui')),
  }
  const laborValues = {
    LaborPackage: packageNumber, LaborEquipmentNumber: relatedNumber('re_EstimateEquipment'),
    LaborRole: label('item()', 're_estimatelaborline', 're_laborrole'),
    LaborTimeCategory: label('item()', 're_estimatelaborline', 're_timecategory'),
    LaborHours: display(row('re_hours')), LaborRate: display(row('re_hourlycost')),
    LaborLineCost: display(row('re_totalcost')),
  }
  const materialValues = {
    MaterialPackage: packageNumber, MaterialEquipmentNumber: relatedNumber('re_estimateequipment'),
    MaterialDescription: text(choose(fr, choose(call('empty', row('re_descriptionfr')),
      fallback(row('re_descriptionen'), row('re_entereddescription')), row('re_descriptionfr')),
    fallback(row('re_descriptionen'), row('re_entereddescription')))), MaterialVendor: text(row('re_vendor')),
    MaterialPartType: choose(eq(row('re_materialpricingmode'), '126110000'), "'Non-KONE'",
      choose(eq(row('re_materialpricingmode'), '126110001'), "'KONE'", label('item()', 're_estimatematerialline', 're_parttype'))),
    MaterialPartNumber: text(row('re_partnumber')),
    MaterialPricingSource: choose(call('not', call('empty', row('_re_sparepart_value'))), local('Catalog', 'Catalogue'),
      choose(eq(row('re_materialpricingmode'), '126110001'), local('Package', 'Forfait'), local('Manual', 'Manuel'))),
    MaterialQuantity: display(row('re_quantity'), '0.##########'), MaterialUom: text(row('re_uom')),
    MaterialUnitCost: display(fallback(row('re_unitcostprecise'), row('re_unitcost')), '0.##########'),
    MaterialVk13UnitPrice: choose(call('greater', zero(row('re_unitpriceprecise')), '0'), display(row('re_unitpriceprecise'), '0.##########'), notApplicable),
    MaterialSellingPrice: choose(call('and', call('not', call('empty', row('_re_sparepart_value'))),
      call('greater', zero(row('re_unitpriceprecise')), '0')),
      display(fallback(row('re_sellingprice'), row('re_unitpriceprecise')), '0.##########'), notApplicable),
    MaterialMarkupPercent: rawPercent(row('re_markuppct')),
    MaterialLineCost: display(row('re_extendedcost')),
  }
  const packageItem = column => `items('For_each_package')?[${quote(column)}]`
  const packageTax = choose(eq(packageItem('re_packagepricedkone'), 'true'), '0',
    choose(eq(packageItem('re_iscustompackage'), 'true'), val('re_usetax'), '0.05'))
  const packageFreight = choose(eq(packageItem('re_packagepricedkone'), 'true'), '0',
    choose(eq(packageItem('re_iscustompackage'), 'true'), val('re_freight'), '0.14'))
  const packageLabor = mul(packageItem('re_totalhours'), val('re_mechaniclaborrate'))
  const packageMaterial = packageItem('re_totalmaterial')
  const sum = name => choose(call('empty', `body('${name}')`), '0', call('float', call('xpath',
    call('xml', call('concat', "'<r><n>'", call('join', `body('${name}')`, "'</n><n>'"), "'</n></r>'")), "'sum(/r/n)'")))
  const packageValues = {
    PackageNumber: text(row('re_packagenumber')),
    PackageName: translatedPackage('re_packagenameen', 're_packagenamefr', 're_customnamefrcleared'),
    PackageScope: translatedPackage('re_proposalscopeen', 're_proposalscopefr', 're_customscopefrcleared'),
    PackageType: choose(eq(row('re_iscustompackage'), 'true'), local('Custom', 'Personnalise'), local('Standard', 'Standard')),
    PackageEquipment: choose(call('empty', row('re_equipmentnumbers')), local('All selected equipment', 'Tous les equipements selectionnes'),
      call('join', call('json', row('re_equipmentnumbers')), "', '")),
    PackageEquipmentQuantity: display(row('re_quantity'), '0'),
    PackageLaborHours: display(add(packageItem('re_totalhours'), sum('Package_labor_hours'))),
    PackageMechanicRate: display(val('re_mechaniclaborrate')),
    PackageLaborCost: display(add(packageLabor, sum('Package_labor_costs'))),
    PackageMaterialCost: display(add(packageMaterial, sum('Package_material_bases'))),
    PackageKoneBeforeMarkup: display(row('re_materialbeforemarkup')),
    PackageKoneFinalAmount: choose(eq(row('re_packagepricedkone'), 'true'),
      display(mul(row('re_materialcostperunit'), row('re_quantity'))), notApplicable),
    PackageTaxPercent: percent(packageTax), PackageFreightPercent: percent(packageFreight),
    PackageEstimatedCost: display(add(packageLabor, mul(packageMaterial, add('1', packageTax, packageFreight)),
      sum('Package_labor_costs'), sum('Package_material_totals'))),
  }
  for (const [type, source, values] of [
    ['equipment', 'equipment', equipmentValues], ['package', 'packages', packageValues],
    ['labor', 'labor', laborValues], ['material', 'materials', materialValues],
  ]) {
    const nested = {}
    let tail
    if (type === 'package') {
      for (const kind of ['labor', 'materials']) {
        const name = `Filter_package_${kind}`
        nested[name] = { type: 'Query', inputs: { from: `@body('List_${kind}')?['value']`,
          where: `@${eq(row('_re_estimatepackage_value'), packageItem('re_estimatepackageid'))}` }, runAfter: after(tail) }
        tail = name
      }
      for (const [name, sourceName, column] of [
        ['Package_labor_hours', 'labor', 're_hours'], ['Package_labor_costs', 'labor', 're_totalcost'],
        ['Package_material_bases', 'materials', 're_extendedcost'], ['Package_material_totals', 'materials', 're_totalcost'],
      ]) {
        nested[name] = { type: 'Select', inputs: { from: `@body('Filter_package_${sourceName}')`, select: `@${zero(row(column))}` },
          runAfter: after(tail) }
        tail = name
      }
    }
    compose(nested, `${type}_values`, Object.fromEntries(Object.entries(values).map(([key, value]) =>
      [key, `@${htmlText(value)}`])), tail)
    const getToken = key => {
      if (!(key in values)) throw new Error(`Unmapped ${type} token ${key}`)
      return `outputs('${type}_values')?[${quote(key)}]`
    }
    const languageBranch = language => {
      const branch = {}
      const rowName = `${type}_${language}`
      compose(branch, rowName, compileHtml(blocks[type][language], getToken))
      branch[`Append_${type}_${language}`] = { type: 'AppendToStringVariable',
        inputs: { name: `${type}_html`, value: `@outputs('${rowName}')` }, runAfter: after(rowName) }
      return branch
    }
    nested[`Render_${type}_language`] = { type: 'If', expression: `@${fr}`,
      actions: languageBranch('fr'), else: { actions: languageBranch('en') },
      runAfter: after(`${type}_values`) }
    actions[`For_each_${type}`] = { type: 'Foreach', foreach: `@body('List_${source}')?['value']`,
      actions: nested, runAfter: after(previous), runtimeConfiguration: { concurrency: { repetitions: 1 } } }
    previous = `For_each_${type}`
    compose(actions, `Rendered_${type}`, `@${choose(call('empty', `variables('${type}_html')`),
      call('concat', "'<p>'", htmlText(local('No rows', 'Aucune ligne')), "'</p>'"), `variables('${type}_html')`)}`, previous)
    previous = `Rendered_${type}`
  }
  const languageBranches = {}
  for (const language of ['en', 'fr']) {
    // Split only outside tokens; preserving every character is mandatory.
    const segments = []
    let remaining = templates[language]
    while (remaining.length) {
      let end = Math.min(2000, remaining.length)
      const open = remaining.lastIndexOf('{{', end - 1)
      if (open >= 0 && remaining.indexOf('}}', open) + 2 > end) end = open
      segments.push(remaining.slice(0, end))
      remaining = remaining.slice(end)
    }
    if (segments.join('') !== templates[language]) throw new Error('Template splitting failed')
    const branch = {}
    const segmentOutputs = []
    let tail
    for (const [index, segment] of segments.entries()) {
      const name = `Email_${language}_${index + 1}`
      compose(branch, name, compileHtml(segment, key => {
        if (key.endsWith('_html')) return `outputs('Rendered_${key.slice(0, -5)}')`
        if (!(key in header)) throw new Error(`Unmapped header token ${key}`)
        return `outputs('Header_values')?[${quote(key)}]`
      }), tail)
      tail = name
      segmentOutputs.push(`outputs('${name}')`)
    }
    branch[`Set_email_${language}`] = { type: 'SetVariable',
      inputs: { name: 'email_html', value: `@${call('concat', ...segmentOutputs)}` }, runAfter: after(tail) }
    languageBranches[language] = branch
  }
  actions.Render_email_language = { type: 'If', expression: `@${fr}`, actions: languageBranches.fr,
    else: { actions: languageBranches.en }, runAfter: after(previous) }
  compose(actions, 'Email_HTML', "@variables('email_html')", 'Render_email_language')
  actions.Check_rendered_email = { type: 'If', expression: "@contains(outputs('Email_HTML'),'{{')", runAfter: after('Email_HTML'),
    actions: { Unresolved_template: { type: 'Terminate', inputs: { runStatus: 'Failed',
      runError: { code: 'ESTIMATE_EMAIL_UNRESOLVED', message: 'Email template contains unresolved placeholders. No email sent.' } } } },
    else: { actions: {} } }
  actions.Send_review_email = connector('SendEmailV2', {
    'emailMessage/To': "@parameters('ReviewRecipient')",
    'emailMessage/Subject': `@${call('concat', local('Repair estimate review - ', 'Revision du devis - '),
      call('replace', call('replace', val('re_name'), "decodeUriComponent('%0D')", "''"), "decodeUriComponent('%0A')", "''"))}`,
    'emailMessage/Body': "@outputs('Email_HTML')",
    'emailMessage/Importance': 'Normal',
  }, 'Check_rendered_email', 'shared_office365')
  actions.Send_review_email.inputs.retryPolicy = { type: 'none' }
  const definition = {
    '$schema': 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#',
    contentVersion: '1.0.0.0',
    parameters: { '$authentication': { defaultValue: {}, type: 'SecureObject' },
      '$connections': { defaultValue: {}, type: 'Object' }, ReviewRecipient: { defaultValue: recipient, type: 'String' } },
    triggers: { When_estimate_submitted: {
      type: 'OpenApiConnectionWebhook',
      inputs: { host: { apiId: '/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps',
        connectionReferenceName: bindingName('shared_commondataserviceforapps'), operationId: 'SubscribeWebhookTrigger' },
      parameters: { 'subscriptionRequest/message': 3, 'subscriptionRequest/entityname': 're_repairestimate',
        'subscriptionRequest/scope': 4, 'subscriptionRequest/filteringattributes': 're_estimatestatus',
        'subscriptionRequest/filterexpression': 're_estimatestatus eq 126110002' } },
      conditions: [{ expression: "@equals(triggerBody()?['re_estimatestatus'],126110002)" }],
    } },
    actions, outputs: {},
  }
  for (const expression of JSON.stringify(definition).matchAll(/"(@[^"]*)"/g))
    if (expression[1].length > 8192) throw new Error('Generated expression exceeds 8192 characters')
  const names = new Set(Object.keys(definition.triggers))
  const uniqueNames = actions => {
    for (const [name, action] of Object.entries(actions)) {
      if (names.has(name)) throw new Error(`Duplicate workflow action name: ${name}`)
      names.add(name)
      if (action.actions) uniqueNames(action.actions)
      if (action.else?.actions) uniqueNames(action.else.actions)
    }
  }
  uniqueNames(actions)
  return { definition, connectionReferences: bindings }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [metadataPath, recipient, referencesPath, outputPath] = process.argv.slice(2)
  if (!outputPath) throw new Error('Usage: node automation\\build-estimate-email-flow.mjs metadata.json recipient references.json output.json')
  const json = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
  const result = buildEstimateEmailFlow({ recipient, metadata: json(metadataPath), connectionReferences: json(referencesPath) })
  writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n')
  console.log(`Generated ${Object.keys(result.definition.actions).length} actions; no flow was updated.`)
}
