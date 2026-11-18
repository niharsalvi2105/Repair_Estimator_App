import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildEstimateEmailFlow, toSolutionClientData } from '../automation/build-estimate-email-flow.mjs'

// Evaluate the generated WDL, not a second implementation of the email renderer.
function parse(expression) {
  let index = 0
  const whitespace = () => { while (/\s/.test(expression[index] ?? '') && index < expression.length) index++ }
  const expect = char => { whitespace(); assert.equal(expression[index++], char, expression) }
  const string = () => {
    expect("'")
    let value = ''
    while (index < expression.length) {
      if (expression[index] === "'") {
        index++
        if (expression[index] !== "'") return value
      }
      value += expression[index++]
    }
    throw new Error('Unclosed WDL string')
  }
  const value = () => {
    whitespace()
    let node
    if (expression[index] === "'") node = { value: string() }
    else {
      const token = expression.slice(index).match(/^-?\d+(?:\.\d+)?|^[a-zA-Z_]\w*/)?.[0]
      assert.ok(token, expression.slice(index))
      index += token.length
      if (token === 'null') node = { value: null }
      else if (token === 'true' || token === 'false') node = { value: token === 'true' }
      else if (/^-?\d/.test(token)) node = { value: Number(token) }
      else {
        expect('(')
        const args = []
        whitespace()
        if (expression[index] !== ')') {
          do {
            args.push(value())
            whitespace()
            if (expression[index] !== ',') break
            index++
          } while (true)
        }
        expect(')')
        node = { name: token, args }
      }
    }
    while (expression[index] === '?' || expression[index] === '[') {
      if (expression[index] === '?') index++
      expect('[')
      const key = string()
      expect(']')
      node = { parent: node, key }
    }
    return node
  }
  const result = value()
  whitespace()
  assert.equal(index, expression.length, expression)
  return result
}

function evaluate(node, context) {
  if ('value' in node) return node.value
  if ('parent' in node) return evaluate(node.parent, context)?.[node.key] ?? null
  const run = arg => evaluate(arg, context)
  if (node.name === 'if') return run(node.args[0]) ? run(node.args[1]) : run(node.args[2])
  const args = node.args.map(run)
  const [a, b, c] = args
  const functions = {
    body: () => context.outputs[a]?.body, outputs: () => context.outputs[a],
    item: () => context.item, items: () => context.items[a], variables: () => context.variables[a],
    triggerBody: () => context.header, parameters: () => context.parameters[a],
    equals: () => a === b, not: () => !a, and: () => args.every(Boolean), or: () => args.some(Boolean),
    empty: () => a == null || a === '' || Array.isArray(a) && !a.length,
    coalesce: () => args.find(value => value != null) ?? null,
    greater: () => a > b, contains: () => a.includes(b), string: () => a == null ? '' : String(a),
    concat: () => args.join(''), replace: () => a.replaceAll(b, c), join: () => a.join(b),
    decodeUriComponent: () => decodeURIComponent(a), json: () => JSON.parse(a),
    add: () => a + b, sub: () => a - b, mul: () => a * b,
    div: () => node.args[0].name === 'float' ? a / b : Math.trunc(a / b),
    int: () => Number.parseInt(a, 10), float: () => Number(a), xml: () => a,
    xpath: () => [...a.matchAll(/<n>(.*?)<\/n>/g)].reduce((sum, match) => sum + Number(match[1]), 0),
    formatDateTime: () => new Date(a).toISOString().slice(0, 16).replace('T', ' '),
    formatNumber: () => {
      assert.notEqual(a, null, 'Formatting a missing number must not fabricate a zero')
      const decimals = b.split('.')[1] ?? ''
      return new Intl.NumberFormat(c, { useGrouping: false,
        minimumFractionDigits: decimals.replaceAll('#', '').length, maximumFractionDigits: decimals.length }).format(a)
    },
  }
  assert.ok(functions[node.name], `Unimplemented function ${node.name}`)
  return functions[node.name]()
}

function execute(definition, fixture) {
  const context = { outputs: {}, items: {}, variables: {}, header: fixture.header,
    parameters: { ReviewRecipient: 'review@example.invalid' }, sent: [], executed: [] }
  const resolve = value => {
    if (typeof value === 'string') return value.startsWith('@') && !value.startsWith('@{')
      ? evaluate(parse(value.slice(1)), context) : value
    if (Array.isArray(value)) return value.map(resolve)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v)]))
    return value
  }
  const run = actions => {
    for (const [name, action] of Object.entries(actions)) {
      context.executed.push(name)
      switch (action.type) {
        case 'OpenApiConnection':
          if (name === 'Get_estimate') context.outputs[name] = { body: fixture.header }
          else if (name.startsWith('List_')) context.outputs[name] = { body: fixture[name] ?? { value: [] } }
          else context.sent.push(resolve(action.inputs.parameters))
          break
        case 'Compose': context.outputs[name] = resolve(action.inputs); break
        case 'InitializeVariable':
          for (const variable of action.inputs.variables) context.variables[variable.name] = variable.value
          break
        case 'AppendToStringVariable': context.variables[action.inputs.name] += resolve(action.inputs.value); break
        case 'SetVariable': context.variables[action.inputs.name] = resolve(action.inputs.value); break
        case 'Foreach':
          for (const row of resolve(action.foreach)) {
            context.items[name] = row
            context.item = row
            run(action.actions)
          }
          break
        case 'Query':
        case 'Select': {
          const previous = context.item
          const rows = resolve(action.inputs.from)
          const value = action.type === 'Query'
            ? rows.filter(row => { context.item = row; return resolve(action.inputs.where) })
            : rows.map(row => { context.item = row; return resolve(action.inputs.select) })
          context.item = previous
          context.outputs[name] = { body: value }
          break
        }
        case 'If': run(resolve(action.expression) ? action.actions : action.else.actions); break
        case 'Terminate': throw new Error(action.inputs.runError.code)
        default: throw new Error(`Unknown action ${action.type}`)
      }
    }
  }
  run(definition.actions)
  return context
}

const source = readFileSync(new URL('../automation/build-estimate-email-flow.mjs', import.meta.url), 'utf8')
const choices = Object.fromEntries([
  ...[...source.matchAll(/(\w+): '(re_\w+)'/g)].map(match => `re_repairestimate.${match[2]}`),
  're_estimatelaborline.re_laborrole', 're_estimatelaborline.re_timecategory', 're_estimatematerialline.re_parttype',
].map(key => [key, [{ value: 126110000, en: 'English choice', fr: 'Choix francais' }]]))
const make = () => buildEstimateEmailFlow({ recipient: 'review@example.invalid', metadata: { choices },
  connectionReferences: Object.fromEntries(['shared_commondataserviceforapps', 'shared_office365'].map(connector => [connector, {
    connectionReferenceLogicalName: `re_${connector}`, source: 'Embedded',
    id: `/providers/Microsoft.PowerApps/apis/${connector}`,
  }])) }).definition
const fixture = () => ({
  header: { re_repairestimateid: 'estimate', re_name: 'RE-0001', re_estimatestatus: 126110002,
    re_proposallanguage: 126110000, re_submittedon: '2026-01-02T03:04:00Z',
    re_calculatedon: '2026-01-02T03:00:00Z', re_calculationversion: '2026.10',
    re_totaltruecost: 7330.48, re_suggestedprice: 21004.90, re_recommendedcmii: 0.65,
    re_sellprice: 100.01, re_billingplan: 126110000, re_usetax: 0, re_freight: 0, re_mechaniclaborrate: 100,
    re_customeraccount: { name: 'Synthetic account', accountnumber: '0000123' },
    transactioncurrencyid: { isocurrencycode: 'CAD' } },
  List_equipment: { value: [{ re_equipmentnumber: '00009', re_equipmentage: 0 }] },
  List_packages: { value: [{ re_estimatepackageid: 'package1', re_packagenumber: 'CSTM',
    re_packagenameen: 'English name', re_packagenamefr: 'Nom francais', re_proposalscopeen: 'English scope',
    re_proposalscopefr: 'Portee francaise', re_iscustompackage: true, re_equipmentnumbers: '["00009"]',
    re_totalhours: 0, re_totalmaterial: 0, re_quantity: 1 }] },
})

test('all template tokens compile, exact account numbers and saved pricing survive, cents match app', () => {
  const result = execute(make(), fixture())
  assert.equal(result.sent.length, 1)
  const html = result.sent[0]['emailMessage/Body']
  assert.ok(html.includes('0000123'))
  assert.ok(html.includes('21004.90'))
  assert.ok(html.includes('7330.48'))
  assert.ok(!html.includes('{{'))
  assert.equal(result.outputs.Header_values.DownPayment, '50.01')
  assert.equal(result.outputs.Header_values.FinalPayment, '50.00')
})

test('English and French emails put saved pricing before detailed sections without losing values', () => {
  for (const [language, heading, customerHeading, equipmentHeading, suggestedLabel] of [
    [126110000, 'Pricing at a glance', 'Customer &amp; request details', 'Equipment</h2>', 'SUGGESTED SELLING PRICE'],
    [126110001, 'Aper&ccedil;u des prix', 'Client et renseignements de la demande', '&Eacute;quipement</h2>', 'PRIX DE VENTE SUGG&Eacute;R&Eacute;'],
  ]) {
    const data = fixture()
    data.header.re_proposallanguage = language
    const result = execute(make(), data)
    const html = result.sent[0]['emailMessage/Body']
    const pricing = html.indexOf(heading)
    const customer = html.indexOf(customerHeading)
    const equipment = html.indexOf(equipmentHeading)
    assert.ok(pricing > 0 && pricing < customer && customer < equipment)
    const summary = html.slice(pricing, customer)
    assert.ok(summary.includes(result.outputs.Header_values.TotalSellingPrice))
    assert.ok(summary.includes(result.outputs.Header_values.SuggestedSellingPrice))
    assert.ok(summary.includes(result.outputs.Header_values.TotalTrueCost))
    assert.ok(summary.includes(result.outputs.Header_values.PricingState))
    assert.ok(summary.includes(suggestedLabel))
    assert.ok(html.slice(equipment).includes('00009'))
    assert.ok(!html.includes('{{'))
  }
})

test('only the selected language renders email segments and repeated rows', () => {
  for (const [language, selected, skipped] of [[126110000, 'en', 'fr'], [126110001, 'fr', 'en']]) {
    const data = fixture()
    data.header.re_proposallanguage = language
    data.List_labor = { value: [{ re_hours: 1, re_hourlycost: 2, re_totalcost: 2, _re_estimatepackage_value: 'package1' }] }
    data.List_materials = { value: [{ re_entereddescription: 'Part', re_quantity: 1, re_unitcost: 2,
      re_extendedcost: 2, re_totalcost: 2, _re_estimatepackage_value: 'package1' }] }
    const result = execute(make(), data)
    for (const type of ['equipment', 'package', 'labor', 'material']) {
      assert.ok(result.executed.includes(`${type}_${selected}`))
      assert.ok(!result.executed.includes(`${type}_${skipped}`))
    }
    assert.ok(result.executed.includes(`Email_${selected}_1`))
    assert.ok(!result.executed.some(name => name.startsWith(`Email_${skipped}_`)))
    assert.ok(result.executed.includes(`Set_email_${selected}`))
    assert.equal(result.sent.length, 1)
  }
})

test('French clears, localized description, zero rates and untrusted multiline HTML are preserved safely', () => {
  const data = fixture()
  data.header.re_proposallanguage = 126110001
  data.header.re_notesforcttteam = `<img src=x onerror="bad"> & 'quote'\n{{Keep this}} @{danger()}`
  data.List_packages.value[0].re_customnamefrcleared = true
  data.List_packages.value[0].re_customscopefrcleared = true
  data.List_materials = { value: [{ re_entereddescription: 'Manual', re_descriptionen: 'English part',
    re_descriptionfr: 'Piece francaise', re_materialpricingmode: 126110000, re_quantity: 1, re_unitcost: 2,
    re_extendedcost: 2, re_totalcost: 2, _re_estimatepackage_value: 'package1' }] }
  const result = execute(make(), data)
  const html = result.sent[0]['emailMessage/Body']
  assert.match(html, /lang="fr"/)
  assert.ok(html.includes('Piece francaise'))
  assert.ok(!html.includes('English name') && !html.includes('English scope'))
  assert.ok(!html.includes('<img'))
  assert.ok(html.includes('&lt;img') && html.includes('&amp;') && html.includes('&quot;'))
  assert.ok(html.includes('<br>&#123;&#123;Keep this}}'))
  assert.equal(result.outputs.Header_values.UseTaxPercent, '0,00%')
  assert.equal(result.outputs.material_values.MaterialPricingSource, 'Manuel')
})

test('all six labor combinations and more than twenty material rows render once with scoped package sums', () => {
  const data = fixture()
  data.List_labor = { value: Array.from({ length: 6 }, (_, index) => ({
    re_laborrole: 126110000 + index % 3, re_timecategory: 126110000 + index % 2,
    re_hours: 1, re_hourlycost: 2, re_totalcost: 2, _re_estimatepackage_value: 'package1',
    re_EstimateEquipment: { re_equipmentnumber: `LABOR-${index}` },
  })) }
  data.List_materials = { value: Array.from({ length: 25 }, (_, index) => ({
    re_entereddescription: `Material-${index}`, re_quantity: 1, re_unitcostprecise: 3.123456789,
    re_extendedcost: 3, re_totalcost: 3, _re_estimatepackage_value: 'package1',
    _re_sparepart_value: 'catalog', re_unitpriceprecise: 5.123456789, re_sellingprice: 8.123456789,
  })) }
  const result = execute(make(), data)
  const html = result.sent[0]['emailMessage/Body']
  for (let index = 0; index < 6; index++) assert.ok(html.includes(`LABOR-${index}`))
  for (let index = 0; index < 25; index++) assert.ok(html.includes(`Material-${index}`))
  assert.equal([...html.matchAll(/LABOR-\d+/g)].length, 6)
  assert.equal([...html.matchAll(/Material-\d+/g)].length, 25)
  assert.equal(result.outputs.package_values.PackageLaborCost, '12.00')
  assert.equal(result.outputs.package_values.PackageMaterialCost, '75.00')
  assert.equal(result.outputs.package_values.PackageEstimatedCost, '87.00')
  assert.equal(result.outputs.material_values.MaterialSellingPrice, '8.123456789')
  assert.equal(result.outputs.material_values.MaterialUnitCost, '3.123456789')
})

test('incomplete retrieval, missing pricing, draft state and missing currency block email', () => {
  for (const mutate of [
    data => { data.List_equipment['@odata.nextLink'] = 'another-page' },
    data => { delete data.header.re_suggestedprice },
    data => { data.header.re_estimatestatus = 126110000 },
    data => { delete data.header.transactioncurrencyid },
    data => { data.List_labor = { value: [{ re_hours: 2, _re_estimatepackage_value: 'package1' }] } },
  ]) {
    const data = fixture()
    mutate(data)
    assert.throws(() => execute(make(), data), /ESTIMATE_EMAIL_INCOMPLETE/)
  }
})

test('definition has update-only/status filtering, pagination, sequential loops, no attachments and no authored authentication', () => {
  const definition = make()
  const trigger = definition.triggers.When_estimate_submitted
  assert.equal(trigger.inputs.parameters['subscriptionRequest/message'], 3)
  assert.equal(trigger.inputs.parameters['subscriptionRequest/filteringattributes'], 're_estimatestatus')
  assert.equal(trigger.inputs.host.connectionReferenceName, 're_shared_commondataserviceforapps')
  assert.equal(definition.actions.Send_review_email.inputs.host.connectionReferenceName, 're_shared_office365')
  for (const name of ['equipment', 'packages', 'labor', 'materials']) {
    const action = definition.actions[`List_${name}`]
    assert.ok(action.inputs.parameters.$filter.startsWith('_re_repairestimate_value eq '))
    assert.equal(action.inputs.parameters.$top, undefined)
    assert.equal(action.runtimeConfiguration.paginationPolicy.minimumItemCount, 10000)
  }
  assert.equal(definition.actions.Send_review_email.inputs.retryPolicy.type, 'none')
  assert.ok(!JSON.stringify(definition).includes('emailMessage/Attachments'))
  assert.ok(!JSON.stringify(definition).includes('"authentication"'))
  assert.ok(JSON.stringify(definition).includes('re_sellingprice'))
  assert.throws(() => buildEstimateEmailFlow({ recipient: 'bad' }), /recipient/)
})

test('standard rates are isolated; package-priced KONE cost and final price are not double counted', () => {
  const data = fixture()
  Object.assign(data.List_packages.value[0], { re_iscustompackage: false, re_totalmaterial: 100, re_totalhours: 2 })
  let result = execute(make(), data)
  assert.equal(result.outputs.package_values.PackageEstimatedCost, '319.00')
  assert.equal(result.outputs.package_values.PackageTaxPercent, '5.00%')
  assert.equal(result.outputs.package_values.PackageFreightPercent, '14.00%')
  Object.assign(data.List_packages.value[0], { re_iscustompackage: true, re_packagepricedkone: true,
    re_materialbeforemarkup: 100, re_materialcostperunit: 150 })
  result = execute(make(), data)
  assert.equal(result.outputs.package_values.PackageEstimatedCost, '300.00')
  assert.equal(result.outputs.package_values.PackageKoneFinalAmount, '150.00')
})

test('billing plans preserve sixty/forty and final-only cents, and custom plans invent no split', () => {
  for (const [plan, deposit, final] of [[126110001, '60.01', '40.00'], [126110002, '0.00', '100.01'],
    [126110003, 'See billing notes', 'See billing notes']]) {
    const data = fixture()
    data.header.re_billingplan = plan
    const result = execute(make(), data)
    assert.equal(result.outputs.Header_values.DownPayment, deposit)
    assert.equal(result.outputs.Header_values.FinalPayment, final)
  }
})

test('bilingual source has exactly matching 111 tokens and every emitted WDL expression parses within limits', () => {
  const tokens = language => new Set([...readFileSync(new URL(language === 'fr'
    ? '../email.fr.html' : '../email.html', import.meta.url), 'utf8').matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]))
  assert.equal(tokens('en').size, 111)
  assert.deepEqual(tokens('en'), tokens('fr'))
  const walk = value => {
    if (typeof value === 'string' && value.startsWith('@') && !value.startsWith('@{')) {
      assert.ok(value.length < 8192)
      parse(value.slice(1))
    } else if (value && typeof value === 'object') Object.values(value).forEach(walk)
  }
  walk(make())
  const names = new Set()
  const unique = actions => {
    for (const [name, action] of Object.entries(actions)) {
      assert.ok(!names.has(name), `Globally duplicated workflow name: ${name}`)
      names.add(name)
      if (action.actions) unique(action.actions)
      if (action.else?.actions) unique(action.else.actions)
    }
  }
  unique({ ...make().triggers, ...make().actions })
})

test('solution clientdata preserves its wrapper and existing aliases using the stored solution binding shape', () => {
  const definition = make()
  const connectionReferences = {
    re_shared_commondataserviceforapps: { source: 'Embedded',
      connectionReferenceLogicalName: 're_shared_commondataserviceforapps',
      id: '/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps' },
    re_shared_office365: { source: 'Embedded', connectionReferenceLogicalName: 're_shared_office365',
      id: '/providers/Microsoft.PowerApps/apis/shared_office365' },
  }
  const original = { schemaVersion: '1.0.0.0', properties: { definition: {}, preserved: true, connectionReferences: {
    existingDataverseAlias: { connection: { connectionReferenceLogicalName: 're_shared_commondataserviceforapps' } },
  } } }
  const actual = toSolutionClientData({ definition, connectionReferences }, original)
  assert.equal(actual.properties.preserved, true)
  assert.equal(actual.schemaVersion, original.schemaVersion)
  assert.equal(actual.properties.connectionReferences.shared_office365.connection.connectionReferenceLogicalName, 're_shared_office365')
  assert.equal(actual.properties.connectionReferences.shared_office365.runtimeSource, 'embedded')
  assert.equal(actual.properties.definition.actions.Get_estimate.inputs.host.connectionName, 'existingDataverseAlias')
  assert.equal(actual.properties.definition.actions.Send_review_email.inputs.host.connectionName, 'shared_office365')
  assert.equal(actual.properties.definition.actions.Send_review_email.inputs.host.connectionReferenceName, undefined)
  assert.equal(definition.actions.Send_review_email.inputs.host.connectionReferenceName, 're_shared_office365')
  assert.equal(original.properties.definition.actions, undefined)
  assert.throws(() => toSolutionClientData({}, {}), /snapshot/)
})
