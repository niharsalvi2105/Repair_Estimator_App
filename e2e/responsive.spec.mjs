import { test, expect } from '@playwright/test'
import ExcelJS from 'exceljs'

const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 640, height: 700 },
  { width: 641, height: 700 },
  { width: 641, height: 641 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 1024, height: 640 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
]
const modes = [
  { language: 'en', theme: 'light' },
  { language: 'en', theme: 'dark' },
  { language: 'fr', theme: 'light' },
  { language: 'fr', theme: 'dark' },
]

async function mockData(page, language, theme, state = 'records') {
  await page.route('**/src/data/draftChoiceRepository.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export async function getDraftChoices() {
      window.__choiceCalls = (window.__choiceCalls || 0) + 1;
      if (window.__choiceError) throw new Error(window.__choiceError);
      const set = (...labels) => labels.map(([en, fr], i) => ({ value: 126110000 + i, en, fr }));
      const yesNo = set(['Yes','Oui'], ['No','Non']);
      const yesNoUnknown = set(['Yes','Oui'], ['No','Non'], ['Unknown','Inconnu']);
      return {
        re_workcenterrequest: set(['Route','Tournée'], ['Repair','Réparation']),
        re_hasbeenapproved: yesNoUnknown, re_nationalaccount: yesNoUnknown,
        re_emergency: yesNo, re_customerbudgeted: yesNo, re_consultantinvolved: yesNo,
        re_papertype: window.__paperTypeOptions || set(['Non KONE Paper','Papier non KONE'], ['Kone Paper','Papier KONE'], ['NA','S.O.']),
        re_competingbids: set(['None','Aucune'], ['Known','Connues'], ['Suspected','Soupçonnées'], ['Unknown','Inconnu']),
        re_proposallanguage: set(['English','Anglais'], ['French','Français']),
        re_timecategory: set(['Straight Time','Heures normales'], ['Double Time','Temps double']),
        re_billingplan: set(['50% / 50%','50 % / 50 %'], ['60% / 40%','60 % / 40 %'], ['Final 100%','Solde 100 %'], ['Other: See Notes','Autre : voir les notes']),
      };
    }`,
  }))
  await page.route('**/src/data/dashboardRepository.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export async function getDashboard(market, owner) {
      window.__dashboardCalls ??= [];
      window.__dashboardCalls.push({market,owner});
      const delay = window.__dashboardDelay || 0;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (window.__dashboardError) throw new Error(window.__dashboardError);
      const empty = window.__dashboardEmpty || market !== 126110000;
      return {
        mode:'dashboard',ownerId:owner,market,period:'all-time',generatedAt:'2026-10-26T11:15:58Z',
        total:empty ? 0 : 125,marginCount:empty ? 0 : 100,averageCmii:empty ? null : window.__dashboardAverage ?? -0.25,
        statuses:empty ? [] : window.__dashboardStatuses ?? [{status:126110000,count:100},{status:126110001,count:20},{status:126110002,count:5}],
        jobTypes:empty ? [] : [{id:'job',en:'Equipment repair',fr:'',count:120},
          {id:null,en:null,fr:null,count:5}]
      };
    }`,
  }))
  await page.route('**/src/generated/services/Re_repairestimatesService.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export class Re_repairestimatesService {
      static async get(id, options) {
        window.__pricingReads ??= [];
        window.__pricingReads.push({id,options});
        if (window.__pricingGate) await window.__pricingGate;
        if (window.__pricingDelay) await new Promise((resolve) => setTimeout(resolve, window.__pricingDelay));
        if (window.__pricingError) return {success:false,error:{message:window.__pricingError}};
        return {success:true,data:{
          versionnumber:Number(window.__draftSaved?.version || 1),
          _transactioncurrencyid_value:'test-currency',
          re_calculationversion:window.__pricingState || '2026.1',
          re_calculatedon:'2026-10-26T11:15:58Z',
          re_totaltruecost:16282.04,re_sellprice:25,re_suggestedprice:31807.21,
          re_basetargetcmii:0.55,re_recommendedcmii:0.4881022722,
          re_actualcmii:-650.2816,re_cmiivariance:-650.7697022722,
          re_amincentive:0,re_bdincentive:0,...window.__pricingOverrides
        }};
      }
    }`,
  }))
  await page.route('**/src/data/draftRepository.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `
      export { draftInputs } from '/src/data/draftContract.ts';
      export async function draftOperation(input) {
        window.__draftCalls ??= [];
        window.__draftCalls.push(structuredClone(input));
        if (window.__draftDelay) await new Promise((resolve) => setTimeout(resolve, window.__draftDelay));
        const failure = window.__draftFailure;
        if (failure && failure !== 'timeout-after-commit') throw new Error(failure);
        if (input.mode === 'load' || input.mode === 'clonesource') {
          if (!window.__draftSaved || window.__draftSaved.id !== input.id) throw new Error('Draft not found');
          return structuredClone(window.__draftSaved);
        }
        window.__draftSaved = { ...structuredClone(input),
          contactMaster:window.__contactMasterRecords?.find(row => row.id === input.contactId),
          status:input.mode === 'submit' ? 126110002 : 126110000,
          version:String(Number(window.__draftSaved?.version || 0) + 1),
          number:'0000000042', salesperson:'Original Salesperson', pricingState:window.__pricingState,
          equipment:input.equipment.map((e) => e.matched ? {...e,name:'Persisted equipment snapshot'}
            : window.__dropUnlistedDetails ? {...e,name:'',location:'',oem:'',age:null} : e),
          packages:input.packages.map((p) => {
            const packagePriced = input.materialLines?.some(m => m.packageId === p.id && m.pricingSource === 'package');
            const source = window.__extraPackages?.find(master => master.re_repairpackageid === p.id);
            return {...p,nameEn:'Persisted package snapshot',nameFr:'Forfait enregistré',scopeEn:'Persisted scope',
              ...(window.__dropPackageEquipment ? {equipmentNumbers:null} : {}),
              hours:packagePriced ? source.re_mechanichours : 2.5,
              material:packagePriced ? source.re_materialmisctaxcost : 125,
              ...(packagePriced ? {materialBeforeMarkup:source.re_materialbeforemarkup} : {})};
          }),
          laborLines:(input.laborLines || []).map((line) => ({...line,rate:line.rate ?? 200})),
          materialLines:input.materialLines || []
        };
        if (failure === 'timeout-after-commit') throw new Error('Timeout: outcome unknown');
        return structuredClone(window.__draftSaved);
      }`,
  }))
  await page.route('**/src/generated/services/Re_DraftEstimateService.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export class Re_DraftEstimateService {
      static async re_DraftEstimate(json) {
        const input = JSON.parse(json);
        if (input.mode === 'accountsearch' || input.mode === 'contactsearch') {
          window.__masterSearchCalls ??= [];
          window.__masterSearchCalls.push(structuredClone(input));
          if (input.mode === 'contactsearch' && !input.search && window.__defaultsGate) await window.__defaultsGate;
          if (window.__masterSearchError) throw new Error(window.__masterSearchError);
          if (window.__masterSearchDelay) await new Promise(resolve => setTimeout(resolve, window.__masterSearchDelay));
          const account = {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',number:'00042',name:'Acme Corporation',market:126110000};
          const contact = {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Draft customer',
            email:'draft@example.invalid',phone:'1234567890',accountId:account.id};
          const starts = (value, query) => (value || '').toLowerCase().startsWith((query || '').toLowerCase());
          const result = input.mode === 'accountsearch'
            ? {accounts:(window.__accountMasterRecords || [account]).filter(row => row.market === input.market &&
                (starts(row.number,input.search) || starts(row.name,input.search))).slice(0,20)}
            : {contacts:(window.__contactMasterRecords || [contact]).filter(row => row.accountId === input.accountId &&
                (starts(row.name,input.search) || starts(row.email,input.search))).slice(0,20),
                contactsTruncated:!!window.__contactsTruncated,
                locations:window.__accountLocations?.[input.accountId] || [],
                locationsTruncated:!!window.__locationsTruncated,
                locationDescriptions:window.__accountLocationDescriptions?.[input.accountId] || [],
                locationOptions:window.__accountLocationOptions?.[input.accountId] ||
                  (window.__accountLocationDescriptions?.[input.accountId] || []).map((name,index) => ({
                    number:window.__accountLocations?.[input.accountId]?.[index] || 'FL' + String(index + 1).padStart(8,'0'),name
                  })),
                locationNamesUnavailable:!!window.__locationNamesUnavailable,
                locationDescriptionsTruncated:!!window.__locationDescriptionsTruncated,
                locationDescriptionsTooLong:!!window.__locationDescriptionsTooLong};
          (window.__masterSearchCompleted ??= []).push(structuredClone(input));
          return {success:true,data:{ResultJson:JSON.stringify(result)}};
        }
        if (input.mode.startsWith('contract')) {
          (window.__contractCalls ??= []).push(structuredClone(input));
          if (window.__contractError) throw new Error(window.__contractError);
          const result = { mode:'contracts',available:!!window.__contractEnabled,
            reason:window.__contractEnabled ? null : 'Contract lookup unavailable: deploy mapping columns and approved data.',
            more:false,contracts:[],notFound:[],equipment:[] };
          if (!result.available || input.mode === 'contractcapabilities')
            return {success:true,data:{ResultJson:JSON.stringify(result)}};
          if (input.mode === 'contractsearch') {
            result.contracts = Object.keys(window.__contractMap || {}).filter(n =>
              n.toLowerCase().includes((input.search || '').toLowerCase())).slice(0,20);
          }
          if (input.mode === 'contractresolve') {
            if (window.__contractResolveDelay) await new Promise(resolve => setTimeout(resolve, window.__contractResolveDelay));
            if (window.__contractResolveError) throw new Error(window.__contractResolveError);
            const seen = new Set();
            for (const number of input.contractNumbers) {
              const rows = window.__contractMap?.[number] || [];
              if (!rows.length) result.notFound.push(number);
              for (const row of rows) if (!seen.has(row.id)) { result.equipment.push(row); seen.add(row.id); }
            }
          }
          return {success:true,data:{ResultJson:JSON.stringify(result)}};
        }
        if (input.mode.startsWith('preset')) {
          window.__presetCalls ??= [];
          window.__presetCalls.push(structuredClone(input));
          if (window.__presetFailure) throw new Error(window.__presetFailure);
          window.__presets ??= [];
          let presets = [];
          if (input.mode === 'presetlist') presets = window.__presets.filter(row => row.opportunity.market === input.market);
          if (input.mode === 'presetsave') {
            presets = [{id:crypto.randomUUID(),name:input.presetName,opportunity:input.opportunity}];
            window.__presets.push(...presets);
          }
          if (input.mode === 'presetdelete') window.__presets = window.__presets.filter(row => row.id !== input.id);
          return {success:true,data:{ResultJson:JSON.stringify({mode:'presets',presets,nextToken:null})}};
        }
        window.__catalogRequests ??= [];
        window.__catalogRequests.push(input);
        if (window.__catalogFailure) throw new Error(window.__catalogFailure);
        if (!['partcapabilities','partcatalog'].includes(input.mode)) throw new Error('Unsupported mock catalog operation');
        const base = {mode:'partcatalog',available:!!window.__catalogEnabled,
          reason:window.__catalogEnabled ? null : 'Catalog schema and approved data not deployed.',
          currency:'USD',defaultMarkupPercent:10,more:false,parts:[]};
        if (input.mode === 'partcatalog' && window.__catalogEnabled) {
          base.parts = input.search.startsWith('NONE') ? [] : [{
            id:window.__badCatalogId || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',number:'TEST-PART-001',description:'Test catalog motor',
            partType:input.partType,unitCost:7.73178,unitPrice:40.376,uom:'PC'
          }];
        }
        return {success:true,data:{ResultJson:JSON.stringify(base)}};
      }
    }`,
  }))
  await page.route('**/src/data/sessionRepository.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export async function loadSession() { return {
      displayName:'Responsive Test User', userId:'11111111-1111-1111-1111-111111111111',
      role:window.__sessionRole || 'admin', canReadEstimates:true, canStartEstimate:true, developmentAdminOverride:true
    } }`,
  }))
  await page.route('**/src/generated/services/Re_appuserpreferencesService.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `const record = {
      re_appuserpreferenceid:'test-pref', re_name:'Test', statecode:0,
      re_preferredlanguage:${language === 'fr' ? 126110001 : 126110000},
      re_preferredlocale:'${language === 'fr' ? 'fr-CA' : 'en-US'}',
      re_preferredtheme:${theme === 'dark' ? 126110001 : 126110002}
    };
    export class Re_appuserpreferencesService {
      static async getAll() { return { success:true, data:[record] } }
      static async update(id, fields) { Object.assign(record, fields); return { success:true, data:record } }
    }`,
  }))
  await page.route('**/src/data/repairEstimatorRepository.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `
      const name = 'Long branch name / Succursale de démonstration';
      const referenceCall = (name) => { (window.__referenceCalls ??= []).push(name); };
      export async function getBranchCustomerNames(branchId) {
        (window.__customerCalls ??= []).push(branchId);
        if (window.__customerDelay) await new Promise((resolve) => setTimeout(resolve, window.__customerDelay));
        if (window.__customerError) throw new Error(window.__customerError);
        return window.__customerNames || ['Acme Customer', 'Beta Customer'];
      }
      export async function getBranches() { referenceCall('branches'); return window.__branches || [{
        re_branchid:'test-branch', re_branchname:name, re_branchnumber:'020',
        re_market:126110000, _re_country_value:'test-country',
        _re_currency_value:'test-currency', _re_stateprovince_value:'test-state'
      }] }
      export async function getDraftReferences() { referenceCall('draft'); return {
        states:[{id:'test-state',en:'Test province',fr:'Province test',countryId:'test-country',frenchRequired:false}],
        currencies:[{id:'test-currency',code:window.__currencyCode || 'USD'}]
      } }
      export async function getRequestReferences() { referenceCall('request'); return {
        equipmentTypes:[{id:'test-type',en:'Passenger elevator',fr:'Ascenseur pour passagers'}],
        jobTypes:[{id:'test-job',en:'Equipment repair',fr:'Réparation d’équipement'}]
      } }
      export async function getPackageCostRates() {
        if (window.__rateError) throw new Error(window.__rateError);
        return [0,1,2].flatMap(role => [0,1].map(time => ({role:126110000+role,time:126110000+time,rate:window.__largeRates ? 9999999999.99 : 100+role*50+time*75})));
      }
      export async function searchEquipment() { return window.__equipmentResults || [{
        re_equipmentid:'test-equipment', re_equipment:'TEST123',
        re_equipmentname:'Equipment with a long descriptive name / Équipement avec un nom long',
        re_functionallocation:'Test location', re_soldtoname:'Customer with a long descriptive name',
        re_oem:'Test OEM', re_equipmentage:20
      }] }
      export async function findEquipmentByNumbers(branchId, numbers) {
        window.__equipmentLookups ??= [];
        window.__equipmentLookups.push({ branchId, numbers });
        const gate = window.__equipmentLookupGates?.[numbers[0]];
        if (gate) {
          const error = await gate;
          if (error) throw new Error(error);
        }
        if (window.__equipmentLookupError) throw new Error(window.__equipmentLookupError);
        if (window.__equipmentLookupDelay) await new Promise(resolve => setTimeout(resolve, window.__equipmentLookupDelay));
        if (window.__equipmentResults) return window.__equipmentResults.filter((item) => numbers.includes(item.re_equipment));
        return numbers.filter((n) => n === 'TEST123').map(() => ({
          re_equipmentid:'test-equipment', re_equipment:'TEST123', re_equipmentname:'Equipment with a long descriptive name / Équipement avec un nom long',
          re_functionallocation:'Test location', re_soldtoname:'Customer with a long descriptive name', re_oem:'Test OEM', re_equipmentage:20
        }))
      }
      export async function listPackages() { return [{
        re_repairpackageid:'test-package',re_packagenumber:'PKG001',
        re_packagenameen:'Repair package with a long descriptive name',
        re_packagenamefr:'Forfait de réparation avec un long nom descriptif',
        re_mechanichours:2,re_materialmisctaxcost:50,
        re_proposalscopeen:'Representative scope text for responsive layout testing.',
        re_effectivefrom:'2020-01-01'
      }, ...(window.__extraPackages || [])] }
      export async function listEstimates(options) {
        window.__estimateQueries ??= [];
        window.__estimateQueries.push(structuredClone(options));
        ${state === 'error' ? "throw new Error('Representative permission or connection failure for responsive testing.')" : ''}
        return {records:${state === 'empty' ? '[]' : `[{
          re_repairestimateid:window.__draftSaved?.id || 'test-estimate',re_name:'RE-TEST-0001',
          re_estimatename:'Request with a long name / Demande avec un nom long',
          re_customername:'Customer / Client avec un long nom représentatif',
          re_buildingname:'Building / Immeuble avec un long nom représentatif',
          re_estimatestatus:126110000,createdon:'2026-01-01T12:00:00Z'
        }].flatMap((record) => Array.from({length:window.__estimateRecordCount || 1}, (_, index) =>
          ({...record,re_repairestimateid:record.re_repairestimateid + (index ? '-' + index : '')})))`},skipToken:options.skipToken ? undefined : 'next-page'}
      }`,
  }))
}

async function checkLayout(page, viewport, stage) {
  const metrics = await page.evaluate(() => {
    const sidebar = document.querySelector('.sidebar')
    const nav = document.querySelector('.main-nav')
    const sideRect = sidebar.getBoundingClientRect()
    const navRect = nav.getBoundingClientRect()
    const buttons = [...nav.querySelectorAll('button')].filter((el) => el.getClientRects().length)
    const footer = sidebar.querySelector('.sidebar-bottom')
    const footerVisible = footer.getClientRects().length > 0
    return {
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      overflowingElements: [...document.querySelectorAll('body *')].filter((el) => {
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1)
      }).map((el) => `${el.tagName}.${el.className}`).slice(0, 15),
      sidebarOverflow: sidebar.scrollHeight > sidebar.clientHeight + 1,
      sidebarScrollStyle: getComputedStyle(sidebar).overflowY,
      position: getComputedStyle(sidebar).position,
      left: sideRect.left,
      width: sideRect.width,
      top: sideRect.top,
      bottom: sideRect.bottom,
      navFits: navRect.top >= sideRect.top - 1 && navRect.bottom <= sideRect.bottom + 1,
      footerFits: !footerVisible || (footer.getBoundingClientRect().top >= navRect.bottom - 1
        && footer.getBoundingClientRect().bottom <= sideRect.bottom + 1),
      rowsHorizontal: buttons.every((el) => getComputedStyle(el).flexDirection === 'row'),
      targetsAccessible: buttons.every((el) => {
        const rect = el.getBoundingClientRect()
        return rect.height >= 44 && rect.width >= 44
      }),
      labelsFit: buttons.every((el) => el.scrollWidth <= el.clientWidth + 1
        && el.scrollHeight <= el.clientHeight + 1),
      headerTargetsAccessible: [...document.querySelectorAll('header select, header input, header button')].every((el) => {
        const rect = el.getBoundingClientRect()
        return rect.height >= 44 && rect.width >= 44
      }),
    }
  })

  expect(metrics.horizontalOverflow, `${stage}: page horizontal overflow: ${metrics.overflowingElements.join(', ')}`).toBe(false)
  expect(metrics.sidebarOverflow, `${stage}: navigation overflow`).toBe(false)
  expect(metrics.sidebarScrollStyle, `${stage}: independent navigation scrolling`).toBe('visible')
  expect(metrics.navFits, `${stage}: navigation fits available height`).toBe(true)
  expect(metrics.footerFits, `${stage}: sidebar identity does not overlap navigation`).toBe(true)
  expect(metrics.labelsFit, `${stage}: navigation labels are not clipped`).toBe(true)
  expect(metrics.targetsAccessible, `${stage}: navigation target height`).toBe(true)
  expect(metrics.headerTargetsAccessible, `${stage}: header control target sizes`).toBe(true)
  expect(metrics.left).toBe(0)
  if (viewport.width > 640) {
    await expect(page.locator('.brand-copy strong')).toBeVisible()
    await expect(page.locator('.brand-copy small')).toBeVisible()
    expect(metrics.position, `${stage}: laptop/tablet must retain left navigation`).toBe('sticky')
    expect(metrics.width).toBeLessThanOrEqual(240)
    expect(metrics.rowsHorizontal, `${stage}: icon and text must stay side by side`).toBe(true)
  } else {
    expect(metrics.position).toBe('fixed')
    expect(metrics.bottom).toBeCloseTo(viewport.height, 0)
    expect(metrics.top).toBeGreaterThan(0)
  }
  await expect(page.locator('header')).toBeVisible()
  for (const card of await page.locator('.request-record').all()) {
    const action = card.locator('.request-record-actions button')
    if (!await action.count()) continue
    const badge = card.locator('.preview-badge')
    const buttonRect = await action.first().boundingBox()
    const badgeRect = await badge.boundingBox()
    // DOMRect subtraction can report 43.99994 for an exact 44px layout height.
    expect(Math.round(buttonRect.height * 1000) / 1000).toBeGreaterThanOrEqual(44)
    const sameRow = Math.abs((buttonRect.y + buttonRect.height / 2) - (badgeRect.y + badgeRect.height / 2)) <= 1
    expect(sameRow || buttonRect.y >= badgeRect.y + badgeRect.height,
      `${stage}: draft action aligns beside status or stacks below it in narrow cards`).toBe(true)
    if (!await card.locator('xpath=ancestor::*[contains(@class,"recent-estimate-list")]').count() || viewport.width <= 1100) {
      const detailsRect = await card.locator('.request-record-details').boundingBox()
      expect(buttonRect.y + buttonRect.height, `${stage}: action stays clear of details`).toBeLessThanOrEqual(detailsRect.y)
    } else {
      const details = card.locator('.request-record-details dd')
      for (const detail of await details.all()) {
        const rect = await detail.boundingBox()
        expect(rect.x + rect.width, `${stage}: compact detail stays clear of actions`).toBeLessThanOrEqual(buttonRect.x)
      }
    }
  }
}

async function next(page) {
  await page.locator('.footer-actions .button').click()
}

async function selectCustomerMasters(page, accountQuery = 'Acme', contactQuery = 'Draft') {
  await page.locator('#account-master-search').fill(accountQuery)
  await page.locator('#account-master-options button').first().click()
  await expect(page.locator('.customer-defaults-state')).not.toContainText(/Fetching linked|Chargement des données/)
  if (await page.locator('#customer-name').getAttribute('readonly') !== null)
    await page.getByRole('button', { name: /^(Change Contact|Changer de contact)$/ }).click()
  await page.locator('#customer-name').fill(contactQuery)
  await page.locator('#customer-name-options button').first().click()
}

for (const viewport of viewports) {
  for (const { language, theme } of modes) {
    test(`${viewport.width}x${viewport.height} ${language} ${theme}: dashboard, lists and full form`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await mockData(page, language, theme)
      await page.goto('/')
      const market = page.locator('.market-control select')
      await expect(market).toBeEnabled()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expect(page.locator('.request-record')).toHaveCount(1)
      await expect(page.locator('.dashboard-stats strong').first()).toHaveText('125')
      const logo = page.locator('.brand-logo')
      await expect(logo).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
      await expect.poll(() => logo.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true)
      await checkLayout(page, viewport, 'dashboard')

      await page.locator('.main-nav .nav-item').nth(2).click()
      await expect(page.locator('.request-record')).toHaveCount(1)
      await page.locator('.request-pagination button').last().click()
      await expect(page.locator('.request-pagination > span')).toContainText('2')
      await checkLayout(page, viewport, 'request list page 2')

      await page.locator('.main-nav .nav-item').nth(1).click()
      const opportunity = page.locator('.opportunity-card')
      await expect(opportunity.locator('fieldset > legend')).toHaveCount(3)
      await expect(page.locator('#salesperson')).toHaveAttribute('readonly', '')
      await expect(page.locator('#equipment-type')).toHaveAttribute('aria-required', 'true')
      await expect(page.locator('#opportunity-building')).toHaveAttribute('aria-required', 'true')
      expect(await opportunity.evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(1120)
      const fieldMetrics = await opportunity.locator('.text-input').evaluateAll((fields) => fields.map((el) => ({
        height: el.getBoundingClientRect().height,
        width: el.getBoundingClientRect().width,
        fontSize: parseFloat(getComputedStyle(el).fontSize),
      })))
      expect(fieldMetrics.every((field) => field.height >= 44 && field.width >= 44)).toBe(true)
      if (viewport.width <= 640) expect(fieldMetrics.every((field) => field.fontSize >= 16)).toBe(true)
      const branch = page.locator('#branch-select')
      await page.locator('#estimate-title').fill('Responsive opportunity')
      await branch.fill('020')
      await expect(page.locator('#branch-options')).toBeVisible()
      await checkLayout(page, viewport, 'branch search open')
      await branch.press('ArrowDown')
      await branch.press('Enter')
      await page.locator('#equipment-type').selectOption('test-type')
      await page.locator('#opportunity-building').fill('Test building / Immeuble de démonstration')
      await selectCustomerMasters(page)
      await expect(page.locator('#customer-email')).toHaveValue('draft@example.invalid')
      await checkLayout(page, viewport, 'opportunity')
      await next(page)

      await page.locator('#equipment-search').fill('TEST')
      await expect(page.locator('#equipment-options [role=option]')).toHaveCount(2)
      await checkLayout(page, viewport, 'equipment results')
      await page.locator('#equipment-options button').first().click()
      await page.locator('#package-search').fill('PK')
      await expect(page.locator('#package-options [role=option]')).toHaveCount(1)
      await checkLayout(page, viewport, 'package results')
      await page.locator('#package-options button').first().click()
      await page.locator('#package-search').press('Escape')
      await checkLayout(page, viewport, 'equipment and packages selected')
      await next(page)

      await expect(page.locator('#request-re_additionallaborhours')).toBeEditable()
      await expect(page.locator('#request-re_additionalmaterial')).toBeEditable()
      await checkLayout(page, viewport, 'cost inputs')
      await next(page)
      await page.locator('#request-re_sellprice').fill('1500')
      await page.locator('#request-re_margincomments').fill('Representative margin comment / Commentaire représentatif.')
      await checkLayout(page, viewport, 'pricing')
      await next(page)
      await expect(page.locator('.customer-summary')).toContainText('Draft customer')
      await page.locator('details').evaluateAll((details) => details.forEach((el) => { el.open = true }))
      await checkLayout(page, viewport, 'expanded review')
      await expect(page.locator('.footer-actions .button')).toBeEnabled()
      await page.locator('.form-footer > button').click()
      await expect(page.locator('#request-re_sellprice')).toHaveValue('1500.00')
    })
  }
}

for (const state of ['empty', 'error']) {
  test(`320px French dark request-list ${state} state`, async ({ page }) => {
    const viewport = { width: 320, height: 568 }
    await page.setViewportSize(viewport)
    await mockData(page, 'fr', 'dark', state)
    await page.goto('/')
    await expect(page.locator('.market-control select')).toBeEnabled()
    await page.locator('.main-nav .nav-item').nth(2).click()
    await expect(page.locator(state === 'error' ? '.estimate-list .error-box' : '.estimate-list .inline-state')).toBeVisible()
    await checkLayout(page, viewport, `request list ${state}`)
  })
}

test('form references are deferred until an estimate opens and reused across workspace navigation', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await page.goto('/')
  await expect(page.locator('.recent-card .request-record')).toHaveCount(1)
  expect(await page.evaluate(() => window.__referenceCalls ?? [])).toEqual([])
  const logo = page.locator('.brand-logo')
  await expect(logo).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
  expect(await logo.evaluate((image) => image.complete && image.naturalWidth === 576)).toBe(true)
  await page.getByRole('button', { name: 'New repair request', exact: true }).click()
  await expect(page.locator('#branch-select')).toBeVisible()
  await expect(page.locator('#equipment-type option')).toHaveCount(2)
  await expect.poll(() => page.evaluate(() => window.__referenceCalls?.length)).toBe(3)
  await page.locator('.main-nav').getByRole('button', { name: 'Dashboard', exact: true }).click()
  await expect(page.locator('.recent-card .request-record')).toHaveCount(1)
  await page.getByRole('button', { name: 'New repair request', exact: true }).click()
  await expect(page.locator('#equipment-type option')).toHaveCount(2)
  expect(await page.evaluate(() => window.__referenceCalls.toSorted())).toEqual(['branches', 'draft', 'request'])
})

test('master searches, paging and status changes do not reload table metadata', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await mockMasterData(page)
  await page.goto('/')
  await page.locator('.main-nav').getByRole('button', { name: 'Master Data', exact: true }).click()
  await expect(page.locator('.master-record')).toHaveCount(1)
  expect(await page.evaluate(() => window.__masterMetadataCalls)).toEqual(['re_repairpackage'])
  await page.locator('.master-search input').fill('PKG')
  await expect.poll(() => page.evaluate(() => window.__masterQueries.at(-1)?.search)).toBe('PKG')
  await expect(page.locator('.master-record')).toHaveCount(1)
  await page.locator('.master-workspace').getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.locator('.request-pagination')).toContainText('Page 2')
  await expect(page.locator('.master-record')).toHaveCount(1)
  await page.locator('.master-filters').getByLabel('Status', { exact: true }).selectOption('1')
  await expect.poll(() => page.evaluate(() => window.__masterQueries.at(-1)?.status)).toBe('1')
  await expect(page.locator('.master-record')).toHaveCount(1)
  expect(await page.evaluate(() => window.__masterMetadataCalls)).toEqual(['re_repairpackage'])
  await page.locator('.master-filters').getByLabel('Table', { exact: true }).selectOption('re_country')
  await expect(page.locator('.master-record')).toHaveCount(1)
  expect(await page.evaluate(() => window.__masterMetadataCalls)).toEqual(['re_repairpackage', 're_country'])
})

test('only the selected master table downloads its compact field definitions', async ({ page }) => {
  const requests = []
  page.on('request', (request) => requests.push(decodeURIComponent(request.url())))
  await mockData(page, 'en', 'light')
  await mockMasterData(page)
  await page.goto('/')
  await expect(page.locator('.recent-card .request-record')).toHaveCount(1)
  expect(requests.some((url) => url.includes('EstimatorWorkspace.tsx'))).toBe(false)
  expect(requests.some((url) => url.includes('.Schema.json'))).toBe(false)
  await page.locator('.main-nav').getByRole('button', { name: 'Package Details', exact: true }).click()
  await expect(page.locator('.master-record')).toHaveCount(1)
  const fieldRequests = () => requests.filter((url) => url.includes('.Schema.json') && new URL(url).searchParams.has('master-fields'))
  expect(fieldRequests()).toHaveLength(1)
  expect(fieldRequests()[0]).toContain('/repairpackages.Schema.json')
  expect(requests.some((url) => /(?:repairestimates|securityroles|estimatepackages)\.Schema\.json/.test(url))).toBe(false)
  await page.locator('.main-nav').getByRole('button', { name: 'Master Data', exact: true }).click()
  await expect(page.locator('.master-record')).toHaveCount(1)
  expect(fieldRequests()).toHaveLength(1)
  await page.locator('.master-filters').getByLabel('Table', { exact: true }).selectOption('re_country')
  await expect(page.locator('.master-list-toolbar h2')).toHaveText('Countries')
  expect(fieldRequests()).toHaveLength(2)
  expect(fieldRequests()[1]).toContain('/countries.Schema.json')
})

test('lookup options load on focus or search, preserve selected labels and surface retryable errors', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await mockMasterData(page)
  await page.goto('/')
  await page.locator('.main-nav').getByRole('button', { name: 'Master Data', exact: true }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const country = page.getByLabel('Country', { exact: true })
  await expect(country.locator('option:checked')).toHaveText('United States')
  expect(await page.evaluate(() => window.__masterLookupQueries ?? [])).toEqual([])
  await country.focus()
  await expect.poll(() => page.evaluate(() => window.__masterLookupQueries?.length)).toBe(1)
  await expect(country.locator('option:checked')).toHaveText('United States')
  await page.evaluate(() => { window.__masterError = 'Lookup permission denied' })
  await page.getByLabel('Search reference: Country', { exact: true }).fill('Can')
  await expect(page.locator('.master-lookup [role=alert]')).toContainText('Lookup permission denied')
  await expect(country.locator('option:checked')).toHaveText('United States')
  await page.evaluate(() => { window.__masterError = '' })
  await page.locator('.master-lookup').getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.master-lookup [role=alert]')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => window.__masterLookupQueries.at(-1)?.search)).toBe('Can')
  expect(await page.evaluate(() => window.__masterWrites ?? [])).toEqual([])
})

test('compact schema download failures can be retried without an app reload', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await mockMasterData(page)
  let failed = false
  await page.route('**/repairpackages.Schema.json*', (route) => {
    if (new URL(route.request().url()).searchParams.has('master-fields') && !failed) {
      failed = true
      return route.abort()
    }
    return route.continue()
  })
  await page.goto('/')
  await page.locator('.main-nav').getByRole('button', { name: 'Package Details', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Dataverse operation failed.')
  await expect(page.locator('.master-record')).toHaveCount(0)
  await page.getByRole('alert').getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.master-record')).toHaveCount(1)
})

test('lazy workspace failures show an explicit error and can be retried', async ({ page }) => {
  await mockData(page, 'en', 'light')
  let failed = false
  await page.route('**/src/EstimatorWorkspace.tsx*', (route) => {
    if (!failed) { failed = true; return route.abort() }
    return route.continue()
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'New repair request', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Could not load this workspace.')
  await page.getByRole('alert').getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('#estimate-title')).toBeVisible()
})

for (const theme of ['light', 'dark']) {
  test(`initials avatar: ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    const photoRequests = []
    page.on('request', (request) => {
      if (/office365users|\/photo(?:\/|\?|$)/i.test(request.url())) photoRequests.push(request.url())
    })
    await mockData(page, 'en', theme)
    await page.goto('/')
    const avatar = page.locator('.user-avatar')
    await expect(avatar).toBeVisible()
    await expect(avatar).toHaveText('RU')
    await expect(avatar).toHaveAttribute('aria-label', 'Responsive Test User')
    await expect(avatar.locator('img')).toHaveCount(0)
    const geometry = await avatar.evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
      radius: getComputedStyle(el).borderRadius,
    }))
    expect(geometry).toEqual({ width: 44, height: 44, radius: '50%' })
    expect(photoRequests).toEqual([])
  })
}

async function changeLanguageInSettings(page, language) {
  await page.locator('.main-nav').getByRole('button', { name: /^(Settings|Paramètres)$/ }).click()
  await page.getByLabel(/^(Language|Langue)$/).selectOption(language)
  await expect(page.getByLabel(/^(Language|Langue)$/)).toBeEnabled()
  await page.getByRole('button', { name: /^(Return to workspace|Retour à l’espace de travail)$/ }).click()
}

for (const scenario of [
  { names: ['Repair Estimator - Admin'], label: 'Admin', master: true, create: true, read: true },
  { names: ['Repair Estimator - Estimator'], label: 'Estimator', master: false, create: true, read: true },
  { names: ['Repair Estimator - Estimator', 'Repair Estimator - Admin'], label: 'Admin', master: true, create: true, read: true },
  { names: ['System Administrator'], label: 'Access not verified', master: false, create: false, read: false },
  { names: ['Repair Estimator - Estimator'], label: 'Estimator', master: false, create: false, read: true },
  { names: ['Repair Estimator - Admin'], label: 'Admin', master: true, create: false, read: false },
  { names: [], label: 'Access not verified', master: false, create: false, read: false, error: true },
]) {
  test(`live role startup: ${scenario.names.join('+') || 'role lookup failure'} read=${scenario.read} create=${scenario.create}`, async ({ page }) => {
    await mockData(page, 'en', 'light')
    await page.unroute('**/src/data/sessionRepository.ts*')
    await page.route('**/@microsoft_power-apps_app.js*', (route) => route.fulfill({
      contentType: 'application/javascript',
      body: `export async function getContext() { return {user:{objectId:'directory-user',
        systemUserId:'11111111-1111-1111-1111-111111111111',fullName:'Role Test User'}} }`,
    }))
    await page.route('**/src/generated/services/RetrieveAadUserRolesService.ts*', (route) => route.fulfill({
      contentType: 'application/javascript',
      body: `export class RetrieveAadUserRolesService { static async RetrieveAadUserRoles(id) {
        window.__roleLookupId=id;
        return ${scenario.error ? "{success:false,error:{message:'Role lookup denied',status:403}}" :
          JSON.stringify({ success: true, data: { value: scenario.names.map((name) => ({ name })) } })};
      } }`,
    }))
    await page.route('**/src/generated/services/Re_repairestimatesService.ts*', (route) => route.fulfill({
      contentType: 'application/javascript',
      body: `export class Re_repairestimatesService { static async getMetadata() {
        return {success:true,data:{Privileges:[{PrivilegeType:2,Name:'actualReadPrivilege'},
          {PrivilegeType:1,Name:'actualCreatePrivilege'}]}};
      } }`,
    }))
    await page.route('**/src/generated/services/RetrieveUserPrivilegeByPrivilegeNameService.ts*', (route) => route.fulfill({
      contentType: 'application/javascript',
      body: `export class RetrieveUserPrivilegeByPrivilegeNameService {
        static async RetrieveUserPrivilegeByPrivilegeName(user,name) {
          (window.__privilegeChecks ??= []).push({user,name});
          const granted=name==='actualReadPrivilege' ? ${scenario.read} : ${scenario.create};
          return {success:true,data:{RolePrivileges:granted ? [{PrivilegeId:'privilege',Depth:0}] : []}};
        }
      }`,
    }))
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => window.__roleLookupId)).toBe('directory-user')
    if (scenario.error) await expect(page.getByRole('alert')).toContainText('Role lookup denied')
    else await expect(page.locator('.role-label')).toHaveText(scenario.label)
    await expect(page.locator('.main-nav').getByRole('button', { name: 'Master Data', exact: true })).toHaveCount(scenario.master ? 1 : 0)
    const start = page.locator('.main-nav').getByRole('button', { name: 'New Request', exact: true })
    if (scenario.create && scenario.read) await expect(start).toBeEnabled()
    else await expect(start).toBeDisabled()
    await expect(page.getByText('Local testing: Admin UI override is active.', { exact: false })).toHaveCount(0)
    if (!scenario.names.some((name) => name.startsWith('Repair Estimator - '))) {
      expect(await page.evaluate(() => window.__privilegeChecks || [])).toEqual([])
    }
  })
}

async function mockMasterData(page) {
  await page.route('**/src/data/masterDataRepository.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `
      import { loadMasterTable, buildMasterChanges } from '/src/data/masterDataSchema.ts';
      const id = '22222222-2222-2222-2222-222222222222';
      const reference = '33333333-3333-3333-3333-333333333333';
      function row(table) { return { [table.id]:id, [table.primary]:'PKG001',
        re_packagenameen:'Motor package',re_packagenamefr:null,re_proposalscopeen:'Replace the motor safely.',
        re_proposalscopefr:'',re_mechanichours:2.5,re_materialmisctaxcost:125,
        _re_country_value:reference,
        '_re_country_value@OData.Community.Display.V1.FormattedValue':'United States',
        statecode:0, ...window.__masterSaved }; }
      function fail() { if (window.__masterError) throw new Error(window.__masterError); }
      export async function getMasterMetadata(name) {
        (window.__masterMetadataCalls ??= []).push(name);
        fail();
        const table = await loadMasterTable(name);
        const allowed = ['re_packagenumber','re_packagenameen','re_packagenamefr','re_proposalscopeen',
          're_proposalscopefr','re_mechanichours','re_materialmisctaxcost','re_country'];
        return { ...table, fields:table.fields.filter((f) => name !== 're_repairpackage' || allowed.includes(f.name))
          .map((f) => ({...f,target:f.name === 're_country' ? 're_countries' : f.target})) };
      }
      export async function listMasterRecords(name, search, status, skipToken) {
        window.__masterQueries ??= []; window.__masterQueries.push({name,search,status,skipToken});
        fail();
        const table = await loadMasterTable(name);
        return { records:window.__masterEmpty ? [] : Array.from({length:window.__masterRecordCount || 1}, (_, index) =>
          ({...row(table),[table.id]:index ? id.slice(0,-1)+index : id,
            ...(window.__masterLongName ? {re_packagenameen:window.__masterLongName} : {})})),
          skipToken:skipToken ? undefined : 'master-next' };
      }
      export async function getMasterRecord(table, recordId) {
        fail();
        window.__masterReads ??= []; window.__masterReads.push(recordId);
        return {...row(table),[table.id]:recordId};
      }
      export async function searchMasterLookup(entitySet, search) {
        (window.__masterLookupQueries ??= []).push({entitySet,search});
        fail(); return {records:window.__lookupEmpty ? [] : [{id:reference,label:'United States'}],more:true};
      }
      export async function saveMasterRecord(table, recordId, values, original) {
        window.__masterWrites ??= [];
        window.__masterWrites.push({recordId,changes:buildMasterChanges(table,values,original)});
        if (window.__masterDelay) await new Promise((resolve) => setTimeout(resolve, window.__masterDelay));
        if (window.__masterWriteError) throw new Error(window.__masterWriteError);
        fail();
        window.__masterSaved = { ...row(table), ...(!original ? {statecode:0} : {}),
          ...window.__masterWrites.at(-1).changes,[table.id]:recordId };
      }
      export async function setMasterActive(table, recordId, active) {
        window.__masterStates ??= []; window.__masterStates.push({recordId,active});
        fail(); window.__masterSaved = {...row(table),statecode:active ? 0 : 1};
      }
    `,
  }))
}

for (const [format, text] of [
  ['comma', '20000711,20000712,20000713'],
  ['semicolon', '20000711;20000712;20000713'],
  ['space', '20000711 20000712 20000713'],
  ['newline', '20000711\n20000712\n20000713'],
  ['mixed and duplicates', ' 20000711, ;20000712\r\n20000711 20000713; '],
  ['duplicates only', ' 20000711\n20000711 '],
  ['over fifty', Array.from({ length: 60 }, (_, i) => String(20000711 + i)).join('\n')],
]) {
  test(`equipment paste automatically matches ${format} input and preserves details`, async ({ page }) => {
    await completeDraft(page, { width: 1366, height: 768 }, 'en')
    for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
    const numbers = [...new Set(text.trim().split(/[,;\s]+/).filter(Boolean))]
    await page.evaluate((values) => {
      window.__equipmentLookups = []
      window.__equipmentResults = values.map((number) => ({
        re_equipmentid: `equipment-${number}`, re_equipment: number,
        re_equipmentname: `Catalog ${number}`, re_functionallocation: `Location ${number}`,
        re_soldtoname: `Customer ${number}`, re_oem: 'Test OEM', re_equipmentage: 20,
      }))
    }, numbers)
    await page.locator('#equipment-search').focus()
    await page.evaluate((value) => {
      const data = new DataTransfer()
      data.setData('text', value)
      document.querySelector('#equipment-search').dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
    }, text)
    const cards = page.locator('.selected-card').first().locator('.equipment-card')
    await expect(cards).toHaveCount(numbers.length + 1)
    for (const number of numbers) {
      const card = cards.filter({ hasText: `Catalog ${number}` })
      await expect(card).toHaveCount(1)
      await expect(card).toContainText(`Location ${number}`)
      await expect(card).toContainText(`Customer ${number}`)
    }
    await expect(cards.locator('.unbound-tag')).toHaveCount(0)
    await expect(page.locator('#equipment-search')).toHaveValue('')
    const matchingBatches = Math.ceil(numbers.length / 50)
    await expect.poll(() => page.evaluate(() => window.__equipmentLookups.length)).toBe(matchingBatches * 2)
    const lookups = await page.evaluate(() => window.__equipmentLookups)
    expect(lookups.slice(0, matchingBatches).flatMap((lookup) => lookup.numbers)).toEqual(numbers)
    expect(lookups.slice(matchingBatches).flatMap((lookup) => lookup.numbers)).toEqual(numbers)
    expect(lookups.every((lookup) => lookup.branchId === 'test-branch' && lookup.numbers.length <= 50)).toBe(true)
  })
}

for (const width of [320, 768, 1440]) {
  for (const language of ['en', 'fr']) {
    test(`compact master and package lists at ${width}px ${language}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await mockData(page, language, language === 'fr' ? 'dark' : 'light')
      await mockMasterData(page)
      await page.addInitScript(() => {
        window.__masterRecordCount = 5
        window.__masterLongName = 'CAB: F/I replacement cab fan: 14 inch diameter grill; 6 inches high, 2 speed fan or similar; does not include battery backup for observation cars.'
      })
      await page.goto('/')
      const nav = page.locator('.main-nav')
      for (const label of language === 'fr' ? ['Détails des forfaits', 'Données principales'] : ['Package Details', 'Master Data']) {
        await nav.getByRole('button', { name: label, exact: true }).click()
        await expect(page.locator('.master-record')).toHaveCount(5)
        await checkLayout(page, { width, height: 900 }, label)
        if (width > 1000) {
          await expect(page.locator('.master-column-headings')).toBeVisible()
          for (const record of await page.locator('.master-record').all()) {
            const rect = await record.boundingBox()
            expect(rect.height).toBeLessThan(150)
            const description = await record.locator('.master-record-description').boundingBox()
            const status = await record.locator('.master-status').boundingBox()
            expect(description.x + description.width).toBeLessThanOrEqual(status.x)
          }
        } else await expect(page.locator('.master-column-headings')).toBeHidden()
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({ path: testInfo.outputPath(label === 'Master Data' || label === 'Données principales' ? 'master-list.png' : 'package-list.png'), fullPage: true })
      }
    })
  }
}

for (const role of ['estimator', 'admin']) {
  for (const width of [320, 1366]) {
    test(`settings and package catalog are available to ${role} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 768 })
      await mockData(page, 'en', 'light')
      await mockMasterData(page)
      await page.addInitScript((value) => { window.__sessionRole = value }, role)
      await page.goto('/')
      const nav = page.locator('.main-nav')
      await expect(nav.getByRole('button', { name: 'Approvals', exact: true })).toHaveCount(0)
      await expect(nav.getByRole('button', { name: 'Estimator', exact: true })).toHaveCount(0)
      await expect(nav.getByRole('button', { name: 'Pricing & Margin', exact: true })).toHaveCount(0)
      await expect(page.locator('header .language-control')).toHaveCount(0)
      await expect(nav.getByRole('button', { name: 'Master Data', exact: true })).toHaveCount(role === 'admin' ? 1 : 0)
      await nav.getByRole('button', { name: 'Settings', exact: true }).click()
      await page.getByLabel('Theme', { exact: true }).selectOption('dark')
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await expect(page.getByLabel('Language', { exact: true })).toBeEnabled()
      await page.getByLabel('Language', { exact: true }).selectOption('fr')
      await expect(page.getByRole('heading', { name: 'Paramètres', exact: true })).toBeVisible()
      await checkLayout(page, { width, height: 768 }, 'French settings')
      await page.getByRole('button', { name: 'Retour à l’espace de travail' }).click()
      await nav.getByRole('button', { name: 'Détails des forfaits', exact: true }).click()
      await expect(page.locator('.master-record')).toContainText('Motor package')
      await expect(page.getByRole('button', { name: 'Créer un enregistrement' })).toHaveCount(0)
      await page.getByRole('button', { name: 'Détails', exact: true }).click()
      await expect(page.locator('.master-details')).toContainText('Replace the motor safely.')
      await expect(page.locator('.master-details')).toContainText('2,5')
      await expect(page.locator('.master-details')).toContainText('United States')
      await expect(page.locator('.master-editor input, .master-editor textarea, .master-editor select')).toHaveCount(0)
      await checkLayout(page, { width, height: 768 }, 'French dark package details')
      if (role === 'admin') {
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({ path: testInfo.outputPath('package-details.png'), fullPage: true })
      }
      expect(await page.evaluate(() => window.__masterWrites || [])).toEqual([])
    })
  }
}

for (const width of [320, 1366]) {
  test(`admin master editor creates, edits, changes state and preserves unsaved changes at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 768 })
    await mockData(page, 'en', 'light')
    await mockMasterData(page)
    await page.goto('/')
    await page.locator('.main-nav').getByRole('button', { name: 'Master Data', exact: true }).click()
    await expect(page.getByLabel('Table', { exact: true }).locator('option')).toHaveCount(21)
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.getByLabel('Package Name (EN)', { exact: true }).fill('Edited package')
    page.once('dialog', (dialog) => dialog.dismiss())
    await page.locator('.main-nav').getByRole('button', { name: 'Dashboard', exact: true }).click()
    await expect(page.getByLabel('Package Name (EN)', { exact: true })).toHaveValue('Edited package')
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.locator('.master-workspace').getByRole('status')).toContainText('Record saved.')
    expect(await page.evaluate(() => window.__masterWrites[0].changes)).toEqual({ re_packagenameen: 'Edited package' })
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Deactivate', exact: true }).click()
    await expect(page.locator('.master-workspace').getByRole('status')).toContainText('Status updated.')
    page.once('dialog', (dialog) => dialog.dismiss())
    await page.getByRole('button', { name: 'Activate', exact: true }).click()
    expect(await page.evaluate(() => window.__masterStates.length)).toBe(1)
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Activate', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Deactivate', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Back to list', exact: true }).click()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.__masterQueries.at(-1).skipToken)).toBe('master-next')
    await page.getByLabel('Search (starts with)', { exact: true }).fill('PKG')
    await expect.poll(() => page.evaluate(() => window.__masterQueries.at(-1).skipToken)).toBeUndefined()
    await page.getByRole('button', { name: 'Create record', exact: true }).click()
    await page.getByLabel('Package Number', { exact: true }).fill('NEW001')
    await page.getByLabel('Package Name (EN)', { exact: true }).fill('New package')
    await page.getByLabel('Proposal Scope (EN)', { exact: true }).fill('New scope')
    await page.getByLabel('Mechanic Hours', { exact: true }).fill('3.5')
    await page.getByLabel('Material/Misc/Tax Cost', { exact: true }).fill('200')
    await page.getByLabel('Country', { exact: true }).focus()
    await page.getByLabel('Country', { exact: true }).selectOption('33333333-3333-3333-3333-333333333333')
    await checkLayout(page, { width, height: 768 }, 'master create form')
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: testInfo.outputPath('master-create.png'), fullPage: true })
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.locator('.master-workspace').getByRole('status')).toContainText('Record saved.')
    const writes = await page.evaluate(() => window.__masterWrites)
    expect(writes).toHaveLength(2)
    expect(writes[1].recordId).not.toBe(writes[0].recordId)
    expect(writes[1].changes).toMatchObject({ re_mechanichours: 3.5, re_materialmisctaxcost: 200,
      're_Country@odata.bind': '/re_countries(33333333-3333-3333-3333-333333333333)' })
  })
}

test('master editor retains edits after permission failure and blocks writes until explicit reload', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await mockMasterData(page)
  await page.goto('/')
  await page.locator('.main-nav').getByRole('button', { name: 'Master Data', exact: true }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Package Name (EN)', { exact: true }).fill('Preserve this edit')
  await page.evaluate(() => { window.__masterWriteError = '403: write permission denied'; window.__masterDelay = 500 })
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByLabel('Package Name (EN)', { exact: true })).toBeDisabled()
  await expect(page.getByRole('alert')).toContainText('403: write permission denied')
  await expect(page.getByLabel('Package Name (EN)', { exact: true })).toHaveValue('Preserve this edit')
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
  await page.evaluate(() => { window.__masterWriteError = ''; window.__masterDelay = 0 })
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Reload record', exact: true }).click()
  await expect(page.getByLabel('Package Name (EN)', { exact: true })).toHaveValue('Motor package')
  expect(await page.evaluate(() => window.__masterWrites)).toHaveLength(1)
})

for (const state of ['empty', 'error']) {
  test(`package catalog handles ${state} without showing demo records`, async ({ page }) => {
    await mockData(page, 'en', 'light')
    await mockMasterData(page)
    await page.addInitScript((value) => {
      window.__masterEmpty = value === 'empty'
      window.__masterError = value === 'error' ? '403: package read denied' : ''
    }, state)
    await page.goto('/')
    await page.locator('.main-nav').getByRole('button', { name: 'Package Details', exact: true }).click()
    if (state === 'empty') await expect(page.locator('.master-records')).toContainText('No accessible records')
    else {
      await expect(page.getByRole('alert')).toContainText('403: package read denied')
      await page.evaluate(() => { window.__masterError = '' })
      await page.getByRole('button', { name: 'Retry', exact: true }).click()
      await expect(page.locator('.master-record')).toHaveCount(1)
    }
  })
}

test('master repository uses registered caller SDK sources, bounded queries and validated field changes', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await page.route('**/@microsoft_power-apps_data.js*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `
      import { loadMasterTable } from '/src/data/masterDataSchema.ts';
      const log = (method, args) => { (window.__masterSdkCalls ??= []).push({method,args}); };
      export function getClient() { return {
        async executeAsync(request) {
          log('metadata', request);
          if (window.__sdkMetadataDenied) return {success:false,error:{message:'Metadata denied',status:403}};
          const table = await loadMasterTable(request.dataverseRequest.parameters.tableName);
          return {success:true,data:{
            Attributes:table.fields.map((field) => ({LogicalName:field.name,IsValidForRead:true,
              IsValidForCreate:!field.readOnly,IsValidForUpdate:!field.readOnly})),
            ManyToOneRelationships:[
              {ReferencingAttribute:'re_country',ReferencedEntity:'re_country',ReferencingEntityNavigationPropertyName:'re_Country'},
              {ReferencingAttribute:'re_currency',ReferencedEntity:'transactioncurrency',ReferencingEntityNavigationPropertyName:'re_Currency'},
              {ReferencingAttribute:'re_packagecategory',ReferencedEntity:'re_packagecategory',ReferencingEntityNavigationPropertyName:'re_PackageCategory'}
            ]
          }};
        },
        async retrieveMultipleRecordsAsync(...args) {
          log('list',args);
          return window.__sdkDenied ? {success:false,error:{message:'Permission denied',status:403}}
            : {success:true,data:[],skipToken:'sdk-next'};
        },
        async createRecordAsync(...args) { log('create',args); return {success:true,data:{}}; },
        async updateRecordAsync(...args) { log('update',args); return {success:true,data:{}}; }
      }; }
    `,
  }))
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const schema = await import('/src/data/masterDataSchema.ts')
    const repository = await import('/src/data/masterDataRepository.ts')
    const [table, ...cached] = await Promise.all([
      repository.getMasterMetadata('re_repairpackage', 'en'),
      repository.getMasterMetadata('re_repairpackage', 'en'),
      repository.getMasterMetadata('re_repairpackages', 'en'),
    ])
    const reusedMetadata = cached.every((entry) => entry === table)
    const firstMetadataCalls = window.__masterSdkCalls.filter((call) => call.method === 'metadata').length
    await repository.getMasterMetadata('re_repairpackage', 'fr')
    await repository.getMasterMetadata('re_repairpackage', 'en', true)
    window.__sdkMetadataDenied = true
    let metadataDenied
    try { await repository.getMasterMetadata('re_country', 'en') }
    catch (error) { metadataDenied = error.status }
    window.__sdkMetadataDenied = false
    await repository.getMasterMetadata('re_country', 'en')
    const values = Object.fromEntries(table.fields.filter((f) => !f.readOnly).map((field) => [
      field.name, !field.required ? '' : field.kind === 'LookupType' ? '33333333-3333-3333-3333-333333333333'
        : field.kind === 'BooleanType' ? '0' : field.kind === 'PicklistType' ? String(field.options[0].value)
          : field.kind === 'DateTimeType' ? '2026-01-01'
            : ['MoneyType', 'DecimalType', 'IntegerType', 'DoubleType'].includes(field.kind) ? '0' : 'Required text',
    ]))
    const errors = []
    for (const invalid of [
      { re_mechanichours: 'not-a-number' }, { re_mechanichours: 'Infinity' }, { re_packagenumber: '' },
      { re_packagenameen: 'x'.repeat(501) }, { re_effectivefrom: '2026-02-31' },
      { re_effectivefrom: '2026-02-01', re_effectiveto: '2026-01-01' },
      { re_currency: 'not-a-guid' }, { re_iscustompackage: '7' },
    ]) {
      try { schema.buildMasterChanges(table, { ...values, ...invalid }); errors.push(false) }
      catch { errors.push(true) }
    }
    const id = '44444444-4444-4444-4444-444444444444'
    await repository.listMasterRecords('re_repairpackage', "O'Brien", '0', 'page-two')
    await repository.searchMasterLookup('re_countries', "C'")
    await repository.saveMasterRecord(table, id, values)
    const original = Object.fromEntries(table.fields.map((field) => [schema.fieldKey(field),
      field.kind === 'BooleanType' ? false : values[field.name] || null]))
    await repository.saveMasterRecord(table, id, { ...values, re_mechanichours: '3.75' }, original)
    await repository.setMasterActive(table, id, false)
    window.__sdkDenied = true
    let denied
    try { await repository.listMasterRecords('re_repairpackage') }
    catch (error) { denied = error.status }
    let rejectedTable = false
    try { await repository.listMasterRecords('re_repairestimate') }
    catch { rejectedTable = true }
    return { errors, denied, rejectedTable, reusedMetadata, firstMetadataCalls, metadataDenied,
      tables: schema.masterTables.length, calls: window.__masterSdkCalls }
  })
  expect(result.errors).toEqual(Array(8).fill(true))
  expect(result.denied).toBe(403)
  expect(result.rejectedTable).toBe(true)
  expect(result.tables).toBe(21)
  expect(result.reusedMetadata).toBe(true)
  expect(result.firstMetadataCalls).toBe(1)
  expect(result.metadataDenied).toBe(403)
  expect(result.calls.filter((call) => call.method === 'metadata')).toHaveLength(5)
  const list = result.calls.find((call) => call.method === 'list').args
  expect(list[0]).toBe('re_repairpackages')
  expect(list[1]).toMatchObject({ maxPageSize: 25, skipToken: 'page-two' })
  expect(list[1].filter).toContain("startswith(re_packagenamefr,'O''Brien')")
  const create = result.calls.find((call) => call.method === 'create').args[1]
  expect(create.re_repairpackageid).toBe('44444444-4444-4444-4444-444444444444')
  expect(create.re_iscustompackage).toBe(false)
  expect(create['re_Currency@odata.bind']).toBe('/transactioncurrencies(33333333-3333-3333-3333-333333333333)')
  expect(result.calls.filter((call) => call.method === 'update').map((call) => call.args[2])).toEqual([
    { re_mechanichours: 3.75 }, { statecode: 1, statuscode: 2 },
  ])
})

for (const role of ['estimator', 'admin']) {
  test(`${role} estimate list ownership scope survives navigation, filters and paging`, async ({ page }) => {
    await page.addInitScript((role) => { window.__sessionRole = role }, role)
    await mockData(page, 'en', 'light')
    await page.goto('/')
    const ownerId = role === 'estimator' ? '11111111-1111-1111-1111-111111111111' : undefined
    await expect.poll(() => page.evaluate(() => window.__dashboardCalls?.length ?? 0)).toBeGreaterThan(0)
    expect(await page.evaluate(() => window.__dashboardCalls.at(-1).owner)).toBe(ownerId ?? null)
    await expect(page.locator('.dashboard-metrics')).toContainText('all creation dates')
    await expect(page.locator('.dashboard-metrics')).toContainText(role === 'admin' ? 'Accessible active estimates' : 'My active estimates')
    await expect(page.locator('.main-nav').getByRole('button', { name: /^(Quotes|Reports)$/ })).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => window.__estimateQueries?.length ?? 0)).toBeGreaterThan(0)
    expect(await page.evaluate(() => window.__estimateQueries.at(-1).ownerId)).toBe(ownerId)
    await expect(page.locator('.request-record h3').first()).toHaveText('Request with a long name / Demande avec un nom long')
    await expect(page.locator('.request-records')).not.toContainText('RE-TEST-0001')
    await page.locator('.main-nav .nav-item').nth(2).click()
    await expect(page.locator('.request-filters')).toBeVisible()
    await expect(page.locator('.request-record h3').first()).toHaveText('Request with a long name / Demande avec un nom long')
    await expect(page.locator('.request-records')).not.toContainText('RE-TEST-0001')
    await page.locator('.request-filters select').selectOption('126110000')
    await expect.poll(() => page.evaluate(() => window.__estimateQueries.at(-1).status)).toBe('126110000')
    await page.locator('.request-pagination button').last().click()
    await expect.poll(() => page.evaluate(() => window.__estimateQueries.at(-1).skipToken)).toBeTruthy()
    const queries = await page.evaluate(() => window.__estimateQueries)
    expect(queries.every((query) => query.ownerId === ownerId)).toBe(true)
    expect(queries.some((query) => query.recent)).toBe(true)
    expect(queries.some((query) => !query.recent)).toBe(true)
  })
}

async function pickEquipmentAndPackage(page) {
  await page.locator('#equipment-search').fill('TEST')
  await page.locator('#equipment-options button').first().click()
  await page.locator('#package-search').fill('PK')
  await page.locator('#package-options button').first().click()
  await page.locator('#package-search').press('Escape')
}

for (const language of ['en', 'fr']) test(`Customer defaults reuse prevents repeated scans and records data-free timings (${language})`, async ({ page }) => {
  await completeDraft(page, { width: language === 'fr' ? 390 : 1366, height: 900 }, language)
  const countDefaults = () => page.evaluate(() =>
    window.__masterSearchCalls.filter(call => call.mode === 'contactsearch' && !call.search).length)
  expect(await countDefaults()).toBe(1)
  for (let i = 0; i < 4; i++) await page.locator('.form-footer > button').click()
  await expect(page.locator('#customer-name')).toHaveValue('Draft customer')
  await next(page)
  await page.locator('.form-footer > button').click()
  await expect(page.locator('#customer-name')).toHaveValue('Draft customer')
  expect(await countDefaults()).toBe(1)
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toBeVisible()
  await expect.poll(countDefaults).toBe(2)
  await page.locator('.draft-secondary-actions button').nth(1).click()
  await expect.poll(countDefaults).toBe(3)
  await expect.poll(() => page.evaluate(() =>
    performance.getEntriesByName('repair-estimator:customer-defaults', 'measure').length)).toBe(3)
  const timings = await page.evaluate(() => performance.getEntriesByType('measure')
    .filter(entry => entry.name.startsWith('repair-estimator:'))
    .map(entry => ({ name: entry.name, duration: entry.duration, detail: entry.detail })))
  for (const operation of ['session-startup', 'account-search', 'customer-defaults', 'power-apps-request']) {
    expect(timings.filter(entry => entry.name === `repair-estimator:${operation}`).length, operation).toBeGreaterThan(0)
  }
  expect(timings.every(entry => entry.duration >= 0 &&
    JSON.stringify(entry.detail) === '{"outcome":"completed"}')).toBe(true)
  expect(timings.filter(entry => entry.name === 'repair-estimator:customer-defaults')).toHaveLength(3)
})

test('Customer defaults share in-flight reads and retry a failed refresh', async ({ page }) => {
  await completeDraft(page)
  for (let i = 0; i < 4; i++) await page.locator('.form-footer > button').click()
  await page.evaluate(() => {
    window.__defaultsGate = new Promise(resolve => { window.__releaseDefaults = resolve })
  })
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toBeVisible()
  const countDefaults = () => page.evaluate(() =>
    window.__masterSearchCalls.filter(call => call.mode === 'contactsearch' && !call.search).length)
  await expect.poll(countDefaults).toBe(2)
  await next(page)
  await page.locator('.form-footer > button').click()
  await expect(page.locator('.customer-defaults-state')).toContainText('Fetching linked customer data')
  expect(await countDefaults()).toBe(2)
  await page.evaluate(() => {
    window.__masterSearchError = 'Defaults access denied'
    window.__releaseDefaults()
  })
  const error = page.locator('.customer-defaults-state .error-box')
  await expect(error).toContainText('Defaults access denied')
  await page.evaluate(() => { window.__masterSearchError = '' })
  await error.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(error).toHaveCount(0)
  expect(await countDefaults()).toBe(3)
  expect(await page.evaluate(() => performance.getEntriesByName('repair-estimator:customer-defaults', 'measure')
    .map(entry => entry.detail.outcome))).toEqual(['completed', 'failed', 'completed'])
})

test('Changing Account discards previous customer defaults', async ({ page }) => {
  await completeDraft(page)
  for (let i = 0; i < 4; i++) await page.locator('.form-footer > button').click()
  await page.evaluate(() => {
    window.__accountMasterRecords = [{
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', number: '00099', name: 'Second Account', market: 126110000,
    }]
    window.__contactMasterRecords = [{
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'Second contact',
      email: 'second@example.invalid', phone: '', accountId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    }]
  })
  await page.getByRole('button', { name: 'Change account', exact: true }).click()
  await page.locator('#account-master-search').fill('00099')
  await page.locator('#account-master-options button').first().click()
  await expect(page.locator('#customer-name')).toHaveValue('Second contact')
  const defaults = await page.evaluate(() =>
    window.__masterSearchCalls.filter(call => call.mode === 'contactsearch' && !call.search))
  expect(defaults.map(call => call.accountId)).toEqual([
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  ])
})

test('Equipment adapter timings preserve scoped queries and explicit service errors', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await page.route('**/src/generated/services/Re_equipmentsService.ts*', route => route.fulfill({
    contentType: 'application/javascript',
    body: `export class Re_equipmentsService {
      static async getAll(options) {
        (window.__equipmentTimingQueries ??= []).push(options);
        if (window.__equipmentTimingError) return {success:false,error:{message:'Equipment access denied'}};
        return {success:true,data:[{re_equipmentid:'unit',re_equipment:'TEST123'}]};
      }
    }`,
  }))
  await page.goto('/')
  await page.unroute('**/src/data/repairEstimatorRepository.ts*')
  const result = await page.evaluate(async () => {
    const { searchEquipment, findEquipmentByNumbers } = await import('/src/data/repairEstimatorRepository.ts?timing-test')
    performance.clearMeasures('repair-estimator:equipment-search')
    performance.clearMeasures('repair-estimator:equipment-details')
    performance.clearMeasures('repair-estimator:power-apps-request')
    const branch = '11111111-1111-1111-1111-111111111111'
    const search = await searchEquipment(branch, "TEST'123")
    const details = await findEquipmentByNumbers(branch, ['TEST123'])
    window.__equipmentTimingError = true
    let error
    try { await searchEquipment(branch, 'TEST') }
    catch (reason) { error = reason.message }
    return {
      search, details, error, queries: window.__equipmentTimingQueries,
      timings: performance.getEntriesByType('measure').filter(entry => entry.name.startsWith('repair-estimator:'))
        .map(entry => ({ name: entry.name, duration: entry.duration, detail: entry.detail })),
    }
  })
  expect(result.search).toEqual(result.details)
  expect(result.error).toBe('Equipment access denied')
  expect(result.queries[0].filter).toContain("startswith(re_equipment,'TEST''123')")
  expect(result.queries[0].top).toBe(20)
  expect(result.queries[1].filter).toContain("re_equipment eq 'TEST123'")
  expect(result.queries.every(query => query.filter.includes(
    'statecode eq 0 and _re_branch_value eq 11111111-1111-1111-1111-111111111111'))).toBe(true)
  expect(result.timings.filter(entry => entry.name === 'repair-estimator:equipment-search')
    .map(entry => entry.detail.outcome)).toEqual(['completed', 'failed'])
  expect(result.timings.filter(entry => entry.name === 'repair-estimator:equipment-details')).toHaveLength(1)
  expect(result.timings.filter(entry => entry.name === 'repair-estimator:power-apps-request')).toHaveLength(3)
})

for (const width of [320, 768, 1366]) {
  for (const language of ['en', 'fr']) test(`Change Contact spacing follows text width at ${width}px ${language}`, async ({ page }) => {
    await completeDraft(page, { width, height: 900 }, language)
    for (let i = 0; i < 4; i++) await page.locator('.form-footer > button').click()
    const row = page.locator('.customer-contact-actions')
    const checkSpacing = async () => {
      const text = await row.locator('span').boundingBox()
      const button = await row.getByRole('button').boundingBox()
      const bounds = await row.boundingBox()
      const sameLine = button.x >= text.x + text.width + 15
      expect(sameLine || button.y >= text.y + text.height + 7).toBe(true)
      expect(button.x + button.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1)
      expect(button.height).toBeGreaterThanOrEqual(44)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      return sameLine
    }
    if (width === 1366) expect(await checkSpacing()).toBe(true)
    else await checkSpacing()
    await page.evaluate(() => {
      window.__contactMasterRecords = [{
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'Long contact',
        email: 'longcontact'.repeat(7) + '@example.invalid', phone: '12345678901234567890123456789012345678901234567890',
        accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }]
    })
    await row.getByRole('button').click()
    await page.locator('#customer-name').fill('Long')
    await page.locator('#customer-name-options button').first().click()
    await expect(row.locator('span')).toContainText('longcontact')
    expect(await checkSpacing()).toBe(false)
    await row.getByRole('button').click()
    await expect(page.locator('#customer-name')).not.toHaveAttribute('readonly')
  })
}

test('Equipment details fetch only added units and reuse removed units until reload', async ({ page }) => {
  await completeDraft(page)
  await expect.poll(() => page.evaluate(() => window.__equipmentLookups?.length)).toBe(1)
  for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
  await page.evaluate(() => {
    window.__equipmentResults = ['TEST123', 'TEST456'].map(number => ({
      re_equipmentid: number === 'TEST123' ? 'test-equipment' : 'second-equipment',
      re_equipment: number, re_equipmentname: `Catalog ${number}`, re_oem: 'OEM', re_equipmentage: 20,
    }))
  })
  await page.locator('#equipment-search').fill('TEST456')
  await page.locator('#equipment-options button').filter({ hasText: 'TEST456' }).first().click()
  await expect.poll(() => page.evaluate(() => window.__equipmentLookups?.length)).toBe(2)
  expect(await page.evaluate(() => window.__equipmentLookups.map(call => call.numbers))).toEqual([['TEST123'], ['TEST456']])
  await page.getByRole('button', { name: 'Remove TEST456', exact: true }).click()
  await page.locator('#equipment-search').fill('')
  await page.locator('#equipment-search').focus()
  await page.locator('#equipment-search').fill('TEST456')
  await page.locator('#equipment-options button').filter({ hasText: 'TEST456' }).first().click()
  await next(page)
  expect(await page.evaluate(() => window.__equipmentLookups.length)).toBe(2)
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.__equipmentLookups?.length)).toBe(3)
  await page.locator('.draft-secondary-actions button').nth(1).click()
  await expect.poll(() => page.evaluate(() => window.__equipmentLookups?.length)).toBe(4)
})

test('Pricing reads are reused across steps and invalidated by save and explicit reload', async ({ page }) => {
  await completeDraft(page)
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.pricing-kpi')).toHaveCount(4)
  expect(await page.evaluate(() => window.__pricingReads.length)).toBe(1)
  await page.locator('.form-footer > button').click()
  await expect(page.locator('.pricing-kpi')).toHaveCount(4)
  await next(page)
  await expect(page.locator('.pricing-kpi')).toHaveCount(4)
  expect(await page.evaluate(() => window.__pricingReads.length)).toBe(1)
  await page.locator('.draft-save-action').click()
  await expect.poll(() => page.evaluate(() => window.__pricingReads.length)).toBe(2)
  await page.locator('.draft-secondary-actions button').nth(1).click()
  for (let i = 0; i < 3; i++) await next(page)
  await expect.poll(() => page.evaluate(() => window.__pricingReads.length)).toBe(3)
})

test('Failed pricing reads can retry after navigating between Pricing and Review', async ({ page }) => {
  await completeDraft(page)
  await page.evaluate(() => { window.__pricingError = 'Pricing read denied' })
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.pricing-summary')).toContainText('Pricing read denied')
  await page.evaluate(() => { window.__pricingError = '' })
  await page.locator('.form-footer > button').click()
  await expect(page.locator('.pricing-kpi')).toHaveCount(4)
  expect(await page.evaluate(() => window.__pricingReads.length)).toBe(2)
})

test('Pricing navigation shares an in-flight saved-pricing request', async ({ page }) => {
  await completeDraft(page)
  await page.evaluate(() => {
    window.__pricingGate = new Promise(resolve => { window.__releasePricing = resolve })
  })
  await page.locator('.draft-save-action').click()
  await expect.poll(() => page.evaluate(() => window.__pricingReads?.length)).toBe(1)
  await page.locator('.form-footer > button').click()
  await expect(page.locator('.pricing-summary')).toContainText('Loading saved pricing')
  await next(page)
  await expect(page.locator('.pricing-summary')).toContainText('Loading saved pricing')
  expect(await page.evaluate(() => window.__pricingReads.length)).toBe(1)
  await page.evaluate(() => { window.__releasePricing() })
  await expect(page.locator('.pricing-kpi')).toHaveCount(4)
  expect(await page.evaluate(() => window.__pricingReads.length)).toBe(1)
})

test('Equipment details invalidate when Branch changes with no selected units', async ({ page }) => {
  await page.addInitScript(() => {
    window.__branches = ['test-branch', 'second-branch'].map((id, index) => ({
      re_branchid: id, re_branchname: `Branch ${index}`, re_branchnumber: index ? '021' : '020',
      re_market: 126110000, _re_country_value: 'test-country',
      _re_currency_value: 'test-currency', _re_stateprovince_value: 'test-state',
    }))
  })
  await completeDraft(page)
  await expect.poll(() => page.evaluate(() => window.__equipmentLookups.length)).toBe(1)
  for (let i = 0; i < 4; i++) await page.locator('.form-footer > button').click()
  page.once('dialog', dialog => dialog.accept())
  for (const number of ['021', '020']) {
    await page.locator('#branch-select').fill(number)
    await page.locator('#branch-select').press('ArrowDown')
    await page.locator('#branch-select').press('Enter')
  }
  await page.locator('#opportunity-building').fill('Branch return test')
  await next(page)
  await page.locator('#equipment-search').fill('TEST123')
  await page.locator('#equipment-options button').first().click()
  await expect.poll(() => page.evaluate(() => window.__equipmentLookups.length)).toBe(2)
  expect(await page.evaluate(() => window.__equipmentLookups.map(call => call.branchId)))
    .toEqual(['test-branch', 'test-branch'])
})

test('An overlapping equipment detail failure remains visible until Retry', async ({ page }) => {
  await completeDraft(page)
  for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
  await page.evaluate(() => {
    window.__equipmentResults = ['TEST456', 'TEST789'].map(number => ({
      re_equipmentid: number, re_equipment: number, re_equipmentname: `Unit ${number}`,
    }))
    window.__equipmentLookupGates = {}
    window.__releaseEquipment = {}
    for (const number of ['TEST456', 'TEST789']) {
      window.__equipmentLookupGates[number] = new Promise(resolve => {
        window.__releaseEquipment[number] = resolve
      })
    }
  })
  for (const number of ['TEST456', 'TEST789']) {
    await page.locator('#equipment-search').fill(number)
    await page.locator('#equipment-options button').filter({ hasText: number }).first().click()
  }
  await expect.poll(() => page.evaluate(() => window.__equipmentLookups.length)).toBe(3)
  await page.evaluate(() => { window.__releaseEquipment.TEST456('First unit detail failed') })
  await page.evaluate(() => { window.__releaseEquipment.TEST789() })
  const error = page.locator('.selected-list .error-box')
  await expect(error).toContainText('First unit detail failed')
  await page.evaluate(() => { window.__equipmentLookupGates = {} })
  await error.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(error).toHaveCount(0)
  expect(await page.evaluate(() => window.__equipmentLookups.at(-1).numbers))
    .toEqual(['TEST123', 'TEST456', 'TEST789'])
})

test('Equipment detail retry clears failed reads and reloads selected units', async ({ page }) => {
  await completeDraft(page)
  for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
  await page.evaluate(() => {
    window.__equipmentLookupError = 'Detail access denied'
    window.__equipmentResults = [{
      re_equipmentid: 'second-equipment', re_equipment: 'TEST456', re_equipmentname: 'Second unit',
    }]
  })
  await page.locator('#equipment-search').fill('TEST456')
  await page.locator('#equipment-options button').filter({ hasText: 'TEST456' }).first().click()
  const error = page.locator('.selected-list .error-box')
  await expect(error).toContainText('Detail access denied')
  await page.evaluate(() => { window.__equipmentLookupError = '' })
  await error.getByRole('button', { name: 'Retry' }).click()
  await expect(error).toHaveCount(0)
  expect(await page.evaluate(() => window.__equipmentLookups.at(-1).numbers)).toEqual(['TEST123', 'TEST456'])
})

test('Pricing retry reloads failed requests instead of retaining an error', async ({ page }) => {
  await completeDraft(page)
  await page.evaluate(() => { window.__pricingError = 'Temporary read failure' })
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.pricing-summary')).toContainText('Temporary read failure')
  await page.evaluate(() => { window.__pricingError = '' })
  await page.locator('.pricing-summary').getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.pricing-kpi')).toHaveCount(4)
  expect(await page.evaluate(() => window.__pricingReads.length)).toBe(2)
})

async function completeDraft(page, viewport = { width: 1366, height: 768 }, language = 'en', theme = 'light') {
  await page.setViewportSize(viewport)
  await mockData(page, language, theme)
  await page.goto('/')
  await expect(page.locator('.market-control select')).toBeEnabled()
  await page.locator('.main-nav .nav-item').nth(1).click()
  await expect(page.locator('#estimate-title')).toHaveAccessibleName(
    language === 'fr' ? 'Nom de l’opportunité*' : 'Opportunity Name*')
  await expect(page.locator('#opportunity-building')).toHaveAccessibleName(
    language === 'fr' ? 'Description de l’emplacement fonctionnel*' : 'Functional Location Description*')
  await page.locator('#estimate-title').fill('Motor repair draft')
  await page.locator('#branch-select').fill('020')
  await page.locator('#branch-select').press('ArrowDown')
  await page.locator('#branch-select').press('Enter')
  await page.locator('#equipment-type').selectOption('test-type')
  await page.locator('#opportunity-building').fill('Building 42')
  await selectCustomerMasters(page)
  await next(page)
  await pickEquipmentAndPackage(page)
  await next(page)
  await expect(page.locator('#request-re_usetax')).toHaveValue('5.00')
  await expect(page.locator('#request-re_freight')).toHaveValue('14.00')
  await expect(page.locator('#request-re_usetax')).not.toBeEditable()
  await expect(page.locator('#request-re_freight')).not.toBeEditable()
  await expect(page.locator('#request-re_additionallaborhours')).toBeEditable()
  await next(page)
  await page.locator('#request-re_sellprice').fill('1500')
  await next(page)
}

for (const width of [320, 1366]) {
  for (const language of ['en', 'fr']) {
    test(`request clone defaults open a clean unsaved identity at ${width}px ${language}`, async ({ page }, testInfo) => {
      const fr = language === 'fr'
      await completeDraft(page, { width, height: 900 }, language)
      await page.locator('.draft-save-action').click()
      await expect(page.locator('.draft-saved')).toContainText('0000000042')
      const original = await page.evaluate(() => structuredClone(window.__draftSaved))
      await page.locator('.main-nav .nav-item').nth(2).click()
      await checkLayout(page, { width, height: 900 }, 'requests with clone action')
      await page.locator('.request-record').getByRole('button', { name: fr ? 'Cloner' : 'Clone', exact: true }).click()
      const modal = page.getByRole('dialog')
      await expect(modal).toBeVisible()
      const bounds = await modal.boundingBox()
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
      await modal.screenshot({ path: testInfo.outputPath('clone-dialog.png') })
      await expect(modal.getByRole('checkbox').first()).toBeChecked()
      for (const box of (await modal.getByRole('checkbox').all()).slice(1)) await expect(box).not.toBeChecked()
      await modal.getByRole('button', { name: fr ? 'Ouvrir une nouvelle copie' : 'Open new copy' }).click()
      await expect(modal).not.toBeVisible()
      await expect(page.locator('#estimate-title')).toHaveValue('')
      await expect(page.locator('#customer-name')).toHaveValue('Draft customer')
      await expect(page.locator('#branch-select')).toBeEnabled()
      await expect(page.locator('#salesperson')).toHaveValue('Responsive Test User')
      expect(await page.evaluate(() => window.__draftCalls.map(row => row.mode))).toEqual(['save', 'clonesource'])
      expect(await page.evaluate(() => window.__draftSaved)).toEqual(original)
      await checkLayout(page, { width, height: 900 }, 'unsaved default clone')
      await page.locator('#estimate-title').fill('New Opportunity copy')
      await next(page)
      await expect(page.locator('.selected-card')).toHaveCount(0)
    })
  }
}

test('request clone selected sections use current masters, reset selling price and save as another request', async ({ page }) => {
  await completeDraft(page)
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toContainText('0000000042')
  const original = await page.evaluate(() => structuredClone(window.__draftSaved))
  await page.locator('.main-nav .nav-item').nth(2).click()
  await page.locator('.request-record').getByRole('button', { name: 'Clone', exact: true }).click()
  const modal = page.getByRole('dialog')
  await modal.getByRole('checkbox', { name: 'Equipment selection', exact: true }).check()
  await modal.getByRole('checkbox', { name: 'Custom labor, materials and scope', exact: true }).check()
  await expect(modal.getByRole('checkbox', { name: 'Package selection', exact: true })).toBeChecked()
  await modal.getByRole('button', { name: 'Open new copy' }).click()
  await expect(page.locator('#estimate-title')).toHaveValue('')
  await page.locator('#estimate-title').fill('New repair copy')
  await next(page)
  await expect(page.locator('.selected-card')).toHaveCount(2)
  await expect(page.locator('.selected-card').first()).toContainText('Equipment with a long descriptive name')
  await expect(page.locator('.selected-card').last()).toContainText('Repair package with a long descriptive name')
  await next(page)
  await next(page)
  await expect(page.locator('#request-re_sellprice')).toHaveValue('')
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toContainText('0000000042')
  const calls = await page.evaluate(() => window.__draftCalls)
  expect(calls.map(row => row.mode)).toEqual(['save', 'clonesource', 'save'])
  expect(calls[2].id).not.toEqual(original.id)
  expect(calls[2].version).toBeNull()
  expect(calls[2].fields).not.toContainEqual({ key: 're_sellprice', value: '1500' })
})

test('request clone stale master errors and canceled discard preserve the existing workspace', async ({ page }) => {
  await completeDraft(page)
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toContainText('0000000042')
  await page.locator('.main-nav .nav-item').nth(2).click()
  await page.locator('.request-record').getByRole('button', { name: 'Clone', exact: true }).click()
  await page.evaluate(() => { window.__branches = [] })
  await page.getByRole('dialog').getByRole('button', { name: 'Open new copy' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('source branch/currency')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.locator('.request-record').getByRole('button', { name: 'Open draft', exact: true }).click()
  await expect(page.locator('#estimate-title')).toHaveValue('Motor repair draft')
  await page.locator('#estimate-title').fill('Do not lose this')
  await page.locator('.main-nav .nav-item').nth(2).click()
  await page.locator('.request-record').getByRole('button', { name: 'Clone', exact: true }).click()
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('dialog').getByRole('button', { name: 'Open new copy' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => window.__draftCalls.filter(row => row.mode === 'save').length)).toBe(1)
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
})

for (const width of [320, 1366]) {
  test(`Opportunity presets save, reload, use and delete privately at ${width}px`, async ({ page }, testInfo) => {
    await completeDraft(page, { width, height: 900 })
    for (let index = 0; index < 4; index++) await page.locator('.form-footer > button').click()
    await page.getByRole('button', { name: 'Save as Opportunity preset', exact: true }).click()
    await expect(page.getByText('No saved presets for this market yet.')).toBeVisible()
    await page.getByRole('textbox', { name: 'Preset name', exact: true }).fill('Frequent customer')
    await page.getByRole('button', { name: 'Save Opportunity details', exact: true }).click()
    await expect(page.locator('.clone-preset-card')).toHaveCount(1)
    const saved = await page.evaluate(() => structuredClone(window.__presets[0]))
    expect(saved.opportunity.customer).toBe('Draft customer')
    expect(saved.opportunity.fields.every(field => !['re_sellprice', 're_hasbeenapproved', 're_statedlaborrate'].includes(field.key))).toBe(true)
    expect(await page.evaluate(() => window.__draftCalls || [])).toEqual([])
    await checkLayout(page, { width, height: 900 }, 'private preset page')
    await page.screenshot({ path: testInfo.outputPath('opportunity-presets.png'), fullPage: true })
    await page.locator('.main-nav .nav-item').nth(2).click()
    await page.locator('.main-nav').getByRole('button', { name: 'Clone request', exact: true }).click()
    await expect(page.locator('.clone-preset-card')).toContainText('Frequent customer')
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Use preset', exact: true }).click()
    await expect(page.locator('#estimate-title')).toHaveValue('')
    await expect(page.locator('#customer-name')).toHaveValue('Draft customer')
    expect(await page.evaluate(() => window.__draftCalls || [])).toEqual([])
    await page.locator('.main-nav').getByRole('button', { name: 'Clone request', exact: true }).click()
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Delete Frequent customer', exact: true }).click()
    await expect(page.locator('.clone-preset-card')).toHaveCount(0)
    expect(await page.evaluate(() => window.__presetCalls.map(row => row.mode))).toContain('presetdelete')
  })
}

test('Opportunity presets unavailable leaves existing-request cloning available with explicit diagnostics', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await page.addInitScript(() => { window.__presetFailure = 'Opportunity presets are unavailable. Deploy the private preset table.' })
  await page.goto('/')
  await page.locator('.main-nav').getByRole('button', { name: 'Clone request', exact: true }).click()
  await expect(page.locator('.clone-workspace').getByRole('alert')).toContainText('Deploy the private preset table')
  await expect(page.getByRole('button', { name: 'Save Opportunity details', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Browse repair requests', exact: true }).click()
  await expect(page.locator('.request-record').getByRole('button', { name: 'Clone', exact: true })).toBeVisible()
})

test('unsupported deployed clone and preset operations explain the required backend update without losing work', async ({ page }) => {
  const failure = JSON.stringify({ error: { code: '0x80040265', message: 'Unsupported draft operation.' } })
  await completeDraft(page)
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toContainText('0000000042')
  const original = await page.evaluate(() => structuredClone(window.__draftSaved))
  await page.evaluate(error => { window.__draftFailure = error; window.__presetFailure = error }, failure)
  await page.locator('.main-nav .nav-item').nth(2).click()
  await page.locator('.request-record').getByRole('button', { name: 'Clone', exact: true }).click()
  const modal = page.getByRole('dialog')
  await modal.getByRole('button', { name: 'Open new copy' }).click()
  await expect(modal.getByRole('alert')).toContainText('update the existing RepairEstimator.Drafts assembly')
  await expect(modal.getByRole('alert')).toContainText('clonesource')
  await expect(modal.getByRole('alert')).not.toContainText('"error"')
  expect(await page.evaluate(() => window.__draftSaved)).toEqual(original)
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.locator('.main-nav').getByRole('button', { name: 'Clone request', exact: true }).click()
  const error = page.locator('.clone-workspace').getByRole('alert')
  await expect(error).toContainText('presetlist / presetsave / presetdelete')
  await expect(error).toContainText('re_opportunitypreset')
  await expect(error).not.toContainText('"error"')
  await expect(page.getByRole('button', { name: 'Save Opportunity details', exact: true })).toBeDisabled()
  expect(await page.evaluate(() => window.__draftCalls.filter(row => row.mode === 'save').length)).toBe(1)
  expect(await page.evaluate(() => window.__presets || [])).toEqual([])
})

for (const width of [320, 1366]) {
  for (const language of ['en', 'fr']) {
    test(`billing plan payment amounts update and remain visible in review at ${width}px ${language}`, async ({ page }) => {
      await completeDraft(page, { width, height: 900 }, language)
      await page.locator('.form-footer > button').click()
      const price = page.locator('#request-re_sellprice')
      async function setPrice(value) {
        await price.focus()
        await price.press('ControlOrMeta+A')
        await price.press('Backspace')
        if (value) await price.pressSequentially(value)
      }
      const plan = page.locator('#request-re_billingplan')
      const payments = page.locator('.billing-payment-details')
      const amounts = (first, last) => language === 'fr'
        ? [`${first.replace('.', ',')} USD`, `${last.replace('.', ',')} USD`]
        : [`${first} USD`, `${last} USD`]
      await setPrice('100')
      await plan.selectOption('126110001')
      await expect(payments.locator('dd')).toHaveText(amounts('60.00', '40.00'))
      await expect(payments.locator('dt')).toHaveText(language === 'fr'
        ? ['Acompte (60%)', 'Paiement final (40%)'] : ['Down payment (60%)', 'Final payment (40%)'])
      await plan.selectOption('126110000')
      await expect(payments.locator('dd')).toHaveText(amounts('50.00', '50.00'))
      await setPrice('100.01')
      await expect(payments.locator('dd')).toHaveText(amounts('50.01', '50.00'))
      await plan.selectOption('126110002')
      await expect(payments.locator('dd')).toHaveText(amounts('0.00', '100.01'))
      await plan.selectOption('126110003')
      await expect(payments).toHaveCount(0)
      await expect(page.getByText(language === 'fr'
        ? 'Plan personnalisé : consultez les notes pour les montants et les échéances.'
        : 'Custom billing plan: see notes for payment amounts and timing.')).toBeVisible()
      await plan.selectOption('126110001')
      await setPrice('')
      await expect(payments).toHaveCount(0)
      await expect(page.getByText(language === 'fr'
        ? 'Saisissez le prix de vente pour voir les paiements.'
        : 'Enter a selling price to see payment amounts.')).toBeVisible()
      await setPrice('-1')
      await expect(payments).toHaveCount(0)
      await expect(page.getByText(language === 'fr'
        ? 'Saisissez un prix de vente valide et non négatif dans la plage de montants prise en charge.'
        : 'Enter a valid nonnegative selling price within the supported amount range.')).toBeVisible()
      await setPrice('0')
      await expect(payments.locator('dd')).toHaveText(amounts('0.00', '0.00'))
      await setPrice('200')
      await expect(payments.locator('dd')).toHaveText(amounts('120.00', '80.00'))
      await checkLayout(page, { width, height: 900 }, 'billing payment preview')
      await next(page)
      await page.locator('details').filter({ has: plan }).locator('summary').click()
      await expect(plan).toBeDisabled()
      await expect(payments.locator('dd')).toHaveText(amounts('120.00', '80.00'))
      await checkLayout(page, { width, height: 900 }, 'billing payment review')
    })
  }
}

for (const width of [320, 768, 1366]) {
  for (const language of ['en', 'fr']) {
    test(`selected package description and pricing align at ${width}px in ${language}`, async ({ page }, testInfo) => {
      await completeDraft(page, { width, height: 900 }, language, language === 'fr' ? 'dark' : 'light')
      for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
      const card = page.locator('.selected-package-card').first()
      await expect(card.locator('.package-cost-details')).toBeVisible()
      await expect(card.locator('dt').filter({ hasText: /^(Number of equipment|Nombre d’équipements)$/ }).locator('+ dd')).toHaveText('1')
      await expect(card.locator('dt').filter({ hasText: /^(Tax|Taxe) \(%\)$/ }).locator('+ dd')).toHaveText(language === 'fr' ? '5,00%' : '5.00%')
      await expect(card.locator('dt').filter({ hasText: /^(Freight|Fret) \(%\)$/ }).locator('+ dd')).toHaveText(language === 'fr' ? '14,00%' : '14.00%')
      const description = await card.locator('.selected-package-description').boundingBox()
      const pricing = await card.locator('.selected-package-pricing').boundingBox()
      const remove = await card.locator('.selected-package-remove').boundingBox()
      if (width > 1250) {
        expect(pricing.x).toBeGreaterThanOrEqual(description.x + description.width)
        expect(Math.abs(pricing.y - description.y)).toBeLessThan(2)
        expect(remove.x).toBeGreaterThanOrEqual(pricing.x + pricing.width)
      } else {
        expect(pricing.y).toBeGreaterThanOrEqual(description.y + description.height)
      }
      const rows = await card.locator('.package-cost-details dd').evaluateAll((elements) =>
        elements.map((el) => ({ right: el.getBoundingClientRect().right, scroll: el.scrollWidth, width: el.clientWidth })))
      expect(rows.every((row) => Math.abs(row.right - rows[0].right) < 1 && row.scroll <= row.width + 1)).toBe(true)
      await checkLayout(page, { width, height: 900 }, 'selected package details')
      await card.screenshot({ path: testInfo.outputPath('selected-package.png') })
    })
  }
}

for (const language of ['en', 'fr']) {
  test(`package pricing stays readable with fixed standard rates and large amounts in ${language}`, async ({ page }, testInfo) => {
    await page.addInitScript(() => { window.__largeRates = true })
    await completeDraft(page, { width: 1366, height: 900 }, language)
    for (let i = 0; i < 2; i++) await page.locator('.form-footer > button').click()
    await expect(page.locator('#request-re_usetax')).not.toBeEditable()
    await page.locator('.form-footer > button').click()
    const card = page.locator('.selected-package-card').first()
    await expect(card.locator('.package-cost-pending')).toHaveCount(0)
    const labels = await card.locator('.package-cost-details dt').evaluateAll((elements) =>
      elements.map((el) => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })))
    expect(labels.every((label) => label.width >= 100 && label.height < 80)).toBe(true)
    expect((await card.boundingBox()).height).toBeLessThan(400)
    await card.screenshot({ path: testInfo.outputPath('package-fixed-rates.png') })
    await expect(card.locator('.package-cost-pending')).toHaveCount(0)
    const widths = await card.locator('.package-cost-details dt').evaluateAll((elements) =>
      elements.map((el) => el.getBoundingClientRect().width))
    expect(widths.every((width) => width >= 100)).toBe(true)
    await checkLayout(page, { width: 1366, height: 900 }, 'large package amounts')
  })
}

test('package preview rates query current branch mechanic cost data from Dataverse', async ({ page }) => {
  await page.route('**/src/generated/services/Re_laborratesService.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export class Re_laborratesService {
      static async getAll(options) {
        window.__rateQuery = options;
        return { success: true, data: [{re_laborrole:126110000,re_timecategory:126110000,re_hourlycost:170.95}] };
      }
    }`,
  }))
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { getPackageCostRates } = await import('/src/data/repairEstimatorRepository.ts')
    return { rates: await getPackageCostRates('11111111-1111-1111-1111-111111111111'), query: window.__rateQuery }
  })
  expect(result.rates).toEqual([{ role: 126110000, time: 126110000, rate: 170.95 }])
  expect(result.query.select).toEqual(['re_laborrole', 're_timecategory', 're_hourlycost'])
  expect(result.query.filter).toContain('_re_branch_value eq 11111111-1111-1111-1111-111111111111')
  expect(result.query.filter).toContain('re_effectivefrom le')
  expect(result.query.filter).toContain('re_effectiveto')
})

  async function setCostRates(page, tax = '5', freight = '14') {
    for (const [key, value] of [['re_usetax', tax], ['re_freight', freight]]) {
      const input = page.locator(`#request-${key}`)
      await input.focus()
      await input.press('ControlOrMeta+A')
      await input.pressSequentially(value)
    }
  }

  async function openCatalogMaterial(page, enabled, language = 'en', width = 1366, withoutAmounts = false) {
    await page.addInitScript(({ ready, withoutAmounts }) => {
      window.__catalogEnabled = ready
      window.__extraPackages = [{
        re_repairpackageid: 'catalog-custom', re_packagenumber: 'CSTM-CATALOG', re_packagenameen: 'CSTM Catalog',
        re_iscustompackage: true, re_mechanichours: 0, re_materialbeforemarkup: withoutAmounts ? undefined : 617.45,
        re_materialmisctaxcost: 849.77, re_effectivefrom: '2020-01-01',
      }]
    }, { ready: enabled, withoutAmounts })
    await completeDraft(page, { width, height: 900 }, language)
    for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
    await page.locator('#package-search').fill('CSTM-CATALOG')
    await page.locator('#package-options button').first().click()
    await page.getByRole('button', { name: language === 'fr' ? 'Ajouter main-d’œuvre' : 'Add labor', exact: true }).click()
    await page.locator('.custom-cost-line').filter({ has: page.locator('legend', { hasText: /^(Labor|Main-d’œuvre)/ }) }).getByRole('spinbutton').fill('2')
    await page.getByRole('button', { name: language === 'fr' ? 'Ajouter un matériau' : 'Add material', exact: true }).click()
    return page.locator('.custom-cost-line').filter({ has: page.locator('legend', { hasText: /^(Material|Matériau)/ }) })
  }

  test('Pricing exposes aggregate VK13 conflict and explicit clearing preserves itemized KONE before calculation', async ({ page }) => {
    const materials = await openCatalogMaterial(page, true)
    const material = materials.first()
    await material.getByRole('combobox', { name: 'Part type', exact: true }).selectOption('kone')
    const part = material.getByRole('combobox', { name: 'Part number', exact: true })
    await part.fill('motor')
    await expect(material.getByRole('listbox').getByRole('option')).toContainText('TEST-PART-001')
    await part.press('ArrowDown')
    await part.press('Enter')
    await page.getByRole('button', { name: 'Calculate and return to packages', exact: true }).click()
    await next(page)
    await next(page)
    await page.locator('#request-re_konesparessalespricevk13').fill('100')
    await expect(page.locator('.kone-pricing-conflict')).toContainText('cannot be used together')
    await expect(page.locator('.draft-save-action')).toBeEnabled()
    const before = await page.evaluate(() => window.__draftCalls?.length || 0)
    await page.getByRole('button', { name: 'Clear aggregate VK13 price', exact: true }).click()
    await expect(page.locator('#request-re_konesparessalespricevk13')).toHaveValue('')
    await expect(page.locator('.kone-pricing-conflict')).toHaveCount(0)
    expect(await page.evaluate(() => window.__draftCalls?.length || 0)).toBe(before)
    await page.locator('.draft-save-action').click()
    await expect(page.locator('.draft-saved')).toBeVisible()
    const saved = await page.evaluate(() => window.__draftSaved)
    expect(saved.materialLines[0]).toMatchObject({ partType: 'kone', part: 'TEST-PART-001' })
    expect(saved.fields.some(field => field.key === 're_konesparessalespricevk13' && Number(field.value) > 0)).toBe(false)
  })

  for (const width of [320, 1366]) for (const language of ['en', 'fr']) {
    test(`CSTM itemized material combobox and whole quantities save at ${width}px ${language}`, async ({ page }) => {
      const fr = language === 'fr'
      const label = (en, french) => fr ? french : en
      const materials = await openCatalogMaterial(page, true, language, width)
      const material = materials.first()
      const type = fr ? 'Type de pièce' : 'Part type'
      for (const key of ['re_additionallaborhours', 're_additionalmaterial', 're_additionalmiscellaneous', 're_additionalscope'])
        await expect(page.locator(`#request-${key}`)).toHaveCount(0)
      await expect(page.locator('#request-re_usetax')).toHaveValue('5.00')
      await expect(page.locator('#request-re_freight')).toHaveValue('10.00')
      await setCostRates(page, '3', '12')
      await expect(material.getByLabel(label('Vendor', 'Fournisseur'), { exact: true })).toHaveCount(0)
      const quantity = material.getByRole('spinbutton', { name: label('Quantity', 'Quantité'), exact: true })
      await expect(quantity).toHaveValue('1')
      await expect(quantity).toHaveAttribute('step', '1')
      await expect(material.getByRole('combobox', { name: type, exact: true })).toHaveValue('kone')
      const part = material.getByRole('combobox', { name: label('Part number', 'Numéro de pièce'), exact: true })
      await part.fill('motor')
      await expect(material.getByRole('listbox').getByRole('option')).toContainText('TEST-PART-001')
      await part.press('ArrowDown')
      await part.press('Enter')
      await expect(part).toHaveValue('TEST-PART-001')
      await expect(material.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue('Test catalog motor')
      await expect(material.getByRole('spinbutton', { name: label('Unit cost', 'Coût unitaire'), exact: true })).toHaveValue('7.73178')
      await expect(material.getByLabel(label('Unit price', 'Prix unitaire'), { exact: true })).toHaveValue(fr ? '40,376 USD' : '40.376 USD')
      const total = page.getByLabel(label('Material', 'Matériau'), { exact: true })
      await expect(quantity).toHaveValue('1')
      await expect(total).toHaveValue(fr ? '7,73178 USD' : '7.73178 USD')
      await quantity.fill('1.5')
      await expect(material.getByRole('alert')).toContainText(fr ? 'entier' : 'whole number')
      await expect(page.locator('.draft-save-action')).toBeEnabled()
      await expect(total).toHaveValue(fr ? 'Indisponible' : 'Unavailable')
      await quantity.fill('3')
      await expect(total).toHaveValue(fr ? '23,19534 USD' : '23.19534 USD')
      await expect(material.getByRole('textbox', { name: 'Description', exact: true })).not.toBeEditable()
      await expect(material.getByRole('spinbutton', { name: label('Unit cost', 'Coût unitaire'), exact: true })).not.toBeEditable()
      await page.getByRole('button', { name: fr ? 'Ajouter un matériau' : 'Add material', exact: true }).click()
      const manual = materials.last()
      await expect(manual.getByRole('combobox', { name: type, exact: true })).toHaveValue('kone')
      await expect(manual.getByRole('spinbutton', { name: label('Quantity', 'Quantité'), exact: true })).toHaveValue('1')
      await manual.getByRole('combobox', { name: type, exact: true }).selectOption('non-kone')
      await manual.getByRole('spinbutton', { name: label('Quantity', 'Quantité'), exact: true }).fill('2')
      await manual.getByRole('textbox', { name: 'Description', exact: true }).fill('Manual non-KONE component')
      await manual.getByRole('combobox', { name: label('Part number', 'Numéro de pièce'), exact: true }).fill('MANUAL-001')
      await manual.getByRole('combobox', { name: label('Part number', 'Numéro de pièce'), exact: true }).press('Escape')
      await manual.getByRole('spinbutton', { name: fr ? 'Coût unitaire' : 'Unit cost', exact: true }).fill('12.50')
      await expect(total).toHaveValue(fr ? '48,19534 USD' : '48.19534 USD')
      await manual.getByRole('combobox', { name: label('Part number', 'Numéro de pièce'), exact: true }).fill('')
      await expect(manual.getByRole('alert')).toContainText(fr ? 'obligatoire' : 'required')
      await expect(page.locator('.draft-save-action')).toBeEnabled()
      await manual.getByRole('combobox', { name: label('Part number', 'Numéro de pièce'), exact: true }).fill('MANUAL-001')
      await manual.getByRole('combobox', { name: label('Part number', 'Numéro de pièce'), exact: true }).press('Escape')
      await expect(page.locator('body')).toHaveJSProperty('scrollWidth', width)
      await page.getByRole('button', { name: fr ? 'Calculer et retourner aux forfaits' : 'Calculate and return to packages', exact: true }).click()
      await expect(page.locator('#package-search')).toBeVisible()
      await next(page)
      await expect(page.locator('#request-re_additionalmaterial')).toBeVisible()
      await expect(page.locator('.custom-cost-lines')).toHaveCount(0)
      await expect(page.locator('#request-re_usetax')).toHaveValue('3.00')
      await expect(page.locator('#request-re_freight')).toHaveValue('12.00')
      await page.locator('.draft-save-action').click()
      await expect(page.locator('.draft-saved')).toBeVisible()
      const lines = await page.evaluate(() => window.__draftSaved.materialLines)
      expect(await page.evaluate(() => window.__draftSaved.fields)).toEqual(expect.arrayContaining([
        { key: 're_usetax', value: '3' }, { key: 're_freight', value: '12' },
      ]))
      expect(lines[0]).toMatchObject({ partType: 'kone',
        unitCost: 7.73178, part: 'TEST-PART-001', quantity: 3, packageId: 'catalog-custom',
        catalogPartId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', unitPrice: 40.376, markupPercent: 10 })
      expect(lines[0].pricingSource).toBeUndefined()
      expect(lines[1]).toMatchObject({ partType: 'non-kone', part: 'MANUAL-001', unitCost: 12.5, quantity: 2 })
      expect(lines[1].catalogPartId).toBeUndefined()
      expect(lines[1].markupPercent).toBeUndefined()
      expect(await page.evaluate(() => window.__catalogRequests.some(r => r.search === 'motor'))).toBe(true)
    })
  }

  test('CSTM catalog unavailable reports deployment gate and allows explicit manual non-KONE entry', async ({ page }) => {
    const material = (await openCatalogMaterial(page, false)).first()
    await expect(page.locator('.custom-cost-lines')).toContainText('Catalog unavailable')
    await expect(material.getByRole('combobox', { name: 'Part type', exact: true })).toBeEnabled()
    await material.getByRole('combobox', { name: 'Part type', exact: true }).selectOption('non-kone')
    await material.getByRole('button', { name: 'Use manual entry without catalog', exact: true }).click()
    await material.getByRole('textbox', { name: 'Description', exact: true }).fill('Existing manual motor')
    await material.getByRole('textbox', { name: 'Part number', exact: true }).fill('MANUAL-1')
    await material.getByRole('spinbutton', { name: 'Unit cost', exact: true }).fill('25')
    await page.getByRole('button', { name: 'Calculate and return to packages', exact: true }).click()
    await expect(page.locator('#package-search')).toBeVisible()
    await expect(page.locator('.draft-save-action')).toBeEnabled()
    await next(page)
    await setCostRates(page)
    await page.locator('.draft-save-action').click()
    await expect(page.locator('.draft-saved')).toBeVisible()
    expect(await page.evaluate(() => window.__draftSaved.materialLines[0].pricingSource)).toBe('manual')
  })

  test('CSTM switching part types clears catalog prices and mandatory part fields', async ({ page }) => {
    const material = (await openCatalogMaterial(page, true)).first()
    await material.getByRole('combobox', { name: 'Part type', exact: true }).selectOption('non-kone')
    await material.getByRole('textbox', { name: 'Description', exact: true }).fill('Manual motor')
    await material.getByRole('spinbutton', { name: 'Unit cost', exact: true }).fill('100')
    await material.getByRole('combobox', { name: 'Part type', exact: true }).selectOption('kone')
    await expect(material.getByRole('spinbutton', { name: 'Unit cost', exact: true })).not.toBeEditable()
    await expect(material.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue('')
    await material.getByRole('combobox', { name: 'Part type', exact: true }).selectOption('non-kone')
    await expect(material.getByRole('spinbutton', { name: 'Unit cost', exact: true })).toHaveValue('0')
    await expect(page.locator('.draft-save-action')).toBeEnabled()
  })

  test('CSTM KONE requires a catalog selection and does not fall back to package amounts', async ({ page }) => {
    const material = (await openCatalogMaterial(page, false, 'en', 1366, true)).first()
    await material.getByRole('combobox', { name: 'Part type', exact: true }).selectOption('kone')
    await material.getByRole('textbox', { name: 'Description', exact: true }).fill('Motor')
    await expect(material).toContainText('Select a KONE catalog part before saving.')
    await page.getByRole('button', { name: 'Calculate and return to packages', exact: true }).click()
    await expect(page.locator('.custom-cost-lines')).toBeVisible()
    await expect(page.locator('.draft-save-action')).toBeEnabled()
    expect(await page.evaluate(() => window.__draftCalls || [])).toEqual([])
  })

test('CSTM part lookup reports no matches and service errors then recovers after retry', async ({ page }) => {
  const material = (await openCatalogMaterial(page, true)).first()
  await material.getByRole('combobox', { name: 'Part type', exact: true }).selectOption('kone')
  const part = material.getByRole('combobox', { name: 'Part number', exact: true })
  await part.fill('NONE')
  await expect(material.getByRole('status')).toContainText('0 matching parts.')
  await expect(material.getByRole('listbox').getByRole('option')).toHaveCount(0)
  await page.evaluate(() => { window.__catalogFailure = 'Parts service unavailable' })
  await part.fill('motor')
  await expect(material.getByRole('alert').filter({ hasText: 'Parts service unavailable' })).toBeVisible()
  await expect(page.locator('.draft-save-action')).toBeEnabled()
  await page.evaluate(() => { window.__catalogFailure = undefined })
  await material.getByRole('button', { name: 'Retry part search', exact: true }).click()
  await material.getByRole('listbox').getByRole('button', { name: /TEST-PART-001/ }).click()
  await expect(part).toHaveValue('TEST-PART-001')
  await expect(material.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue('Test catalog motor')
  await expect(page.getByLabel('Material', { exact: true })).toHaveValue('7.73178 USD')
})

test('package costs show immediately and each CSTM requires separate positive entries before returning to packages', async ({ page }) => {
  await page.addInitScript(() => {
    window.__extraPackages = ['CSTM-A', 'CSTM-B'].map((number, i) => ({
      re_repairpackageid: `custom-${i}`, re_packagenumber: number, re_packagenameen: number,
      re_iscustompackage: true, re_mechanichours: 0, re_materialmisctaxcost: 0, re_effectivefrom: '2020-01-01',
    }))
  })
  await completeDraft(page)
  for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
  await expect(page.locator('.package-cost-details')).toContainText('259.50 USD')
  for (const [index, code] of ['CSTM-A', 'CSTM-B'].entries()) {
    await page.locator('#package-search').fill(code)
    await page.locator('#package-options button').first().click()
    await expect(page.locator('.custom-cost-lines')).toBeVisible()
    await expect(page.locator('.package-cost-details')).toHaveCount(0)
    await expect(page.locator('.draft-save-action')).toBeEnabled()
    const calculate = page.getByRole('button', { name: 'Calculate and return to packages', exact: true })
    await calculate.click()
    await expect(page.locator('.custom-cost-lines')).toBeVisible()
    await page.getByRole('button', { name: 'Add labor', exact: true }).click()
    const labor = page.locator('.custom-cost-line').filter({ has: page.locator('legend', { hasText: /^Labor/ }) }).last()
    await labor.locator('input').fill(String(index + 2))
    await page.getByRole('button', { name: 'Add material', exact: true }).click()
    const material = page.locator('.custom-cost-line').filter({ has: page.locator('legend', { hasText: /^Material/ }) }).last()
    await material.getByRole('combobox', { name: 'Part type', exact: true }).selectOption('non-kone')
    await material.getByRole('button', { name: 'Use manual entry without catalog', exact: true }).click()
    await material.locator('textarea').fill(`Motor ${index}`)
    await material.getByRole('textbox', { name: 'Part number', exact: true }).fill(`MOTOR-${index}`)
    await material.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('2')
    await calculate.click()
    await expect(page.locator('.custom-cost-lines')).toBeVisible()
    await expect(page.locator('.draft-save-action')).toBeEnabled()
    await material.getByRole('spinbutton', { name: 'Unit cost', exact: true }).fill('25')
    if (index === 0) {
      await expect(page.getByLabel('Material', { exact: true })).toHaveValue('50.00 USD')
    }
    await expect(page.locator('#request-re_usetax')).toBeEditable()
    await expect(page.locator('#request-re_freight')).toBeEditable()
    await calculate.click()
    await expect(page.locator('#package-search')).toBeVisible()
    await next(page)
    await setCostRates(page)
    await page.locator('.form-footer > button').click()
    await expect(page.locator('.selected-package-card').first()).toContainText('259.50 USD')
    await expect(page.locator('.selected-package-card').nth(index + 1)).toContainText(`${(index + 2) * 100 + 59}.50 USD`)
    const customCard = page.locator('.selected-package-card').nth(index + 1)
    await expect(customCard.locator('dt').filter({ hasText: /^Tax \(%\)$/ }).locator('+ dd')).toHaveText('5.00%')
    await expect(customCard.locator('dt').filter({ hasText: /^Freight \(%\)$/ }).locator('+ dd')).toHaveText('14.00%')
  }
  await next(page)
  await setCostRates(page, '8', '20')
  await page.locator('.form-footer > button').click()
  await expect(page.locator('.selected-package-card').nth(1)).toContainText('264.00 USD')
  await expect(page.locator('.selected-package-card').nth(2)).toContainText('364.00 USD')
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toBeVisible()
  expect(await page.evaluate(() => window.__draftSaved.laborLines.map((l) => l.packageId))).toEqual(['custom-0', 'custom-1'])
  expect(await page.evaluate(() => window.__draftSaved.materialLines.map((m) => m.packageId))).toEqual(['custom-0', 'custom-1'])
  const fields = await page.evaluate(() => window.__draftSaved.fields)
  expect(fields).toContainEqual({ key: 're_usetax', value: '8' })
  expect(fields).toContainEqual({ key: 're_freight', value: '20' })
  await page.locator('.draft-secondary-actions button').nth(1).click()
  await next(page)
  await expect(page.locator('.selected-package-card .package-cost-details')).toHaveCount(3)
})

for (const language of ['en', 'fr']) {
  test(`Additional details cost card separates additions from package subtotal and combined total in ${language}`, async ({ page }) => {
    const fr = language === 'fr'
    await completeDraft(page, { width: fr ? 320 : 1366, height: 900 }, language)
    await page.locator('.form-footer > button').click()
    await page.locator('.form-footer > button').click()
    const summary = page.locator('.package-cost-summary')
    const card = summary.locator('.additional-cost-card')
    await expect(card).toHaveCount(0)
    await expect(summary.locator('.estimate-combined-total')).toHaveCount(0)
    for (const [key, value] of [['re_additionallaborhours', '2'], ['re_additionalmaterial', '10'], ['re_additionalmiscellaneous', '5']])
      await page.locator(`#request-${key}`).fill(value)
    await next(page)
    await expect(card).toBeVisible()
    await expect(summary.locator('.package-combined-total dd')).toHaveText(fr ? '259,50 USD' : '259.50 USD')
    await expect(card.locator('dd.package-cost-total')).toHaveText(fr ? '217,85 USD' : '217.85 USD')
    await expect(summary.locator('.estimate-combined-total dd')).toHaveText(fr ? '477,35 USD' : '477.35 USD')
    const detail = (label) => card.locator('dt').filter({ hasText: new RegExp(`^${label}$`) }).locator('+ dd')
    await expect(detail(fr ? 'Heures supplémentaires' : 'Additional labor hours')).toHaveText(fr ? '2,00' : '2.00')
    await expect(detail(fr ? 'Coût de main-d’œuvre supplémentaire' : 'Additional labor cost')).toHaveText(fr ? '200,00 USD' : '200.00 USD')
    await expect(detail(fr ? 'Montant de la taxe' : 'Tax amount')).toHaveText(fr ? '0,75 USD' : '0.75 USD')
    await expect(detail(fr ? 'Montant du fret' : 'Freight amount')).toHaveText(fr ? '2,10 USD' : '2.10 USD')
    expect(await summary.evaluate(element => {
      const subtotal = element.querySelector('.package-combined-total')
      const additions = element.querySelector('.additional-cost-card')
      const total = element.querySelector('.estimate-combined-total')
      return subtotal.getBoundingClientRect().bottom <= additions.getBoundingClientRect().top
        && additions.getBoundingClientRect().bottom <= total.getBoundingClientRect().top
    })).toBe(true)
    await checkLayout(page, { width: fr ? 320 : 1366, height: 900 }, 'additional cost breakdown')
    await page.locator('.form-footer > button').click()
    await expect(card).toHaveCount(0)
    await page.locator('#request-re_additionalmaterial').focus()
    await page.locator('#request-re_additionalmaterial').press('ControlOrMeta+A')
    await page.locator('#request-re_additionalmaterial').pressSequentially('-1')
    await next(page)
    await expect(card).toHaveCount(0)
    expect(await page.locator('#request-re_additionalmaterial').evaluate(input => input.validity.rangeUnderflow)).toBe(true)
    await page.locator('#request-re_additionalmaterial').fill('20')
    await next(page)
    await expect(card.locator('dd.package-cost-total')).toHaveText(fr ? '229,75 USD' : '229.75 USD')
    await expect(summary.locator('.estimate-combined-total dd')).toHaveText(fr ? '489,25 USD' : '489.25 USD')
    await page.locator('.form-footer > button').click()
    await page.locator('#request-re_additionalmaterial').focus()
    await page.locator('#request-re_additionalmaterial').fill('10')
    await expect(page.locator('#request-re_additionalmaterial')).toHaveValue('10')
    await next(page)
    await expect(summary.locator('.estimate-combined-total dd')).toHaveText(fr ? '477,35 USD' : '477.35 USD')
    await page.locator('.local-calculate-action').click()
    await expect(page.locator('.local-cost-total')).toContainText(fr ? '477,35' : '477.35')
    await next(page)
    await page.locator('.draft-save-action').click()
    await expect(page.locator('.draft-saved')).toBeVisible()
    await expect(card).toHaveCount(0)
    await page.locator('.draft-secondary-actions button').nth(1).click()
    await next(page)
    await next(page)
    await expect(card).toHaveCount(0)
    await next(page)
    await expect(card.locator('dd.package-cost-total')).toHaveText(fr ? '217,85 USD' : '217.85 USD')
    await expect(summary.locator('.package-combined-total dd')).toHaveText(fr ? '398,75 USD' : '398.75 USD')
    await expect(summary.locator('.estimate-combined-total dd')).toHaveText(fr ? '616,60 USD' : '616.60 USD')
  })
}

for (const width of [320, 1366]) {
  test(`standard package Additional details are editable and survive save and reopen at ${width}px`, async ({ page }) => {
    await completeDraft(page, { width, height: 900 })
    for (let i = 0; i < 2; i++) await page.locator('.form-footer > button').click()
    await expect(page.getByRole('heading', { name: 'Additional details', exact: true })).toBeVisible()
    await expect(page.locator('.custom-cost-lines')).toHaveCount(0)
    await expect(page.locator('#request-re_usetax')).not.toBeEditable()
    await expect(page.locator('#request-re_freight')).not.toBeEditable()
    for (const [key, value] of [
      ['re_additionallaborhours', '1'], ['re_additionalmaterial', '10'],
      ['re_additionalmiscellaneous', '5'], ['re_additionalscope', 'Additional site work'],
    ]) {
      await expect(page.locator(`#request-${key}`)).toBeEditable()
      await page.locator(`#request-${key}`).fill(value)
    }
    await expect(page.locator('.form-main')).not.toContainText('Select a CSTM package to edit additional costs')
    await next(page)
    await page.locator('.local-calculate-action').click()
    await expect(page.locator('.local-cost-total')).toContainText('377.35')
    await next(page)
    await page.locator('.draft-save-action').click()
    await expect(page.locator('.draft-saved')).toBeVisible()
    const fields = await page.evaluate(() => window.__draftSaved.fields)
    expect(fields).toEqual(expect.arrayContaining([
      { key: 're_additionallaborhours', value: '1' }, { key: 're_additionalmaterial', value: '10' },
      { key: 're_additionalmiscellaneous', value: '5' }, { key: 're_additionalscope', value: 'Additional site work' },
    ]))
    await page.locator('.draft-secondary-actions button').nth(1).click()
    await next(page)
    await next(page)
    await expect(page.locator('#request-re_additionallaborhours')).toHaveValue('1.00')
    await expect(page.locator('#request-re_additionalmaterial')).toHaveValue('10.00')
    await expect(page.locator('#request-re_additionalmiscellaneous')).toHaveValue('5.00')
    await expect(page.locator('#request-re_additionalscope')).toHaveValue('Additional site work')
  })

  test(`all three package costs carry forward before additions without reopening CSTM at ${width}px`, async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      window.__extraPackages = [
        { re_repairpackageid: 'custom', re_packagenumber: 'CSTM', re_packagenameen: 'Custom',
          re_iscustompackage: true, re_mechanichours: 0, re_materialmisctaxcost: 0, re_effectivefrom: '2020-01-01' },
        { re_repairpackageid: 'pit', re_packagenumber: 'PIT', re_packagenameen: 'Pit work',
          re_mechanichours: 1, re_materialmisctaxcost: 100, re_effectivefrom: '2020-01-01' },
      ]
    })
    await completeDraft(page, { width, height: 900 })
    for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
    await next(page)
    for (const key of ['re_additionallaborhours', 're_additionalmaterial', 're_additionalmiscellaneous'])
      await expect(page.locator(`#request-${key}`)).toBeEditable()
    await expect(page.getByRole('button', { name: 'Add labor', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add material', exact: true })).toHaveCount(0)
    await page.locator('.form-footer > button').click()
    await page.locator('#package-search').fill('CSTM')
    await page.locator('#package-options button').first().click()
    const editor = page.locator('.custom-cost-lines')
    await editor.getByRole('button', { name: 'Add labor', exact: true }).click()
    await editor.locator('fieldset').first().locator('input').fill('2')
    await editor.getByRole('button', { name: 'Add material', exact: true }).click()
    const material = editor.locator('fieldset').nth(1)
    await material.getByRole('combobox', { name: 'Part type', exact: true }).selectOption('non-kone')
    await material.getByRole('button', { name: 'Use manual entry without catalog', exact: true }).click()
    await material.locator('textarea').fill('Motor')
    await material.getByRole('textbox', { name: 'Part number', exact: true }).fill('MOTOR-1')
    await material.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('2')
    await material.getByRole('spinbutton', { name: 'Unit cost', exact: true }).fill('25')
    await page.getByRole('button', { name: 'Calculate and return to packages', exact: true }).click()
    await expect(page.locator('.equipment-package-card .equipment-package-price')).toHaveText(['259.50 USD', '257.50 USD'])
    await expect(page.locator('.equipment-package-costs').last()).toContainText('Entered CSTM hours and costs are shared equally')
    await page.locator('#package-search').fill('PIT')
    await page.locator('#package-options button').first().click()
    await page.locator('#package-search').press('Escape')
    await next(page)
    await setCostRates(page, '8', '20')
    const summary = page.locator('.package-cost-summary')
    await expect(summary.locator('.package-overview-card')).toHaveCount(3)
    for (const card of await summary.locator('.package-overview-card').all())
      await expect(card.locator('dt').filter({ hasText: 'Number of equipment' }).locator('+ dd')).toHaveText('1')
    for (const [index, amount] of ['259.50 USD', '264.00 USD', '219.00 USD'].entries())
      await expect(summary.locator('.package-overview-card').nth(index).locator('dd.package-cost-total')).toHaveText(amount)
    await expect(summary.locator('.package-combined-total dd')).toHaveText('742.50 USD')
    await expect(editor).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add labor', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add material', exact: true })).toHaveCount(0)
    const order = await summary.evaluate((element) => element.getBoundingClientRect().bottom
      <= document.querySelector('#request-re_additionallaborhours').getBoundingClientRect().top)
    expect(order).toBe(true)
    await page.locator('#request-re_additionallaborhours').fill('1')
    await page.locator('#request-re_additionalmaterial').fill('10')
    await page.locator('#request-re_additionalmiscellaneous').fill('5')
    await expect(summary.locator('.package-combined-total dd')).toHaveText('742.50 USD')
    await expect(summary.locator('.additional-cost-card')).toHaveCount(0)
    await expect(summary.locator('.estimate-combined-total')).toHaveCount(0)
    await checkLayout(page, { width, height: 900 }, 'all package costs before additions')
    await summary.screenshot({ path: testInfo.outputPath('all-package-costs.png') })
    await next(page)
    await expect(summary.locator('.package-combined-total dd')).toHaveText('742.50 USD')
    await expect(summary.locator('.additional-cost-card dd.package-cost-total')).toHaveText('119.20 USD')
    await expect(summary.locator('.estimate-combined-total dd')).toHaveText('861.70 USD')
    await page.locator('.local-calculate-action').click()
    await expect(page.locator('.local-cost-total')).toContainText('861.70')
    await next(page)
    await expect(summary.locator('.package-combined-total dd')).toHaveText('742.50 USD')
    await page.locator('.draft-save-action').click()
    await expect(page.locator('.draft-saved')).toBeVisible()
    const saved = await page.evaluate(() => window.__draftCalls.at(-1))
    expect(saved.packages.map((p) => p.id)).toEqual(['test-package', 'custom', 'pit'])
    expect(saved.laborLines).toHaveLength(1)
    expect(saved.materialLines).toHaveLength(1)
    expect(saved.fields).toEqual(expect.arrayContaining([
      { key: 're_additionallaborhours', value: '1' },
      { key: 're_additionalmaterial', value: '10' },
      { key: 're_additionalmiscellaneous', value: '5' },
    ]))
  })
}

for (const [width, language, theme] of [[320, 'fr', 'dark'], [1366, 'en', 'light']]) {
  test(`per-equipment package cards highlight each package without changing totals at ${width}px ${language}`, async ({ page }) => {
    await page.addInitScript(() => {
      window.__equipmentResults = ['TEST123', 'TEST456'].map((number, i) => ({
        re_equipmentid: `unit-${i}`, re_equipment: number, re_equipmentname: `Equipment ${number}`,
        re_functionallocation: 'Test location', re_soldtoname: 'Customer', re_oem: 'OEM', re_equipmentage: 20,
      }))
      window.__extraPackages = [{ re_repairpackageid: 'pit', re_packagenumber: 'PIT', re_packagenameen: 'Pit work',
        re_packagenamefr: 'Travaux de fosse', re_mechanichours: 1, re_materialmisctaxcost: 100, re_effectivefrom: '2020-01-01' }]
    })
    await completeDraft(page, { width, height: 900 }, language, theme)
    for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
    await page.locator('#equipment-search').fill('TEST456')
    await page.getByRole('button', { name: /^TEST456 Equipment TEST456/ }).click()
    await page.locator('#equipment-search').press('Escape')
    await page.locator('#package-search').fill('PIT')
    await page.locator('#package-options button').first().click()
    await page.locator('#package-search').press('Escape')
    const preview = page.locator('.equipment-package-costs')
    const title = language === 'fr' ? 'Détails du forfait par équipement' : 'Package per-equipment details'
    await expect(preview).toHaveCount(2)
    for (const [index, code] of ['PKG001', 'PIT'].entries()) {
      const packagePreview = preview.nth(index)
      await expect(packagePreview.getByRole('heading', { level: 3 })).toHaveText(`${title} — ${code}`)
      await expect(packagePreview.locator('.equipment-package-card h4')).toHaveText(['TEST123', 'TEST456'])
      for (const card of await packagePreview.locator('.equipment-package-card').all()) {
        await expect(card.locator('dt strong')).toHaveText(code)
        await expect(card.locator('.equipment-package-price')).toHaveText(language === 'fr'
          ? index === 0 ? '259,50 USD' : '219,00 USD'
          : index === 0 ? '259.50 USD' : '219.00 USD')
        const breakdown = card.locator('.equipment-package-breakdown')
        await expect(breakdown).toHaveCount(1)
        const values = index === 0
          ? ['1', '2.00', '100.00 USD', '200.00 USD', '50.00 USD', '5.00%', '2.50 USD', '14.00%', '7.00 USD']
          : ['1', '1.00', '100.00 USD', '100.00 USD', '100.00 USD', '5.00%', '5.00 USD', '14.00%', '14.00 USD']
        await expect(breakdown.locator('dd')).toHaveText(language === 'fr' ? values.map(value => value.replace('.', ',')) : values)
        await expect(card.locator('.equipment-package-formula')).toHaveCount(1)
        expect(await breakdown.evaluate(el => el.getBoundingClientRect().bottom
          <= el.parentElement.querySelector('.equipment-package-price').getBoundingClientRect().top)).toBe(true)
        expect(await card.locator('.equipment-package-price').evaluate(el =>
          Number(getComputedStyle(el).fontWeight) >= 700 && parseFloat(getComputedStyle(el).fontSize) >= 18)).toBe(true)
      }
    }

    await expect(page.locator('.selected-package-card dd.package-cost-total')).toHaveText(language === 'fr'
      ? ['519,00 USD', '438,00 USD'] : ['519.00 USD', '438.00 USD'])
    expect(await page.locator('.selected-package-group').evaluateAll(groups => {
      const select = document.querySelector('#package-search').closest('.form-card')
      return groups.every((group, index) => {
        const details = group.querySelector('.equipment-package-costs')
        const total = group.querySelector('.selected-package-card')
        return details.nextElementSibling === total
          && select.getBoundingClientRect().bottom <= details.getBoundingClientRect().top
          && details.getBoundingClientRect().bottom <= total.getBoundingClientRect().top
          && (index === groups.length - 1
            || total.getBoundingClientRect().bottom <= groups[index + 1].querySelector('.equipment-package-costs').getBoundingClientRect().top)
      })
    })).toBe(true)
    await checkLayout(page, { width, height: 900 }, 'per-equipment package cards')
    await page.locator('.selected-card').first().getByRole('button', { name: /TEST456/ }).click()
    await expect(preview.locator('.equipment-package-card')).toHaveCount(2)
    await page.locator('.selected-package-remove').last().click()
    await expect(preview.locator('.equipment-package-price')).toHaveCount(1)
    await page.locator('.selected-package-remove').click()
    await expect(preview).toHaveCount(0)
  })
}

test('per-equipment package cards page every equipment and package and clamp pages after removal', async ({ page }) => {
  await completeDraft(page)
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toBeVisible()
  await page.evaluate(() => {
    const draft = window.__draftSaved
    draft.equipment = Array.from({ length: 21 }, (_, index) => ({
      ...draft.equipment[0], id: `equipment-${index}`, number: `UNIT-${index + 1}`,
    }))
    draft.packages = Array.from({ length: 21 }, (_, index) => ({
      ...draft.packages[0], id: `package-${index}`, number: `PACKAGE-${index + 1}`,
    }))
  })
  await page.locator('.draft-secondary-actions button').nth(1).click()
  await next(page)
  const preview = page.locator('.equipment-package-costs')
  await expect(preview).toHaveCount(20)
  await expect(preview.first().locator('.equipment-package-card')).toHaveCount(20)
  await expect(preview.locator('.equipment-package-price')).toHaveCount(400)
  await preview.first().getByRole('navigation', { name: 'Equipment', exact: true }).getByRole('button', { name: 'Next' }).click()
  await expect(preview.first().locator('.equipment-package-card h4')).toHaveText('UNIT-21')
  await expect(preview.nth(1).locator('.equipment-package-card')).toHaveCount(20)
  await page.locator('.selected-card').first().getByRole('button', { name: /UNIT-21$/ }).click()
  await expect(preview.first().locator('.equipment-package-card')).toHaveCount(20)
  await expect(preview.getByRole('navigation', { name: 'Equipment', exact: true })).toHaveCount(0)
  await page.locator('.selected-card').last().getByRole('button', { name: 'Next', exact: true }).click()
  await expect(preview).toHaveCount(1)
  await expect(preview.locator('.equipment-package-amounts dt strong')).toHaveText(Array(20).fill('PACKAGE-21'))
  await expect(page.locator('.selected-package-card .equipment-title strong')).toHaveText('PACKAGE-21')
  await page.locator('.selected-package-remove').click()
  await expect(preview).toHaveCount(20)
  await expect(preview.locator('.equipment-package-price')).toHaveCount(400)
})

for (const language of ['en', 'fr']) {
  test(`CSTM equipment cards show entered hours and costs and recalculate assigned shares in ${language}`, async ({ page }) => {
    const fr = language === 'fr'
    await page.addInitScript(() => {
      window.__extraPackages = [{
        re_repairpackageid: 'custom', re_packagenumber: 'CSTM: 0', re_packagenameen: 'Custom',
        re_iscustompackage: true, re_mechanichours: 0, re_materialmisctaxcost: 0, re_effectivefrom: '2020-01-01',
      }]
      window.__equipmentResults = ['TEST123', 'TEST456', 'TEST789'].map((number, i) => ({
        re_equipmentid: `unit-${i}`, re_equipment: number, re_equipmentname: `Equipment ${number}`,
      }))
    })
    await completeDraft(page, { width: fr ? 320 : 1366, height: 900 }, language)
    for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
    for (const number of ['TEST456', 'TEST789']) {
      await page.locator('#equipment-search').fill(number)
      await page.locator('#equipment-options').getByRole('button', { name: new RegExp(`^${number} Equipment ${number}`) }).click()
    }
    await page.locator('#package-search').fill('CSTM')
    await page.locator('#package-options button').first().click()
    const editor = page.locator('.custom-cost-lines')
    await editor.getByRole('button', { name: fr ? 'Ajouter main-d’œuvre' : 'Add labor', exact: true }).click()
    await editor.locator('fieldset').first().locator('input').fill('6')
    await editor.getByRole('button', { name: fr ? 'Ajouter un matériau' : 'Add material', exact: true }).click()
    const material = editor.locator('fieldset').nth(1)
    await material.getByRole('combobox', { name: fr ? 'Type de pièce' : 'Part type', exact: true }).selectOption('non-kone')
    await material.getByRole('button', {
      name: fr ? 'Utiliser la saisie manuelle sans catalogue' : 'Use manual entry without catalog', exact: true,
    }).click()
    await material.locator('textarea').fill('Motor')
    await material.getByRole('textbox', { name: fr ? 'Numéro de pièce' : 'Part number', exact: true }).fill('MOTOR-1')
    await material.getByRole('spinbutton', { name: fr ? 'Quantité' : 'Quantity', exact: true }).fill('2')
    await material.getByRole('spinbutton', { name: fr ? 'Coût unitaire' : 'Unit cost', exact: true }).fill('25')
    await setCostRates(page, '5', '10')
    await page.getByRole('button', {
      name: fr ? 'Calculer et retourner aux forfaits' : 'Calculate and return to packages', exact: true,
    }).click()
    const group = page.locator('.selected-package-group').filter({ hasText: 'CSTM: 0' })
    const cards = group.locator('.equipment-package-card')
    const value = (label) => cards.locator('dt').filter({ hasText: new RegExp(`^${label}$`) }).locator('+ dd')
    await expect(cards).toHaveCount(3)
    await expect(value(fr ? 'Heures de main-d’œuvre' : 'Labor hours required')).toHaveText(Array(3).fill(fr ? '2,00' : '2.00'))
    await expect(cards.locator('.equipment-package-price')).toHaveText(Array(3).fill(fr ? '219,17 USD' : '219.17 USD'))
    await group.locator('details summary').click()
    await group.getByLabel('TEST789', { exact: true }).uncheck()
    await expect(cards).toHaveCount(2)
    await expect(value(fr ? 'Heures de main-d’œuvre' : 'Labor hours required')).toHaveText(Array(2).fill(fr ? '3,00' : '3.00'))
    await expect(cards.locator('.equipment-package-price')).toHaveText(Array(2).fill(fr ? '328,75 USD' : '328.75 USD'))
    await next(page)
    const summary = page.locator('.package-overview-card').filter({ hasText: 'CSTM: 0' })
    await expect(summary.locator('dd.package-cost-total')).toHaveText(fr ? '657,50 USD' : '657.50 USD')
    await page.getByRole('button', { name: fr ? 'Modifier les coûts CSTM' : 'Edit CSTM costs', exact: true }).click()
    await editor.locator('fieldset').first().locator('input').fill('8')
    await page.getByRole('button', {
      name: fr ? 'Calculer et retourner aux forfaits' : 'Calculate and return to packages', exact: true,
    }).click()
    await expect(value(fr ? 'Heures de main-d’œuvre' : 'Labor hours required')).toHaveText(Array(2).fill(fr ? '4,00' : '4.00'))
    await expect(cards.locator('.equipment-package-price')).toHaveText(Array(2).fill(fr ? '428,75 USD' : '428.75 USD'))
    expect(await page.evaluate(() => window.__draftCalls ?? [])).toEqual([])
  })
}

test('per-equipment package cards show missing-rate errors and recover after retry without displaying zero', async ({ page }) => {
  await page.addInitScript(() => { window.__rateError = 'Rates temporarily unavailable' })
  await completeDraft(page)
  for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
  const preview = page.locator('.equipment-package-costs')
  await expect(preview.getByRole('alert')).toContainText('Branch labor cost rate is missing or ambiguous.')
  await expect(preview.locator('.equipment-package-price')).toHaveCount(0)
  await expect(preview.locator('dd')).toHaveText('Unavailable')
  await page.evaluate(() => { window.__rateError = '' })
  await page.locator('#package-search').locator('xpath=ancestor::section[1]').getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(preview.locator('.equipment-package-price')).toHaveText('259.50 USD')
  await expect(preview.getByRole('alert')).toHaveCount(0)
})

test('equipment selection exceeds fourteen for catalog and unlisted units and survives save and reload', async ({ page }) => {
  await completeDraft(page)
  for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
  await page.evaluate(() => {
    window.__equipmentResults = Array.from({ length: 20 }, (_, i) => ({
      re_equipmentid: `equipment-${i}`, re_equipment: `UNIT-${i}`,
      re_equipmentname: `Catalog unit ${i}`, re_functionallocation: 'Test location',
    }))
  })
  await page.locator('#equipment-search').fill('UNIT')
  const catalog = page.locator('#equipment-options button').filter({ hasText: 'Catalog unit' })
  await expect(catalog).toHaveCount(20)
  for (let i = 0; i < 20; i++) await catalog.nth(i).click()
  await expect(page.locator('.selected-card').first().locator('.equipment-card')).toHaveCount(21)
  await expect(page.locator('.selected-package-card dt').filter({ hasText: 'Number of equipment' }).locator('+ dd')).toHaveText('21')
  await expect(page.locator('.aside-stat strong').first()).toHaveText('21')
  await page.locator('#equipment-search').fill('UNLISTED-EXTRA')
  await page.locator('#equipment-options button').filter({ hasText: 'UNLISTED-EXTRA' }).click()
  await expect(page.locator('.selected-card').first().locator('.equipment-card')).toHaveCount(22)
  await page.locator('#equipment-search').press('Escape')
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toBeVisible()
  const saved = await page.evaluate(() => window.__draftSaved.equipment)
  expect(saved).toHaveLength(22)
  expect(saved.filter((item) => item.matched)).toHaveLength(21)
  expect(saved.find((item) => item.number === 'TEST123').matched).toBe(true)
  expect(saved.find((item) => item.number === 'UNLISTED-EXTRA').matched).toBe(false)
  await page.locator('.draft-secondary-actions button').nth(1).click()
  await next(page)
  await expect(page.locator('.selected-card').first().locator('.equipment-card')).toHaveCount(22)
})

test('Account is required for saving and fetched Contact details are read-only', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await page.goto('/')
  await page.locator('.main-nav .nav-item').nth(1).click()
  await page.locator('#estimate-title').fill('Contact selection')
  await page.locator('#branch-select').fill('020')
  await page.locator('#branch-select').press('ArrowDown')
  await page.locator('#branch-select').press('Enter')
  await page.locator('#equipment-type').selectOption('test-type')
  await page.locator('#opportunity-building').fill('Building 42')

  const email = page.locator('#customer-email')
  await expect(email).toHaveAttribute('required', '')
  await expect(email).toHaveAttribute('aria-required', 'true')
  await expect(email).toBeDisabled()
  await expect(page.locator('#customer-phone')).toBeDisabled()
  for (const width of [320, 1366]) {
    await page.setViewportSize({ width, height: 900 })
    const label = page.locator('label[for="customer-email"]')
    const alignment = await label.evaluate((element) => {
      const text = document.createRange()
      text.selectNodeContents(element.firstChild)
      const caption = text.getBoundingClientRect()
      const star = element.querySelector('.required').getBoundingClientRect()
      return { captionTop: caption.top, starTop: star.top, captionRight: caption.right, starLeft: star.left }
    })
    expect(Math.abs(alignment.captionTop - alignment.starTop)).toBeLessThan(2)
    expect(alignment.starLeft).toBeGreaterThanOrEqual(alignment.captionRight)
  }
  await expect(page.locator('.footer-actions .button')).toBeEnabled()
  await expect(page.locator('#customer-navigation-help')).toBeVisible()
  await expect(page.locator('.draft-toolbar .primary')).toBeEnabled()
  await page.locator('.draft-toolbar .primary').click()
  await expect(page.locator('#account-master-search-error')).toContainText('Required')
  expect(await page.evaluate(() => window.__draftCalls ?? [])).toEqual([])

  await page.locator('#account-master-search').fill('Acme')
  await page.locator('#account-master-options button').first().click()
  await expect(page.locator('#customer-name')).toBeEnabled()
  await expect(email).toHaveValue('draft@example.invalid')
  await page.getByRole('button', { name: 'Change Contact', exact: true }).click()
  await expect(email).toHaveValue('')
  await expect(page.locator('.footer-actions .button')).toBeEnabled()
  await page.locator('#customer-name').fill('Draft')
  await page.locator('#customer-name-options button').first().click()
  await expect(page.locator('#customer-name')).toHaveValue('Draft customer')
  await expect(email).toHaveValue('draft@example.invalid')
  await expect(email).toHaveJSProperty('readOnly', true)
  await expect(page.locator('#customer-phone')).toHaveJSProperty('readOnly', true)
  await expect(page.locator('.footer-actions .button')).toBeEnabled()
  await page.locator('.footer-actions .button').click()
  await expect(page.locator('#equipment-search')).toBeVisible()
})

for (const language of ['en', 'fr']) {
  for (const partial of [false, true]) {
    test(`Missing Contact details accept manual entry and save/reopen (${language}, linked=${partial})`, async ({ page }) => {
      await mockData(page, language, 'light')
      await page.addInitScript((linked) => {
        window.__contactMasterRecords = linked ? [{
          id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name:'Fetched Contact', email:'', phone:'',
          accountId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        }] : []
      }, partial)
      await page.goto('/')
      await page.locator('.main-nav .nav-item').nth(1).click()
      await page.locator('#estimate-title').fill('Manual contact regression')
      await page.locator('#branch-select').fill('020')
      await page.locator('#branch-select').press('ArrowDown')
      await page.locator('#branch-select').press('Enter')
      await page.locator('#equipment-type').selectOption('test-type')
      await page.locator('#opportunity-building').fill('Synthetic building')
      await page.locator('#account-master-search').fill('Acme')
      await page.locator('#account-master-options button').first().click()
      await expect(page.locator('.customer-defaults-state')).not.toContainText(/Fetching linked|Chargement des données/)
      if (partial) {
        await expect(page.locator('#customer-name')).toHaveValue('Fetched Contact')
        await expect(page.locator('#customer-name')).toHaveJSProperty('readOnly', true)
      } else {
        await page.locator('#customer-name').fill('Manual Contact')
      }
      await expect(page.locator('#customer-email')).toBeEditable()
      await expect(page.locator('#customer-phone')).toBeEditable()
      await page.locator('#customer-email').fill('manual@example.invalid')
      await page.locator('#customer-phone').fill('12345')
      await next(page)
      await pickEquipmentAndPackage(page)
      await expect(page.locator('.draft-toolbar .primary')).toBeEnabled()
      await page.locator('.draft-toolbar .primary').click()
      await expect.poll(() => page.evaluate(() => window.__draftSaved?.version)).toBe('1')
      const saved = await page.evaluate(() => window.__draftSaved)
      expect(saved.accountId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      expect(saved.contactId).toBe(partial ? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' : '')
      expect(saved.customer).toBe(partial ? 'Fetched Contact' : 'Manual Contact')
      expect(saved.email).toBe('manual@example.invalid')
      expect(saved.phone).toBe('12345')
      await page.locator('.main-nav .nav-item').first().click()
      await page.locator('.request-record').first().getByRole('button', { name: /Open draft|Ouvrir le brouillon/ }).click()
      await expect(page.locator('#customer-email')).toHaveValue('manual@example.invalid')
      await expect(page.locator('#customer-email')).toBeEditable()
      await expect(page.locator('#customer-phone')).toHaveValue('12345')
      if (!partial) await expect(page.locator('#customer-name')).toHaveValue('Manual Contact')
      await page.locator('#customer-email').fill('invalid-email')
      await expect(page.locator('.draft-toolbar .primary')).toBeEnabled()
      await page.locator('.draft-toolbar .primary').click()
      await expect(page.locator('#customer-email-error')).toContainText(language === 'fr' ? 'valide' : 'valid')
      expect(await page.evaluate(() => window.__draftSaved.version)).toBe('1')
      await page.locator('#customer-email').fill('updated@example.invalid')
      await page.locator('#customer-phone').fill('67890')
      await page.locator('.draft-toolbar .primary').click()
      await expect.poll(() => page.evaluate(() => window.__draftSaved?.version)).toBe('2')
      expect(await page.evaluate(() => window.__draftSaved.email)).toBe('updated@example.invalid')
      await page.getByRole('button', { name: /^(Change account|Changer de compte)$/ }).click()
      await expect(page.locator('#customer-email')).toHaveValue('')
      await expect(page.locator('#customer-phone')).toHaveValue('')
      await expect(page.locator('.draft-toolbar .primary')).toBeEnabled()
      await page.locator('.draft-toolbar .primary').click()
      await expect(page.locator('#account-master-search-error')).toBeVisible()
      expect(await page.evaluate(() => window.__draftSaved.version)).toBe('2')
    })
  }
}

for (const language of ['en', 'fr']) {
  test(`Missing customer masters do not block local navigation in ${language}`, async ({ page }) => {
    await mockData(page, language, 'light')
    await page.goto('/')
    await page.locator('.main-nav .nav-item').nth(1).click()
    const nextButton = page.locator('.footer-actions .button')
    await expect(nextButton).toBeEnabled()
    await nextButton.click()
    await expect(page.locator('#estimate-title-error')).toBeVisible()
    await page.locator('#estimate-title').fill('Local navigation')
    await page.locator('#branch-select').fill('020')
    await page.locator('#branch-select').press('ArrowDown')
    await page.locator('#branch-select').press('Enter')
    await expect(nextButton).toBeEnabled()
    await page.locator('#equipment-type').selectOption('test-type')
    await expect(nextButton).toBeEnabled()
    await page.locator('#opportunity-building').fill('Synthetic building')
    await expect(page.locator('#customer-email')).toHaveValue('')
    await expect(page.locator('#customer-navigation-help')).toContainText(
      language === 'fr' ? 'avant d’enregistrer ou de soumettre' : 'before saving or submitting')
    await expect(page.locator('.draft-toolbar .primary')).toBeEnabled()
    await next(page)
    await expect(page.locator('#equipment-search')).toBeVisible()
    await expect(nextButton).toBeEnabled()
    await nextButton.click()
    await expect(page.locator('#equipment-search-error')).toBeVisible()
    await expect(page.locator('#package-search-error')).toBeVisible()
    await page.locator('#equipment-search').fill('TEST')
    await page.locator('#equipment-options button').first().click()
    await page.locator('#package-search').fill('PK')
    await page.locator('#package-options button').first().click()
    await page.locator('#package-search').press('Escape')
    await next(page)
    await expect(page.locator('#request-re_additionallaborhours')).toBeVisible()
    await next(page)
    await expect(page.locator('#request-re_sellprice')).toBeVisible()
    await next(page)
    await expect(page.locator('.customer-summary')).toBeVisible()
    await expect(nextButton).toBeEnabled()
    await expect(page.locator('.draft-toolbar .primary')).toBeEnabled()
    expect(await page.evaluate(() => window.__draftCalls ?? [])).toEqual([])
    for (let step = 5; step > 1; step--) await page.locator('.form-footer > button').click()
    await expect(page.locator('#opportunity-building')).toHaveValue('Synthetic building')
    await expect(page.locator('#customer-email')).toHaveValue('')
  })
}

for (const dropAssignments of [false, true]) {
  test(`Package assignments survive save or report an outdated backend (${dropAssignments})`, async ({ page }) => {
    await page.addInitScript((drop) => {
      window.__dropPackageEquipment = drop
      window.__equipmentResults = ['TEST123', 'TEST456'].map((number, i) => ({
        re_equipmentid: `unit-${i}`, re_equipment: number, re_equipmentname: `Equipment ${number}`,
        re_functionallocation: 'Test location', re_oem: 'OEM', re_equipmentage: 20,
      }))
    }, dropAssignments)
    await completeDraft(page)
    for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
    await page.locator('#equipment-search').fill('TEST456')
    await page.locator('#equipment-options button').filter({ hasText: 'TEST456' }).first().click()
    await page.locator('#equipment-search').press('Escape')
    const group = page.locator('.selected-package-group')
    await group.locator('summary').click()
    await group.getByRole('checkbox', { name: 'TEST456', exact: true }).uncheck()
    await page.locator('.draft-save-action').click()
    if (dropAssignments) {
      await expect(page.locator('.draft-error')).toContainText('did not retain package equipment assignments')
      await expect(page.locator('.draft-saved')).toHaveCount(0)
    } else {
      await expect(page.locator('.draft-saved')).toBeVisible()
      expect(await page.evaluate(() => window.__draftSaved.packages[0].equipmentNumbers)).toEqual(['TEST123'])
    }
    await expect(group.locator('.equipment-package-card h4')).toHaveText(['TEST123'])
    await expect(group.locator('summary')).toContainText('1 / 2')
  })
}

for (const [language, width] of [['en', 1366], ['fr', 320]]) {
  test(`Package equipment subsets and customer-free local preview in ${language}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => {
      window.__equipmentResults = Array.from({ length: 5 }, (_, i) => ({
        re_equipmentid: `unit-${i}`, re_equipment: `TEST${i + 1}`, re_equipmentname: `Unit ${i + 1}`,
        re_functionallocation: 'Test location', re_oem: 'OEM', re_equipmentage: 20,
      }))
      window.__extraPackages = ['PIT', 'MR', 'DOOR'].map((number) => ({
        re_repairpackageid: number, re_packagenumber: number, re_packagenameen: number, re_packagenamefr: number,
        re_mechanichours: 1, re_materialmisctaxcost: 100, re_effectivefrom: '2020-01-01',
      }))
    })
    await mockData(page, language, 'light')
    await page.goto('/')
    await page.locator('.main-nav .nav-item').nth(1).click()
    await page.locator('#estimate-title').fill('Local package preview')
    await page.locator('#branch-select').fill('020')
    await page.locator('#branch-select').press('ArrowDown')
    await page.locator('#branch-select').press('Enter')
    await page.locator('#equipment-type').selectOption('test-type')
    await page.locator('#opportunity-building').fill('Synthetic building')
    await next(page)
    for (let i = 1; i <= 5; i++) {
      await page.locator('#equipment-search').fill(`TEST${i}`)
      await page.locator('#equipment-options button').filter({ hasText: `TEST${i}` }).first().click()
    }
    for (const number of ['PIT', 'MR', 'DOOR']) {
      await page.locator('#package-search').fill(number)
      await page.locator('#package-options button').filter({ hasText: number }).first().click()
    }
    await page.locator('#package-search').press('Escape')
    const groups = page.locator('.selected-package-group')
    const pit = groups.nth(0), mr = groups.nth(1), door = groups.nth(2)
    await pit.locator('summary').click()
    await pit.getByRole('checkbox', { name: 'TEST5', exact: true }).uncheck()
    await mr.locator('summary').click()
    for (const number of ['TEST4', 'TEST5']) await mr.getByRole('checkbox', { name: number, exact: true }).uncheck()
    await expect(pit.locator('summary')).toContainText('4 / 5')
    await expect(mr.locator('summary')).toContainText('3 / 5')
    await expect(door.locator('summary')).toContainText('5 / 5')
    for (const [index, count] of [4, 3, 5].entries())
      await expect(groups.nth(index).locator('.equipment-package-card')).toHaveCount(count)
    for (const number of ['TEST1', 'TEST2', 'TEST3', 'TEST4'])
      await pit.getByRole('checkbox', { name: number, exact: true }).uncheck()
    await expect(page.locator('.footer-actions .button')).toBeEnabled()
    await next(page)
    await expect(page.locator('#package-search-error')).toBeVisible()
    await pit.getByRole('button', { name: language === 'fr' ? 'Tous les équipements' : 'All equipment', exact: true }).click()
    await pit.getByRole('checkbox', { name: 'TEST5', exact: true }).uncheck()
    await checkLayout(page, { width, height: 900 }, 'equipment assignment controls')
    await next(page)
    await next(page)
    await expect(page.locator('.pricing-calculate-action')).toBeDisabled()
    await page.locator('.local-calculate-action').click()
    await expect(page.locator('.local-cost-total')).toContainText(language === 'fr' ? '2 628,00' : '2,628.00')
    expect(await page.evaluate(() => window.__draftCalls ?? [])).toEqual([])
    await page.locator('#request-re_sellprice').fill('9000')
    await expect(page.locator('.local-cost-total')).toHaveCount(0)
    await page.locator('.local-calculate-action').click()
    await expect(page.locator('.local-cost-total')).toBeVisible()
    await next(page)
    await page.locator('.local-calculate-action').click()
    await expect(page.locator('.local-cost-total')).toBeVisible()
    await expect(page.locator('.draft-toolbar .primary')).toBeEnabled()
    expect(await page.evaluate(() => window.__draftCalls ?? [])).toEqual([])
    for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
    await page.getByRole('button', { name: /^(Remove|Retirer) TEST1$/ }).click()
    await expect(pit.locator('summary')).toContainText('3 / 4')
    await expect(mr.locator('summary')).toContainText('2 / 4')
    await expect(door.locator('summary')).toContainText('4 / 4')
    await page.locator('#equipment-search').fill('TEST1')
    await page.locator('#equipment-options button').filter({ hasText: 'TEST1' }).first().click()
    await expect(pit.locator('summary')).toContainText('3 / 5')
    await expect(mr.locator('summary')).toContainText('2 / 5')
    await expect(door.locator('summary')).toContainText('5 / 5')
  })
}

for (const [width, language] of [[320, 'fr'], [1366, 'en']]) {
  test(`new request autofetches identity and linked customer defaults at ${width}px ${language}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await mockData(page, language, 'light')
    await page.goto('/')
    await expect(page.locator('.market-control select')).toBeEnabled()
    await page.evaluate(() => {
      window.__accountLocations = { 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': ['Source functional location'] }
      window.__accountLocationDescriptions = { 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': ['Source building description'] }
      window.__contactMasterRecords = [
        { id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Primary customer',email:'primary@example.invalid',
          phone:'12345',primary:true,accountId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        { id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',name:'Other customer',email:'other@example.invalid',
          phone:'67890',primary:false,accountId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      ]
    })
    await page.locator('.main-nav .nav-item').nth(1).click()
    await expect(page.locator('.brand-logo')).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
    await expect.poll(() => page.locator('.brand-logo').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true)
    await expect(page.locator('#estimate-title')).toHaveValue('')
    await expect(page.locator('#draft-currency')).toHaveValue('USD')
    await page.locator('#branch-select').fill('020')
    await page.locator('#branch-select').press('ArrowDown')
    await page.locator('#branch-select').press('Enter')
    await expect(page.locator('#draft-province')).toHaveValue(language === 'fr' ? 'Province test' : 'Test province')
    await expect(page.locator('#salesperson')).toHaveValue('Responsive Test User')
    await page.locator('#account-master-search').fill('00042')
    await page.locator('#account-master-options button').click()
    await expect(page.locator('#account-master-search')).toHaveValue('00042')
    const accountLabel = page.locator('label[for="account-master-search"] > span')
    const labelBounds = await accountLabel.boundingBox()
    const requiredBounds = await accountLabel.locator('.required').boundingBox()
    expect(labelBounds).not.toBeNull()
    expect(requiredBounds).not.toBeNull()
    expect(Math.abs(requiredBounds.y - labelBounds.y)).toBeLessThan(4)
    expect(requiredBounds.y + requiredBounds.height).toBeLessThanOrEqual(labelBounds.y + labelBounds.height + 1)
    await expect(page.locator('#account-master-name')).toHaveValue('Acme Corporation')
    await expect(page.locator('#account-master-name')).not.toBeEditable()
    await expect(page.locator('#estimate-title')).toHaveValue('')
    await expect(page.locator('#customer-name')).toHaveValue('Primary customer')
    await expect(page.locator('#customer-email')).toHaveValue('primary@example.invalid')
    await expect(page.locator('#customer-phone')).toHaveValue('12345')
    await expect(page.locator('#account-functional-locations')).toContainText('Source functional location')
    await expect(page.locator('#account-functional-locations input')).toHaveCount(0)
    await expect(page.locator('#opportunity-building')).toHaveValue('Source building description')
    await page.getByRole('button', { name: /^(Change Contact|Changer de contact)$/ }).click()
    await page.locator('.customer-linked-options button').filter({ hasText: 'Other customer' }).click()
    await expect(page.locator('#customer-email')).toHaveValue('other@example.invalid')
    await expect(page.locator('#customer-phone')).toHaveValue('67890')
    await checkLayout(page, { width, height: 900 }, 'customer autofetch')
    await page.getByRole('button', { name: /^(Change account|Changer de compte)$/ }).click()
    await expect(page.locator('#account-master-name')).toHaveValue('')
    await expect(page.locator('#customer-email')).toHaveValue('')
    await expect(page.locator('#customer-phone')).toHaveValue('')
    await expect(page.locator('#opportunity-building')).toHaveValue('')
    await expect(page.locator('#account-functional-locations')).toHaveCount(0)
    expect(await page.evaluate(() => window.__draftCalls?.length || 0)).toBe(0)
  })
}

test('superseded customer defaults cannot overwrite a new Account or a customized opportunity title', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await page.goto('/')
  await expect(page.locator('.market-control select')).toBeEnabled()
  await page.locator('.main-nav .nav-item').nth(1).click()
  await page.locator('#branch-select').fill('020')
  await page.locator('#branch-select').press('ArrowDown')
  await page.locator('#branch-select').press('Enter')
  await page.locator('#estimate-title').fill('My confirmed opportunity')
  await page.evaluate(() => {
    window.__accountMasterRecords = [
      {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',number:'00042',name:'Alpha',market:126110000},
      {id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',number:'00043',name:'Beta',market:126110000},
    ]
    window.__contactMasterRecords = [
      {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Alpha Contact',email:'alpha@example.invalid',phone:'111',accountId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},
      {id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',name:'Beta Contact',email:'beta@example.invalid',phone:'222',accountId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'},
    ]
    window.__accountLocations = {
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': ['Alpha location'],
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc': ['Beta location'],
    }
    window.__accountLocationDescriptions = {
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': ['Alpha description'],
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc': ['Beta description'],
    }
  })
  await page.locator('#account-master-search').fill('00042')
  await expect(page.locator('#account-master-options button')).toBeVisible()
  await page.evaluate(() => { window.__masterSearchDelay = 1500 })
  await page.locator('#account-master-options button').click()
  await expect.poll(() => page.evaluate(() => window.__masterSearchCalls.some(call =>
    call.mode === 'contactsearch' && call.accountId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'))).toBe(true)
  await page.getByRole('button', { name: 'Change account', exact: true }).click()
  await page.evaluate(() => { window.__masterSearchDelay = 0 })
  await page.locator('#account-master-search').fill('00043')
  await page.locator('#account-master-options button').click()
  await expect(page.locator('#customer-email')).toHaveValue('beta@example.invalid')
  await expect.poll(() => page.evaluate(() => window.__masterSearchCompleted.some(call =>
    call.mode === 'contactsearch' && call.accountId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'))).toBe(true)
  await expect(page.locator('#customer-email')).toHaveValue('beta@example.invalid')
  await expect(page.locator('#customer-phone')).toHaveValue('222')
  await expect(page.locator('#account-functional-locations')).toContainText('Beta location')
  await expect(page.locator('#opportunity-building')).toHaveValue('Beta description')
  await expect(page.locator('#estimate-title')).toHaveValue('My confirmed opportunity')
})

test('customer defaults do not guess ambiguous or truncated data and recover explicitly from read errors', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await page.goto('/')
  await expect(page.locator('.market-control select')).toBeEnabled()
  await page.locator('.main-nav .nav-item').nth(1).click()
  await page.locator('#branch-select').fill('020')
  await page.locator('#branch-select').press('ArrowDown')
  await page.locator('#branch-select').press('Enter')
  await page.evaluate(() => {
    window.__accountLocations = { 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': ['Site A', 'Site B'] }
    window.__contactsTruncated = true
  })
  await page.locator('#account-master-search').fill('00042')
  await page.locator('#account-master-options button').click()
  await expect(page.locator('.customer-defaults-state')).toContainText('More Contacts exist')
  await expect(page.locator('#customer-name')).toHaveValue('')
  await expect(page.locator('#customer-email')).toHaveValue('')
  await expect(page.locator('#opportunity-building')).toHaveValue('')
  await expect(page.locator('#account-functional-locations')).toContainText('Site A, Site B')
  await page.getByRole('button', { name: 'Change account', exact: true }).click()
  await page.locator('#account-master-search').fill('00042')
  await expect(page.locator('#account-master-options button')).toBeVisible()
  await page.evaluate(() => { window.__masterSearchError = 'Customer defaults access denied' })
  await page.locator('#account-master-options button').click()
  await expect(page.locator('.customer-defaults-state [role=alert]')).toContainText('Customer defaults access denied')
  await page.evaluate(() => {
    window.__masterSearchError = ''; window.__contactsTruncated = false
    window.__accountLocations = { 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': ['Site A'] }
  })
  await page.locator('.customer-defaults-state').getByRole('button', { name: 'Retry' }).click()
  await expect(page.locator('#customer-email')).toHaveValue('draft@example.invalid')
  await expect(page.locator('#account-functional-locations')).toContainText('Site A')
  await expect(page.locator('#opportunity-building')).toHaveValue('')
})

for (const language of ['en', 'fr']) test(`Required location dropdown receives focus on repeated validation (${language})`, async ({ page }) => {
  await mockData(page, language, 'light')
  await page.setViewportSize({ width: language === 'fr' ? 390 : 1366, height: 900 })
  await page.goto('/')
  await page.locator('.main-nav .nav-item').nth(1).click()
  await page.locator('#estimate-title').fill('Location validation')
  await page.locator('#branch-select').fill('020')
  await page.locator('#branch-select').press('ArrowDown')
  await page.locator('#branch-select').press('Enter')
  await page.locator('#equipment-type').selectOption('test-type')
  await page.evaluate(() => {
    window.__accountLocationDescriptions = { 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': ['Building A', 'Building B'] }
  })
  await page.locator('#account-master-search').fill('00042')
  await page.locator('#account-master-options button').click()
  const location = page.locator('#account-location-description')
  await expect(location.locator('option')).toHaveCount(4)
  for (const action of [page.locator('.draft-save-action'), page.locator('.draft-save-action'), page.locator('.footer-actions .button')]) {
    await action.click()
    await expect(location).toBeFocused()
    await expect(location).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('#opportunity-building-error')).toBeVisible()
  }
  expect(await page.evaluate(() => window.__draftCalls ?? [])).toEqual([])
  await location.selectOption(JSON.stringify(['FL00000002', 'Building B']))
  await expect(page.locator('#opportunity-building-error')).toHaveCount(0)
})

for (const language of ['en', 'fr']) test(`Repeated local save errors refocus the operation banner (${language})`, async ({ page }) => {
  await completeDraft(page, { width: language === 'fr' ? 390 : 1366, height: 900 }, language)
  for (let i = 0; i < 4; i++) await page.locator('.form-footer > button').click()
  await page.locator('#request-re_statedlaborrate').fill('-4')
  const error = page.locator('.draft-error')
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.locator('.draft-save-action').click()
    await expect(error).toBeFocused()
    await expect(error).toContainText(language === 'fr' ? 'Saisissez un taux horaire valide' : 'Enter a valid hourly rate')
  }
  expect(await page.evaluate(() => window.__draftCalls ?? [])).toEqual([])
  const rate = page.locator('#request-re_statedlaborrate')
  await rate.focus()
  await rate.press('ControlOrMeta+A')
  await rate.press('Backspace')
  await page.locator('.draft-save-action').click()
  await expect(error).toHaveCount(0)
  await expect(page.locator('.draft-saved')).toBeVisible()
  expect(await page.evaluate(() => window.__draftCalls.map(call => call.mode))).toEqual(['save'])
})

test('location descriptions offer explicit choices and preserve edits while incomplete defaults never autofill', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await page.goto('/')
  await expect(page.locator('.market-control select')).toBeEnabled()
  await page.locator('.main-nav .nav-item').nth(1).click()
  await page.locator('#branch-select').fill('020')
  await page.locator('#branch-select').press('ArrowDown')
  await page.locator('#branch-select').press('Enter')
  await page.evaluate(() => {
    window.__accountLocationDescriptions = { 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': ['Building A', 'Building B'] }
  })
  await page.locator('#account-master-search').fill('00042')
  await page.locator('#account-master-options button').click()
  await expect(page.locator('#account-location-description option')).toHaveCount(4)
  await expect(page.locator('#opportunity-building')).toHaveCount(0)
  await expect(page.locator('#account-location-description')).toContainText('FL00000002 — Building B')
  await page.locator('#account-location-description').selectOption(JSON.stringify(['FL00000002', 'Building B']))
  await expect(page.locator('#account-location-description')).toHaveValue(JSON.stringify(['FL00000002', 'Building B']))
  await page.locator('#account-location-description').selectOption('custom')
  await page.locator('#opportunity-building').fill('Confirmed site description')
  await expect(page.locator('#account-location-description')).toHaveCount(0)
  await page.getByRole('button', { name: 'Change account', exact: true }).click()
  await expect(page.locator('#opportunity-building')).toHaveValue('')
  await page.evaluate(() => {
    window.__accountLocationDescriptions = { 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': ['Building A'] }
    window.__locationDescriptionsTruncated = true
    window.__locationDescriptionsTooLong = true
    window.__locationNamesUnavailable = true
  })
  await page.locator('#account-master-search').fill('00042')
  await page.locator('#account-master-options button').click()
  await expect(page.locator('.customer-master-select')).toContainText('Incomplete list')
  await expect(page.locator('.customer-master-select')).toContainText('300-character limit')
  await expect(page.locator('.customer-master-select')).toContainText('verifiable source location number/name pair')
  await expect(page.locator('#account-location-description')).toHaveCount(0)
  await expect(page.locator('#opportunity-building')).toHaveValue('')
  await page.getByRole('button', { name: 'Use linked location', exact: true }).click()
  await expect(page.locator('#opportunity-building')).toHaveValue('Building A')
  await page.getByRole('button', { name: 'Change account', exact: true }).click()
  await page.evaluate(() => {
    window.__locationDescriptionsTruncated = false
    window.__locationDescriptionsTooLong = false
    window.__locationNamesUnavailable = false
  })
  await page.locator('#opportunity-building').fill('Manual building before lookup')
  await page.locator('#account-master-search').fill('00042')
  await page.locator('#account-master-options button').click()
  await expect(page.locator('#account-location-description')).toHaveCount(0)
  await expect(page.locator('#opportunity-building')).toHaveValue('Manual building before lookup')
})

for (const language of ['en', 'fr']) test(`Location description uses a value, multiple dropdown or missing free text (${language})`, async ({ page }) => {
  await mockData(page, language, 'light')
  await page.setViewportSize({ width: language === 'fr' ? 390 : 1366, height: 900 })
  await page.goto('/')
  await page.locator('.main-nav .nav-item').nth(1).click()
  await page.locator('#branch-select').fill('020')
  await page.locator('#branch-select').press('ArrowDown')
  await page.locator('#branch-select').press('Enter')
  for (const names of [['Sole source location'], ['First source location', 'Second source location'], []]) {
    await page.evaluate(values => {
      window.__accountLocationDescriptions = { 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': values }
    }, names)
    await page.locator('#account-master-search').fill('00042')
    await page.locator('#account-master-options button').first().click()
    await expect(page.locator('.customer-defaults-state')).not.toContainText(/Fetching linked|Chargement des données/)
    if (names.length > 1) {
      await expect(page.locator('#opportunity-building')).toHaveCount(0)
      const dropdown = page.locator('#account-location-description')
      await expect(dropdown).toBeVisible()
      await dropdown.selectOption(JSON.stringify(['FL00000002', names[1]]))
      await expect(dropdown.locator('option:checked')).toContainText(names[1])
    } else {
      await expect(page.locator('#account-location-description')).toHaveCount(0)
      const input = page.locator('#opportunity-building')
      await expect(input).toHaveValue(names[0] ?? '')
      await expect(input).toBeEditable()
      if (!names.length) {
        await input.fill('Estimate-only location description')
        await expect(input).toHaveValue('Estimate-only location description')
      }
    }
    await page.getByRole('button', { name: /^(Change account|Changer de compte)$/ }).click()
  }
})

for (const language of ['en', 'fr']) test(`Cached defaults preserve adaptive locations and manual Contacts across step returns (${language})`, async ({ page }) => {
  await mockData(page, language, 'light')
  await page.addInitScript(() => { window.__contactMasterRecords = [] })
  await page.setViewportSize({ width: language === 'fr' ? 390 : 1366, height: 900 })
  await page.goto('/')
  await page.locator('.main-nav .nav-item').nth(1).click()
  await page.locator('#estimate-title').fill('Merged defaults regression')
  await page.locator('#branch-select').fill('020')
  await page.locator('#branch-select').press('ArrowDown')
  await page.locator('#branch-select').press('Enter')
  await page.locator('#equipment-type').selectOption('test-type')
  const scenarios = [
    { names: ['Incomplete sole location'], expected: 'Incomplete sole location', incomplete: true },
    { names: ['First location', 'Second location'], expected: 'Second location', incomplete: false },
    { names: [], expected: 'Manual location', incomplete: false },
  ]
  const countDefaults = () => page.evaluate(() =>
    window.__masterSearchCalls.filter(call => call.mode === 'contactsearch' && !call.search).length)
  for (const [index, scenario] of scenarios.entries()) {
    await page.evaluate(({ names, incomplete }) => {
      window.__accountLocationDescriptions = { 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': names }
      window.__locationNamesUnavailable = incomplete
    }, scenario)
    await page.locator('#account-master-search').fill('00042')
    await page.locator('#account-master-options button').first().click()
    await expect(page.locator('#account-master-search')).toHaveValue('00042')
    await expect(page.locator('#customer-name')).toHaveAttribute('type', 'text')
    await page.locator('#customer-name').fill('Manual Contact')
    if (scenario.names.length > 1) {
      await page.locator('#account-location-description').selectOption(JSON.stringify(['FL00000002', scenario.expected]))
    } else if (scenario.incomplete) {
      await expect(page.locator('#account-location-description')).toHaveCount(0)
      await expect(page.locator('#opportunity-building')).toHaveValue('')
      await page.getByRole('button', { name: /^(Use linked location|Utiliser l’emplacement lié)$/ }).click()
    } else {
      await page.locator('#opportunity-building').fill(scenario.expected)
    }
    await next(page)
    await page.locator('.form-footer > button').click()
    await expect(page.locator('#customer-name')).toHaveValue('Manual Contact')
    await expect(page.locator('#customer-name')).toHaveAttribute('type', 'text')
    if (scenario.names.length > 1) {
      await expect(page.locator('#account-location-description')).toHaveValue(JSON.stringify(['FL00000002', scenario.expected]))
    } else {
      await expect(page.locator('#account-location-description')).toHaveCount(0)
      await expect(page.locator('#opportunity-building')).toHaveValue(scenario.expected)
    }
    expect(await countDefaults()).toBe(index + 1)
    await page.getByRole('button', { name: /^(Change account|Changer de compte)$/ }).click()
  }
})

for (const language of ['en', 'fr']) test(`Account location dropdown distinguishes equal names at different SAP locations (${language})`, async ({ page }) => {
  await mockData(page, language, 'light')
  await page.setViewportSize({ width: language === 'fr' ? 390 : 1366, height: 900 })
  await page.goto('/')
  await expect(page.locator('.market-control select')).toBeEnabled()
  await page.locator('.main-nav .nav-item').nth(1).click()
  await page.locator('#branch-select').fill('020')
  await page.locator('#branch-select').press('ArrowDown')
  await page.locator('#branch-select').press('Enter')
  await page.evaluate(() => {
    window.__accountLocations = { 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': ['FL00000001', 'FL00000002'] }
    window.__accountLocationDescriptions = { 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': ['Same building'] }
    window.__accountLocationOptions = { 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': [
      { number: 'FL00000001', name: 'Same building' }, { number: 'FL00000002', name: 'Same building' },
    ] }
  })
  await page.locator('#account-master-search').fill('00042')
  await page.locator('#account-master-options button').click()
  await expect(page.locator('#account-location-description option')).toHaveCount(4)
  await expect(page.locator('#opportunity-building')).toHaveCount(0)
  await page.locator('#account-location-description').selectOption(JSON.stringify(['FL00000002', 'Same building']))
  await expect(page.locator('#account-location-description')).toHaveValue(JSON.stringify(['FL00000002', 'Same building']))
  await expect(page.locator('#account-location-description option:checked')).toContainText('Same building')
  await expect(page.locator('#equipment-search')).toHaveCount(0)
})

test('location defaults cannot overwrite an edit entered while the lookup is in flight', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await page.goto('/')
  await expect(page.locator('.market-control select')).toBeEnabled()
  await page.locator('.main-nav .nav-item').nth(1).click()
  await page.locator('#branch-select').fill('020')
  await page.locator('#branch-select').press('ArrowDown')
  await page.locator('#branch-select').press('Enter')
  await page.locator('#account-master-search').fill('00042')
  await expect(page.locator('#account-master-options button')).toBeVisible()
  await page.evaluate(() => {
    window.__masterSearchDelay = 1000
    window.__accountLocationDescriptions = { 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': ['Source description'] }
  })
  await page.locator('#account-master-options button').click()
  await page.locator('#opportunity-building').fill('Confirmed during lookup')
  await expect.poll(() => page.evaluate(() => window.__masterSearchCompleted.some(call =>
    call.mode === 'contactsearch' && call.search === ''))).toBe(true)
  await expect(page.locator('#account-location-description')).toHaveCount(0)
  await expect(page.locator('#opportunity-building')).toHaveValue('Confirmed during lookup')
})

for (const [language, width] of [['en', 1366], ['fr', 390]]) {
  test(`Freestyle opportunity and missing Contact keep location unobscured (${language})`, async ({ page }) => {
    await mockData(page, language, 'light')
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => { window.__contactMasterRecords = [] })
    await page.goto('/')
    await page.locator('.main-nav .nav-item').nth(1).click()
    const title = page.locator('#estimate-title')
    await expect(title).toHaveValue('')
    await title.fill('Free style / opportunity 42')
    await title.fill('')
    await expect(title).toHaveValue('')
    await title.fill('Free style / opportunity 42')
    await page.locator('#branch-select').fill('020')
    await page.locator('#branch-select').press('ArrowDown')
    await page.locator('#branch-select').press('Enter')
    await page.locator('#account-master-search').fill('Acme')
    await page.locator('#account-master-options button').first().click()
    await expect(page.locator('.customer-defaults-state')).not.toContainText(/Fetching linked|Chargement des données/)
    await expect(title).toHaveValue('Free style / opportunity 42')
    const contact = page.locator('#customer-name')
    await expect(contact).toHaveAttribute('type', 'text')
    await expect(contact).not.toHaveAttribute('role', 'combobox')
    await contact.fill('Estimate only contact')
    await expect(page.getByRole('region', { name: /Contact results|Résultats de contacts/ })).toHaveCount(0)
    const locationLabel = page.locator('label[for="opportunity-building"]')
    await expect(locationLabel).toBeVisible()
    await page.locator('#opportunity-building').fill('Confirmed location')
    await expect(page.locator('#opportunity-building')).toHaveValue('Confirmed location')
    const searchedContacts = await page.evaluate(() => (window.__masterSearchCalls ?? [])
      .filter(call => call.mode === 'contactsearch' && call.search))
    expect(searchedContacts).toEqual([])
    await checkLayout(page, { width, height: 900 }, 'missing Contact freestyle')
  })

  test(`Clickable actions show required messages and block invalid persistence (${language})`, async ({ page }) => {
    await mockData(page, language, 'light')
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await page.locator('.main-nav .nav-item').nth(1).click()
    const nextButton = page.locator('.footer-actions .button')
    const save = page.locator('.draft-save-action')
    await expect(nextButton).toBeEnabled()
    await expect(save).toBeEnabled()
    await expect(page.locator('.field-error')).toHaveCount(0)
    await nextButton.click()
    for (const id of ['estimate-title', 'branch-select', 'opportunity-building', 'equipment-type'])
      await expect(page.locator(`#${id}-error`)).toHaveText(language === 'fr' ? 'Champ obligatoire.' : 'Required field.')
    await expect(page.locator('#estimate-title')).toBeFocused()
    await page.locator('#estimate-title').fill('Mandatory message regression')
    await expect(page.locator('#estimate-title-error')).toHaveCount(0)
    await save.click()
    await expect(page.locator('#account-master-search-error')).toBeVisible()
    await expect(page.locator('#customer-name-error')).toBeVisible()
    await expect(page.locator('#customer-email-error')).toBeVisible()
    expect(await page.evaluate(() => window.__draftCalls ?? [])).toEqual([])
    await page.locator('#branch-select').fill('020')
    await page.locator('#branch-select').press('ArrowDown')
    await page.locator('#branch-select').press('Enter')
    await page.locator('#equipment-type').selectOption('test-type')
    await page.locator('#opportunity-building').fill('Location')
    await nextButton.click()
    await nextButton.click()
    await expect(page.locator('#equipment-search-error')).toBeVisible()
    await expect(page.locator('#package-search-error')).toBeVisible()
    await pickEquipmentAndPackage(page)
    await expect(page.locator('#equipment-search-error')).toHaveCount(0)
    await expect(page.locator('#package-search-error')).toHaveCount(0)
    page.once('dialog', dialog => dialog.accept())
    await page.locator('.draft-secondary-actions button').first().click()
    await expect(page.locator('#estimate-title')).toHaveValue('')
    await expect(page.locator('.field-error')).toHaveCount(0)
  })
}

test('Unmatched Contact popup dismisses on blur and never overlays the location label', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await page.addInitScript(() => {
    window.__contactMasterRecords = [
      {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'First',email:'first@example.invalid',phone:'111',accountId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},
      {id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',name:'Second',email:'second@example.invalid',phone:'222',accountId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},
    ]
  })
  await page.goto('/')
  await page.locator('.main-nav .nav-item').nth(1).click()
  await page.locator('#branch-select').fill('020')
  await page.locator('#branch-select').press('ArrowDown')
  await page.locator('#branch-select').press('Enter')
  await page.locator('#account-master-search').fill('Acme')
  await page.locator('#account-master-options button').first().click()
  await expect(page.locator('.customer-defaults-state')).toContainText('Choose a linked Contact')
  await page.locator('#customer-name').fill('Unmatched')
  const popup = page.getByRole('region', { name: 'Contact results' })
  await expect(popup).toContainText('No matching Contacts')
  const popupBox = await popup.boundingBox()
  const locationBox = await page.locator('label[for="opportunity-building"]').boundingBox()
  expect(popupBox.y + popupBox.height).toBeLessThanOrEqual(locationBox.y)
  await page.locator('#opportunity-building').focus()
  await expect(popup).toHaveCount(0)
  await page.locator('#customer-name').focus()
  await expect(popup).toBeVisible()
  await page.locator('#customer-name').press('Escape')
  await expect(popup).toHaveCount(0)
})

test('Save and submit return to missing fields on earlier steps with inline messages', async ({ page }) => {
  await completeDraft(page)
  for (let i = 0; i < 4; i++) await page.locator('.form-footer > button').click()
  await page.locator('#request-re_proposallanguage').selectOption('')
  for (let i = 0; i < 4; i++) await next(page)
  await page.locator('.draft-save-action').click()
  await expect(page.locator('#request-re_proposallanguage-error')).toHaveText('Required field.')
  await page.locator('#request-re_proposallanguage').selectOption('126110000')
  await expect(page.locator('#request-re_proposallanguage-error')).toHaveCount(0)
  for (let i = 0; i < 4; i++) await next(page)
  await page.locator('.form-footer > button').click()
  await page.locator('#request-re_sellprice').focus()
  await page.locator('#request-re_sellprice').fill('')
  await expect(page.locator('#request-re_sellprice')).toHaveValue('')
  await page.locator('#request-re_billingplan').selectOption('')
  await next(page)
  const submit = page.locator('.footer-actions .button')
  await expect(submit).toBeEnabled()
  await submit.click()
  await expect(page.locator('#request-re_sellprice-error')).toContainText('greater than zero')
  await expect(page.locator('#request-re_billingplan-error')).toHaveText('Select a billing plan before submitting.')
  await expect(page.locator('#request-re_sellprice')).toBeFocused()
  expect(await page.evaluate(() => window.__draftCalls ?? [])).toEqual([])
})

for (const language of ['en', 'fr']) test(`Submit focuses the missing billing plan (${language})`, async ({ page }) => {
  await completeDraft(page, { width: language === 'fr' ? 390 : 1366, height: 900 }, language)
  await page.locator('.form-footer > button').click()
  await expect(page.locator('label[for="request-re_billingplan"] .required')).toHaveText('*')
  await expect(page.locator('#request-re_billingplan')).toHaveAttribute('aria-required', 'true')
  await page.locator('#request-re_billingplan').selectOption('')
  await next(page)
  await page.locator('.footer-actions .button').click()
  await expect(page.locator('#request-re_billingplan')).toBeFocused()
  await expect(page.locator('#request-re_billingplan-error')).toHaveText(language === 'fr'
    ? 'Sélectionnez un plan de facturation avant de soumettre.'
    : 'Select a billing plan before submitting.')
  expect(await page.evaluate(() => window.__draftCalls ?? [])).toEqual([])
  await page.locator('#request-re_billingplan').selectOption('126110000')
  await next(page)
  page.once('dialog', dialog => dialog.accept())
  await page.locator('.footer-actions .button').click()
  await expect(page.locator('.unsaved-badge')).toContainText(language === 'fr' ? 'Soumis' : 'Submitted')
  expect(await page.evaluate(() => (window.__draftCalls ?? []).map(call => call.mode))).toEqual(['submit'])
})

const requiredFieldCases = [
  { id: 'estimate-title', property: 'title' },
  { id: 'branch-select', property: 'branchId', disabled: true },
  { id: 'account-master-search', property: 'accountId' },
  { id: 'customer-name', property: 'customer' },
  { id: 'customer-email', property: 'email' },
  { id: 'opportunity-building', property: 'building' },
  { id: 'equipment-type', property: 'equipmentTypeId' },
  { id: 'draft-province', property: 'stateId', disabled: true },
  { id: 'draft-currency', currency: true },
  { id: 'request-re_proposallanguage', field: 're_proposallanguage' },
  { id: 'equipment-search', collection: 'equipment' },
  { id: 'package-search', collection: 'packages' },
  { id: 'request-re_timecategory', field: 're_timecategory' },
  { id: 'request-re_usetax', field: 're_usetax', custom: true },
  { id: 'request-re_freight', field: 're_freight', custom: true },
  { id: 'request-re_sellprice', field: 're_sellprice', submit: true },
  { id: 'request-re_billingplan', field: 're_billingplan', submit: true },
]

for (const language of ['en', 'fr']) {
  for (const missing of requiredFieldCases) test(`Required field highlights and blocks persistence: ${missing.id} (${language})`, async ({ page }) => {
    await completeDraft(page, { width: language === 'fr' ? 390 : 1366, height: 900 }, language)
    await page.locator('.draft-save-action').click()
    await expect(page.locator('.draft-saved')).toBeVisible()
    await page.evaluate(missing => {
      const record = window.__draftSaved
      if (missing.property) record[missing.property] = ''
      if (missing.collection) record[missing.collection] = []
      if (missing.field) record.fields = record.fields.filter(field => field.key !== missing.field)
      if (missing.custom) record.packages[0].isCustom = true
      if (missing.currency) record.branchId = 'missing-branch-configuration'
      if (missing.property === 'customer') {
        record.contactId = ''
        record.contactMaster = undefined
        window.__contactMasterRecords = []
      }
      window.__draftCalls = []
    }, missing)
    await page.locator('.draft-secondary-actions button').nth(1).click()
    await expect(page.locator('#estimate-title')).toBeVisible()
    if (missing.submit) {
      for (let step = 0; step < 4; step++) await next(page)
      await page.locator('.footer-actions .button').click()
    } else await page.locator('.draft-save-action').click()
    const control = page.locator(`#${missing.id}`)
    const error = page.locator(`#${missing.id}-error`)
    await expect(error).toBeVisible()
    await expect(control).toHaveAttribute('aria-invalid', 'true')
    await expect(control).toHaveAttribute('aria-describedby', new RegExp(`${missing.id}-error`))
    await expect(missing.disabled ? error : control).toBeFocused()
    expect(await page.evaluate(() => (window.__draftCalls ?? []).filter(call =>
      call.mode === 'save' || call.mode === 'submit'))).toEqual([])
  })
}

for (const language of ['en', 'fr']) test(`Unified customer fields offer one control and linked dropdown or custom entry (${language})`, async ({ page }) => {
  await mockData(page, language, 'light')
  const width = language === 'fr' ? 390 : 1366
  await page.setViewportSize({ width, height: 1000 })
  await page.goto('/')
  await page.locator('.main-nav .nav-item').nth(1).click()
  await page.locator('#branch-select').fill('020')
  await page.locator('#branch-select').press('ArrowDown')
  await page.locator('#branch-select').press('Enter')
  await page.evaluate(() => {
    window.__contactMasterRecords = [
      {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'First Contact',email:'first@example.invalid',phone:'111',accountId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},
      {id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',name:'Second Contact',email:'second@example.invalid',phone:'222',accountId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},
    ]
    window.__accountLocationDescriptions = { 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': ['Building A', 'Building B'] }
  })
  await page.locator('#account-master-search').fill('00042')
  await page.locator('#account-master-options button').click()
  await expect(page.locator('.customer-defaults-state')).toContainText(/Choose a linked Contact|Choisissez un contact/)
  await expect(page.locator('#customer-manual-name')).toHaveCount(0)
  await page.locator('#customer-name').focus()
  await expect(page.locator('#customer-name-options button')).toHaveCount(2)
  await page.locator('#customer-name').press('ArrowDown')
  await expect(page.locator('#customer-name-options button').first()).toBeFocused()
  await page.locator('#customer-name-options button').filter({hasText:'Second Contact'}).click()
  await expect(page.locator('#customer-name')).toHaveValue('Second Contact')
  await expect(page.locator('#customer-email')).toHaveValue('second@example.invalid')
  await expect(page.locator('#customer-phone')).toHaveValue('222')
  await expect(page.locator('#opportunity-building')).toHaveCount(0)
  await page.locator('#account-location-description').selectOption('custom')
  await page.locator('#opportunity-building').fill('Custom building')
  await expect(page.locator('#account-location-description')).toHaveCount(0)
  const contact = await page.locator('#customer-name').boundingBox()
  const location = await page.locator('#opportunity-building').boundingBox()
  expect(Math.abs(contact.x - location.x)).toBeLessThan(2)
  expect(location.y).toBeGreaterThan(contact.y + contact.height)
  await checkLayout(page, { width, height: 1000 }, 'unified customer fields')
  await page.getByRole('button', { name: /^(Change account|Changer de compte)$/ }).click()
  await page.evaluate(() => {
    window.__contactMasterRecords = window.__contactMasterRecords.slice(0, 1)
    window.__masterSearchDelay = 1000
    window.__masterSearchCompleted = []
  })
  await page.locator('#account-master-search').fill('00042')
  await page.locator('#account-master-options button').click()
  await page.locator('#customer-name').fill('Confirmed manual name')
  await expect.poll(() => page.evaluate(() => window.__masterSearchCompleted.some(call =>
    call.mode === 'contactsearch' && call.search === ''))).toBe(true)
  await expect(page.locator('#customer-name')).toHaveValue('Confirmed manual name')
  await expect(page.locator('#customer-email')).toHaveValue('')
})

for (const language of ['en', 'fr']) {
  test(`Account and Contact search preserve their relationship in ${language}`, async ({ page }) => {
    await mockData(page, language, 'light')
    await page.goto('/')
    await expect(page.locator('.market-control select')).toBeEnabled()
    await page.evaluate(() => {
      const market = 126110000;
      window.__accountMasterRecords = [
        {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',number:'00042',name:'Alpha Account',market},
        {id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',number:'00043',name:'Beta Account',market},
      ];
      window.__contactMasterRecords = [
        {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Alex Alpha',email:'alex.alpha@example.invalid',phone:'111',accountId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},
        {id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',name:'Alex Beta',email:'alex.beta@example.invalid',phone:'222',accountId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'},
      ];
    })
    await page.locator('.main-nav .nav-item').nth(1).click()
    await page.locator('#account-master-search').fill('Alpha')
    await expect(page.locator('#account-master-options [role=option]')).toHaveCount(1)
    await page.locator('#account-master-options button').click()
    const contact = page.locator('#customer-name')
    await contact.fill('Alex')
    await expect(page.locator('#customer-name-options [role=option]')).toHaveCount(1)
    await expect(page.locator('#customer-name-options')).toContainText('alex.alpha@example.invalid')
    await page.locator('#customer-name-options button').click()
    await expect(contact).toHaveValue('Alex Alpha')
    await expect(page.locator('#customer-email')).toHaveValue('alex.alpha@example.invalid')
    await page.getByRole('button', { name: language === 'fr' ? 'Changer de compte' : 'Change account' }).click()
    await expect(contact).toBeDisabled()
    await expect(contact).toHaveValue('')
    await page.locator('#account-master-search').fill('Beta')
    await page.locator('#account-master-options button').click()
    await contact.fill('Alex')
    await expect(page.locator('#customer-name-options')).toContainText('alex.beta@example.invalid')
    await expect(page.locator('#customer-name-options')).not.toContainText('alex.alpha@example.invalid')
  })
}

test('customer master search shows errors, recovers on a new query and respects result limits', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await page.goto('/')
  await expect(page.locator('.market-control select')).toBeEnabled()
  await page.locator('.main-nav .nav-item').nth(1).click()
  await page.evaluate(() => { window.__masterSearchError = 'Account access denied' })
  const account = page.locator('#account-master-search')
  await account.fill('Acme')
  await expect(page.locator('.branch-popup [role=alert]')).toContainText('Account access denied')
  await page.evaluate(() => {
    window.__masterSearchError = '';
    window.__masterSearchDelay = 300;
    window.__accountMasterRecords = Array.from({length:25}, (_,i) => ({
      id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,
      number:`A${String(i).padStart(3,'0')}`,name:`Account ${String(i).padStart(2,'0')}`,market:126110000
    }));
  })
  await account.fill('Account')
  await expect(page.getByText('Searching…', { exact: true })).toBeVisible()
  await expect(page.locator('#account-master-options [role=option]')).toHaveCount(20)
})

for (const language of ['en', 'fr']) {
  test(`imported equipment details display without changing saved financial snapshots in ${language}`, async ({ page }) => {
    const fr = language === 'fr'
    const viewport = { width: fr ? 320 : 1366, height: 900 }
    await completeDraft(page, viewport, language)
    for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
    await page.evaluate(() => {
      window.__equipmentResults = [{
        re_equipmentid: 'imported-details', re_equipment: 'UNIT999',
        re_functionallocation: 'FL-TEST', re_description: 'Imported equipment description',
        re_manufacturer: 'Imported manufacturer', re_constructionyear: new Date().getFullYear() - 12,
      }]
    })
    await page.locator('#equipment-search').fill('UNIT999')
    const option = page.locator('#equipment-options button').filter({ hasText: 'UNIT999' }).first()
    await expect(option).toContainText('Description: Imported equipment description')
    await expect(option).toContainText('Imported manufacturer')
    await expect(option).toContainText(fr ? 'Âge: 12' : 'Age: 12')
    await expect(option).toContainText('FL-TEST')
    await option.click()
    await page.locator('#equipment-search').press('Escape')
    const card = page.locator('.equipment-card').filter({ hasText: 'UNIT999' })
    await expect(card).toContainText('Description: Imported equipment description')
    await expect(card).toContainText('Imported manufacturer')
    await expect(card).toContainText(fr ? 'Âge: 12' : 'Age: 12')
    await expect(card).toContainText('FL-TEST')
    await checkLayout(page, viewport, 'imported equipment source details')
    await page.locator('.draft-save-action').click()
    await expect(page.locator('.draft-saved')).toBeVisible()
    const saved = await page.evaluate(() => window.__draftCalls.at(-1).equipment.find(item => item.number === 'UNIT999'))
    expect(saved.name).toBe('')
    expect(saved.oem).toBe('')
    expect(saved.age).toBeUndefined()
    expect(saved).not.toHaveProperty('re_description')
    await page.locator('.draft-secondary-actions button').nth(1).click()
    await next(page)
    await expect(card).toContainText('Imported equipment description')
    await expect(card).toContainText('Imported manufacturer')
    await expect(card).toContainText(fr ? 'Âge: 12' : 'Age: 12')
    await expect(page.locator('.unsaved-badge')).not.toContainText(fr ? 'Non enregistré' : 'Not saved')
  })
}

test('bulk equipment paste can select more than fourteen matched units', async ({ page }) => {
  await completeDraft(page, { width: 1366, height: 768 }, 'en')
  for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
  await page.evaluate(() => {
    window.__equipmentResults = Array.from({ length: 20 }, (_, i) => ({
      re_equipmentid: `bulk-${i}`, re_equipment: `20000${String(i).padStart(3, '0')}`,
      re_equipmentname: `Bulk equipment ${i}`, re_functionallocation: 'Test location',
      re_soldtoname: 'Test customer',
    }))
  })
  await page.locator('#equipment-search').focus()
  await page.evaluate(() => {
    const data = new DataTransfer()
    data.setData('text', window.__equipmentResults.map((item) => item.re_equipment).join('\n'))
    document.querySelector('#equipment-search').dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  })
  await expect(page.locator('.selected-card').first().locator('.equipment-card')).toHaveCount(21)
  await expect(page.locator('.paste-summary')).toContainText('20')
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toBeVisible()
  const saved = await page.evaluate(() => window.__draftSaved.equipment)
  expect(saved).toHaveLength(21)
  expect(saved.every((item) => item.matched)).toBe(true)
  await page.locator('.draft-secondary-actions button').nth(1).click()
  await next(page)
  await expect(page.locator('.selected-card').first().locator('.equipment-card')).toHaveCount(21)
})

for (const language of ['en', 'fr']) {
  for (const action of ['click', 'Enter']) {
    test(`typed equipment list adds separate matched units using ${action} in ${language}`, async ({ page }) => {
      await completeDraft(page, { width: 1366, height: 768 }, language)
      for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
      await page.evaluate(() => {
        window.__equipmentResults = ['20000364', '20000372'].map((number) => ({
          re_equipmentid: `equipment-${number}`, re_equipment: number,
          re_equipmentname: `Catalog ${number}`, re_functionallocation: 'Test location',
        }))
      })
      const input = page.locator('#equipment-search')
      await input.fill('20000364,20000372')
      const option = page.locator('#equipment-options button')
      await expect(option).toHaveCount(1)
      await expect(option).toContainText(language === 'fr' ? 'Ajouter la liste des équipements' : 'Add equipment list')
      await expect(page.locator('#equipment-options')).not.toContainText('Add as unlisted equipment')
      if (action === 'click') await option.click()
      else await input.press('Enter')
      const cards = page.locator('.selected-card').first().locator('.equipment-card')
      await expect(cards).toHaveCount(3)
      await expect(cards.filter({ hasText: '20000364' })).toHaveCount(1)
      await expect(cards.filter({ hasText: '20000372' })).toHaveCount(1)
      await expect(cards.locator('.unbound-tag')).toHaveCount(0)
      await expect(input).toHaveValue('')
    })
  }
}

test('bulk equipment paste warns about missing numbers and typed search still works afterwards', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await page.goto('/')
  await expect(page.locator('.market-control select')).toBeEnabled()
  await page.locator('.main-nav .nav-item').nth(1).click()
  await page.locator('#estimate-title').fill('Paste test')
  await page.locator('#branch-select').fill('020')
  await page.locator('#branch-select').press('ArrowDown')
  await page.locator('#branch-select').press('Enter')
  await page.locator('#equipment-type').selectOption('test-type')
  await page.locator('#opportunity-building').fill('Building 42')
  await selectCustomerMasters(page)
  await next(page)
  await page.locator('#equipment-search').focus()
  await page.evaluate(() => {
    const data = new DataTransfer()
    data.setData('text', 'TEST123\nMISSING1; TEST123')
    document.querySelector('#equipment-search').dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  })
  await expect(page.locator('.warning-box')).toContainText('MISSING1')
  await expect(page.locator('#equipment-search')).toHaveValue('')
  const selected = page.locator('.selected-card').first().locator('.equipment-card')
  await expect(selected).toHaveCount(1)
  await expect(selected.locator('.unbound-tag')).toHaveCount(0)
  await selected.locator('.remove-button').click()

  await page.locator('#equipment-search').fill('TEST')
  await expect(page.locator('#equipment-options [role=option]').first()).toContainText('TEST123')
  await expect(page.locator('.warning-box')).toHaveCount(0)
  await page.locator('#equipment-options button').first().click()
  await expect(selected).toHaveCount(1)
  await expect(selected.locator('.unbound-tag')).toHaveCount(0)
})

for (const language of ['en', 'fr']) {
  test(`customer required marker stays inline and inputs align in ${language}`, async ({ page }) => {
    await completeDraft(page, { width: 1366, height: 768 }, language)
    for (let i = 0; i < 4; i++) await page.locator('.form-footer > button').click()
    const geometry = await page.locator('label[for=customer-name]').evaluate((label) => {
      const captionText = document.createRange()
      captionText.selectNodeContents(label.firstChild)
      const caption = captionText.getBoundingClientRect()
      const marker = label.querySelector('.required').getBoundingClientRect()
      const account = document.querySelector('#account-master-search').getBoundingClientRect()
      const input = document.querySelector('#customer-name').getBoundingClientRect()
      const email = document.querySelector('#customer-email').getBoundingClientRect()
      const phone = document.querySelector('#customer-phone').getBoundingClientRect()
      return {
        inline: Math.abs(marker.top - caption.top) <= 2 && marker.left >= caption.right,
        aligned: Math.abs(account.top - input.top) <= 1,
        detailsAligned: Math.abs(email.top - phone.top) <= 1,
      }
    })
    expect(geometry).toEqual({ inline: true, aligned: true, detailsAligned: true })
  })
}

for (const language of ['en', 'fr']) {
  test(`Choice fields use live Dataverse values and ${language} labels, preserving selection through save and reopen`, async ({ page }) => {
    await completeDraft(page, { width: 1366, height: 768 }, language)
    await page.evaluate(() => {
      window.__paperTypeOptions = [
        { value: 727000042, en: 'Published customer contract', fr: 'Contrat client publié' },
        { value: 17, en: 'English-only contract' },
      ]
    })
    for (let i = 0; i < 4; i++) await page.locator('.form-footer > button').click()
    const paper = page.locator('#request-re_papertype')
    await expect(paper).toBeEnabled()
    await expect(paper.locator('option[value="727000042"]')).toHaveText(language === 'fr'
      ? 'Contrat client publié' : 'Published customer contract')
    await expect(paper.locator('option[value="17"]')).toHaveText('English-only contract')
    await expect(paper.locator('option[value="126110000"]')).toHaveCount(0)
    await expect(page.locator('#request-re_nationalaccount option')).toHaveText(language === 'fr'
      ? ['Choisir une option', 'Oui', 'Non', 'Inconnu'] : ['Select an option', 'Yes', 'No', 'Unknown'])
    await expect(page.locator('#request-re_competingbids option[value="126110002"]'))
      .toHaveText(language === 'fr' ? 'Soupçonnées' : 'Suspected')
    await paper.selectOption('727000042')
    await page.locator('#request-re_nationalaccount').selectOption('126110002')
    await page.locator('.draft-save-action').click()
    await expect.poll(() => page.evaluate(() => window.__draftSaved?.fields.find((field) => field.key === 're_papertype')?.value))
      .toBe('727000042')
    expect(await page.evaluate(() => window.__draftSaved.fields.find((field) => field.key === 're_nationalaccount')?.value))
      .toBe('126110002')
    await page.locator('.draft-secondary-actions button').nth(1).click()
    await expect(page.locator('#request-re_papertype')).toHaveValue('727000042')
    await expect(page.locator('#request-re_nationalaccount')).toHaveValue('126110002')
  })
}

test('Choice metadata failures are retryable, and removed saved choices remain visible with a warning', async ({ page }) => {
  await completeDraft(page)
  await page.evaluate(() => { window.__choiceError = 'Metadata access denied' })
  for (let i = 0; i < 4; i++) await page.locator('.form-footer > button').click()
  const paper = page.locator('#request-re_papertype')
  await expect(paper).toBeDisabled()
  await expect(page.locator('#request-re_workcenterrequest')).toBeDisabled()
  await expect(page.getByRole('alert').filter({ hasText: 'Metadata access denied' })).toHaveCount(1)
  await page.evaluate(() => { window.__choiceError = '' })
  await page.getByRole('alert').filter({ hasText: 'Metadata access denied' }).getByRole('button', { name: 'Retry' }).click()
  await expect(paper).toBeEnabled()
  await expect(page.locator('#request-re_workcenterrequest')).toBeEnabled()
  await expect(paper.locator('option')).toHaveText(['Select an option', 'Non KONE Paper', 'Kone Paper', 'NA'])
  await paper.selectOption('126110001')
  await page.locator('.draft-save-action').click()
  await expect.poll(() => page.evaluate(() => window.__draftSaved?.version)).toBe('1')
  await page.evaluate(() => { window.__paperTypeOptions = [{ value: 17, en: 'New published contract' }] })
  await page.locator('.draft-secondary-actions button').nth(1).click()
  await next(page)
  await page.locator('.form-footer > button').click()
  await expect(paper).toHaveValue('126110001')
  await expect(page.getByRole('alert').filter({ hasText: 'no longer in the published choices' })).toBeVisible()
  await paper.selectOption('17')
  await expect(page.getByRole('alert').filter({ hasText: 'no longer in the published choices' })).toHaveCount(0)
})

test('Choice adapter reads published stringmaps with English and French labels', async ({ page }) => {
  await page.route('**/src/data/stringMapService.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export async function getStringMaps(filter) {
      window.__stringMapRequest = filter;
      return { success: true, data: { value: [
        { attributename: 're_papertype', attributevalue: 126110001, value: 'Kone Paper', langid: 1033, displayorder: 2 },
        { attributename: 're_papertype', attributevalue: 126110000, value: 'Papier non KONE', langid: 1036, displayorder: 1 },
        { attributename: 're_papertype', attributevalue: 126110000, value: 'Non KONE Paper', langid: 1033, displayorder: 1 },
      ] } };
    }
    export async function getGlobalOptionSet() { throw new Error('unexpected'); }`,
  }))
  await page.route('**/src/generated/services/Re_DraftEstimateService.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export class Re_DraftEstimateService { static async re_DraftEstimate() { window.__draftApiCalled = true; throw new Error('unexpected'); } }`,
  }))
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { getDraftChoices } = await import('/src/data/draftChoiceRepository.ts')
    const choices = await getDraftChoices(['re_papertype'])
    return { choices, request: window.__stringMapRequest, draftApiCalled: window.__draftApiCalled ?? false }
  })
  expect(result.request).toBe("objecttypecode eq 're_repairestimate' and (attributename eq 're_papertype')")
  expect(result.draftApiCalled).toBe(false)
  expect(result.choices).toEqual({ re_papertype: [
    { value: 126110000, en: 'Non KONE Paper', fr: 'Papier non KONE' },
    { value: 126110001, en: 'Kone Paper' },
  ] })
})

test('Choice adapter falls back to Custom API read mode and validates its response', async ({ page }) => {
  await page.route('**/src/data/stringMapService.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export async function getStringMaps() { return { success: false, error: { message: 'stringmaps unavailable', status: 404 } }; }
    export async function getGlobalOptionSet() { return { success: false, error: { message: 'metadata unavailable', status: 403 } }; }`,
  }))
  await page.route('**/src/generated/services/Re_DraftEstimateService.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export class Re_DraftEstimateService {
      static async re_DraftEstimate(input) {
        window.__choiceRequest = JSON.parse(input);
        return window.__choiceResponse;
      }
    }`,
  }))
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { getDraftChoices } = await import('/src/data/draftChoiceRepository.ts')
    window.__choiceResponse = { success: true, data: { ResultJson: JSON.stringify({
      mode: 'choices', fields: [{ key: 're_papertype', options: [{ value: 727000042, en: 'Live paper', fr: 'Papier' }] }],
    }) } }
    const choices = await getDraftChoices(['re_papertype'])
    const errors = []
    for (const response of [
      { success: false, error: { message: 'Denied', status: 403 } },
      { success: true, data: {} },
      { success: true, data: { ResultJson: '{}' } },
    ]) {
      window.__choiceResponse = response
      try { await getDraftChoices(['re_papertype']) } catch (reason) { errors.push(reason.message) }
    }
    window.__choiceResponse = { success: true, data: { ResultJson: JSON.stringify({ mode: 'choices', fields: [] }) } }
    try { await getDraftChoices(['re_papertype']) } catch (reason) { errors.push(reason.message) }
    return { choices, request: window.__choiceRequest, errors }
  })
  expect(result.request).toEqual({ mode: 'choices' })
  expect(result.choices).toEqual({ re_papertype: [{ value: 727000042, en: 'Live paper', fr: 'Papier' }] })
  expect(result.errors).toEqual(Array(4).fill('Dataverse choices are temporarily unavailable.'))
})

test('Choice adapter uses global choice metadata when stringmaps are unavailable', async ({ page }) => {
  await page.route('**/src/data/stringMapService.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export async function getStringMaps() { return { success: false, error: { message: 'stringmaps unavailable', status: 404 } }; }
    export async function getGlobalOptionSet(name) {
      (window.__optionSets ??= []).push(name);
      return { success: true, data: { Options: [
        { Value: 126110000, Label: { LocalizedLabels: [{ Label: 'Non KONE Paper', LanguageCode: 1033 }, { Label: 'Papier non KONE', LanguageCode: 1036 }] } },
        { Value: 126110001, Label: { LocalizedLabels: [{ Label: 'Kone Paper', LanguageCode: 1033 }] } },
      ] } };
    }`,
  }))
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { getDraftChoices } = await import('/src/data/draftChoiceRepository.ts')
    return { choices: await getDraftChoices(['re_papertype']), names: window.__optionSets }
  })
  expect(result.names).toEqual(['re_papertype'])
  expect(result.choices).toEqual({ re_papertype: [
    { value: 126110000, en: 'Non KONE Paper', fr: 'Papier non KONE' },
    { value: 126110001, en: 'Kone Paper' },
  ] })
})

test('Review submission confirms, sends current edits and locks the submitted estimate', async ({ page }) => {
  await completeDraft(page)
  await page.locator('.form-footer > button').click()
  await page.locator('#request-re_billingplan').selectOption('126110000')
  await next(page)
  const submit = page.getByRole('button', { name: 'Submit estimate', exact: true })
  await expect(submit).toBeVisible()
  await page.locator('#request-re_notesforcttteam').fill('Current submission notes')
  page.once('dialog', (dialog) => dialog.dismiss())
  await submit.click()
  expect(await page.evaluate(() => window.__draftCalls?.length ?? 0)).toBe(0)
  page.once('dialog', (dialog) => dialog.accept())
  await submit.click()
  await expect(page.locator('.draft-saved')).toContainText('Estimate submitted')
  await expect(page.locator('.draft-save-action')).toBeDisabled()
  await expect(page.locator('.pricing-calculate-action')).toHaveCount(0)
  await expect(page.locator('#request-re_notesforcttteam')).toBeDisabled()
  const saved = await page.evaluate(() => window.__draftCalls.at(-1))
  expect(saved.mode).toBe('submit')
  expect(saved.fields).toContainEqual({ key: 're_notesforcttteam', value: 'Current submission notes' })
  await page.locator('.draft-secondary-actions button').nth(1).click()
  await expect(page.locator('.unsaved-badge')).toContainText('Submitted')
  await expect(page.locator('#request-re_notesforcttteam')).toBeDisabled()
})

test('submission failure preserves edits and permits correction without claiming success', async ({ page }) => {
  await completeDraft(page)
  await page.locator('.form-footer > button').click()
  await page.locator('#request-re_billingplan').selectOption('126110000')
  await next(page)
  await page.evaluate(() => { window.__draftFailure = 'RE-101|MARGIN_COMMENT_REQUIRED' })
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Submit estimate', exact: true }).click()
  await expect(page.locator('.draft-error')).toContainText('MARGIN_COMMENT_REQUIRED')
  await expect(page.locator('.draft-error')).toContainText('Add a margin justification')
  await expect(page.locator('.draft-error')).not.toContainText('Check that the Dataverse')
  await expect(page.locator('.draft-error')).toBeFocused()
  await expect(page.locator('.draft-saved')).toHaveCount(0)
  await expect(page.locator('#request-re_notesforcttteam')).toBeEditable()
  await expect(page.locator('.customer-summary')).toContainText('Draft customer')
})

test('selected Contact details are read-only and survive save and reopen', async ({ page }) => {
  await completeDraft(page, { width: 320, height: 700 })
  await expect(page.locator('#customer-name')).toHaveCount(0)
  await expect(page.locator('#building-name')).toHaveCount(0)
  await expect(page.locator('.customer-summary')).toContainText('Building 42')
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toBeVisible()
  await page.locator('.draft-toolbar .draft-secondary-actions button').nth(1).click()
  const customer = page.getByRole('group', { name: 'Customer details', exact: true })
  await expect(customer.locator('#customer-name')).toHaveValue('Draft customer')
  await expect(customer.locator('#customer-email')).toHaveValue('draft@example.invalid')
  await expect(customer.locator('#customer-name')).toHaveJSProperty('readOnly', true)
  await expect(customer.locator('#customer-email')).toHaveJSProperty('readOnly', true)
  await expect(page.locator('#opportunity-building')).toHaveCount(1)
  await expect(customer.locator('#customer-phone')).toHaveValue('1234567890')
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320)
  await page.locator('.draft-save-action').click()
  await expect.poll(() => page.evaluate(() => window.__draftCalls.at(-1).phone)).toBe('1234567890')
  await expect.poll(() => page.evaluate(() => window.__draftCalls.at(-1).contactId)).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
})

test('sidebar title stays visible across short-screen breakpoints after startup', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 640 })
  await mockData(page, 'en', 'light')
  await page.goto('/')
  await expect(page.locator('.market-control select')).toBeEnabled()
  await expect(page.locator('.dashboard-stat')).toHaveCount(4)
  for (const height of [641, 640, 639, 390]) {
    await page.setViewportSize({ width: 1024, height })
    await expect(page.locator('.brand-copy strong')).toHaveText('Repair Estimator')
    await expect(page.locator('.brand-copy small')).toHaveText('KTOC PSR')
    const fits = await page.locator('.brand-copy').evaluate((element) => {
      const title = element.getBoundingClientRect()
      const navigation = document.querySelector('.main-nav').getBoundingClientRect()
      return title.height > 0 && title.top >= 0 && title.bottom <= navigation.top
    })
    expect(fits).toBe(true)
    await checkLayout(page, { width: 1024, height }, `sidebar title at ${height}px height`)
  }
})

test('market switching restores English for CKE and MKO after CKQ', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await page.goto('/')
  const market = page.locator('.market-control select')
  for (const value of ['126110002', '126110001', '126110002', '126110000']) {
    await expect(market).toBeEnabled()
    await market.selectOption(value)
    await expect(page.locator('html')).toHaveAttribute('lang', value === '126110002' ? 'fr-CA' : 'en-US')
    await expect(market).toBeEnabled()
  }
})

test('optional stated rate validates across stages and pricing failure gives actionable guidance', async ({ page }) => {
  await completeDraft(page)
  for (let i = 0; i < 4; i++) await page.locator('.form-footer > button').click()
  const rate = page.locator('#request-re_statedlaborrate')
  await expect(rate).not.toHaveAttribute('required', '')
  await rate.fill('-4')
  await expect(rate).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Enter a valid hourly rate of zero or more, or leave this field blank.')).toBeVisible()
  await next(page)
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-error')).toContainText('Enter a valid hourly rate')
  expect(await page.evaluate(() => window.__draftCalls?.length ?? 0)).toBe(0)
  await expect(rate).toBeEditable()
  await rate.focus()
  await rate.press('ControlOrMeta+A')
  await rate.press('Backspace')
  await expect(rate).not.toHaveAttribute('aria-invalid')
  await page.evaluate(() => { window.__pricingState = 'unavailable' })
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toContainText('0000000042')
  await expect(page.locator('.draft-notice[role=alert]')).toContainText('If a stated labor billing rate is entered')
  expect(await page.evaluate(() => window.__draftCalls.length)).toBe(1)
})

for (const { language, theme } of modes) {
  test(`mixed CSTM, T&M and PSR custom lines save and reopen on mobile in ${language} ${theme}`, async ({ page }) => {
    await page.addInitScript(() => {
      window.__extraPackages = [
        { re_repairpackageid: 'custom', re_packagenumber: 'CSTM: 0', re_packagenameen: 'Custom', re_iscustompackage: true,
          re_mechanichours: 0, re_materialmisctaxcost: 0, re_effectivefrom: '2020-01-01' },
        { re_repairpackageid: 'tm', re_packagenumber: 'T&M: 001', re_packagenameen: 'Time & Material', re_istimematerial: true, re_effectivefrom: '2020-01-01' },
        { re_repairpackageid: 'psr2', re_packagenumber: 'P2', re_packagenameen: 'Repair 2', re_effectivefrom: '2020-01-01' },
        { re_repairpackageid: 'psr3', re_packagenumber: 'P3', re_packagenameen: 'Repair 3', re_effectivefrom: '2020-01-01' },
      ]
    })
    await completeDraft(page, { width: 320, height: 700 }, language, theme)
    for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
    for (const code of ['T&M: 001', 'P2', 'P3', 'CSTM: 0']) {
      await page.locator('#package-search').fill(code)
      await page.locator('#package-options button').first().click()
    }
    const custom = page.locator('.custom-cost-lines')
    await expect(custom).toBeVisible()
    await custom.getByRole('button', { name: language === 'fr' ? 'Ajouter main-d’œuvre' : 'Add labor', exact: true }).click()
    const labor = custom.locator('fieldset').first()
    await labor.locator('select').nth(0).selectOption('126110001')
    await labor.locator('select').nth(1).selectOption('126110001')
    await labor.locator('input').fill('3.25')
    await custom.getByRole('button', { name: language === 'fr' ? 'Ajouter un matériau' : 'Add material', exact: true }).click()
    const material = custom.locator('fieldset').nth(1)
    await material.getByRole('combobox', { name: language === 'fr' ? 'Type de pièce' : 'Part type', exact: true }).selectOption('non-kone')
    await material.getByRole('button', { name: language === 'fr' ? 'Utiliser la saisie manuelle sans catalogue' : 'Use manual entry without catalog', exact: true }).click()
    await material.locator('textarea').fill('Custom motor')
    await material.getByRole('textbox', { name: language === 'fr' ? 'Numéro de pièce' : 'Part number', exact: true }).fill('NONKONE-123')
    await material.getByRole('spinbutton', { name: language === 'fr' ? 'Quantité' : 'Quantity', exact: true }).fill('2')
    await material.getByRole('spinbutton', { name: language === 'fr' ? 'Coût unitaire' : 'Unit cost', exact: true }).fill('25.50')
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320)
    await checkLayout(page, { width: 320, height: 700 }, 'custom cost entry')
    await page.locator('.footer-actions .button').click()
    await expect(page.locator('#package-search')).toBeVisible()
    await next(page)
    await setCostRates(page)
    await next(page)
    await page.locator('#request-re_konesparessalespricevk13').fill('150')
    await next(page)
    await page.locator('.draft-save-action').click()
    await expect(page.locator('.draft-saved')).toContainText('0000000042')
    const saved = await page.evaluate(() => window.__draftCalls.at(-1))
    expect(saved.packages).toHaveLength(5)
    expect(saved.laborLines[0]).toMatchObject({ role: 126110001, time: 126110001, hours: 3.25 })
    expect(saved.materialLines[0]).toMatchObject({ description: 'Custom motor', vendor: '', part: 'NONKONE-123', quantity: 2, unitCost: 25.5 })
    await page.locator('.draft-toolbar .draft-secondary-actions button').nth(1).click()
    await next(page)
    await page.getByRole('button', { name: language === 'fr' ? 'Modifier les coûts CSTM' : 'Edit CSTM costs', exact: true }).click()
    await expect(page.locator('.custom-cost-lines fieldset').first().locator('input')).toHaveValue('3.25')
    await expect(page.locator('.custom-cost-lines fieldset').nth(1).locator('textarea')).toHaveValue('Custom motor')
    await page.locator('.draft-toolbar .draft-secondary-actions button').first().click()
    await expect(page.locator('#estimate-title')).toHaveValue('')
    await page.locator('#branch-select').fill('020')
    await page.locator('#branch-select').press('ArrowDown'); await page.locator('#branch-select').press('Enter')
    await page.locator('#equipment-type').selectOption('test-type')
    await page.locator('#opportunity-building').fill('New building')
    await page.locator('#estimate-title').fill('New equipment request')
    await selectCustomerMasters(page)
    await next(page)
    await expect(page.locator('.selected-card .equipment-card')).toHaveCount(0)
  })
}

test('large saved package selections are paged in the browser without losing records', async ({ page }) => {
  await completeDraft(page)
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toContainText('0000000042')
  await page.evaluate(() => {
    const template = window.__draftSaved.packages[0]
    window.__draftSaved.packages = Array.from({ length: 125 }, (_, i) => ({
      ...template, id: `p${i}`, number: `P${String(i + 1).padStart(3, '0')}`,
    }))
  })

  await page.locator('.draft-toolbar .draft-secondary-actions button').nth(1).click()
  await next(page)
  await expect(page.locator('.selected-card').last().locator('.equipment-card')).toHaveCount(20)
  await page.locator('.selected-card').last().getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.locator('.selected-card').last().locator('.equipment-card')).toHaveCount(20)
  await expect(page.locator('.selected-card').last().locator('.equipment-card').first()).toContainText('P021')
  await next(page)
  await expect(page.locator('.package-cost-summary .package-overview-card')).toHaveCount(20)
  await expect(page.locator('.package-combined-total dd')).toHaveText('49,843.75 USD')
  await page.locator('.draft-toolbar .primary').click()
  await expect(page.locator('.draft-saved')).toContainText('0000000042')
  expect(await page.evaluate(() => window.__draftCalls.at(-1).packages.length)).toBe(125)
})

test('custom line paging bounds rendered controls without dropping saved rows', async ({ page }) => {
  await completeDraft(page)
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toContainText('0000000042')
  await page.evaluate(() => {
    window.__draftSaved.packages[0].isCustom = true
    window.__draftSaved.laborLines = Array.from({ length: 11 }, (_, i) => ({
      id: `labor${i}`, role: 126110000, time: 126110000, hours: i + 1, rate: 200,
    }))
    window.__draftSaved.materialLines = Array.from({ length: 11 }, (_, i) => ({
      id: `material${i}`, description: `Part ${i + 1}`, vendor: '', part: `PART-${i + 1}`, quantity: 1, unitCost: 10,
    }))
  })
  await page.locator('.draft-toolbar .draft-secondary-actions button').nth(1).click()
  await next(page)
  await page.getByRole('button', { name: 'Edit CSTM costs', exact: true }).click()
  const custom = page.locator('.custom-cost-lines')
  await expect(custom.locator('fieldset')).toHaveCount(20)
  await custom.locator('.custom-line-actions').first().getByRole('button', { name: 'Next', exact: true }).click()
  await expect(custom.locator('fieldset')).toHaveCount(11)
  await expect(custom.locator('fieldset').first().locator('input')).toHaveValue('11')
  await page.locator('.draft-toolbar .primary').click()
  await expect(page.locator('.draft-saved')).toContainText('0000000042')
  expect(await page.evaluate(() => window.__draftCalls.at(-1).laborLines.length)).toBe(11)
  expect(await page.evaluate(() => window.__draftCalls.at(-1).materialLines.length)).toBe(11)
})

test('lazy estimator preserves unsaved draft inputs, selections and step across workspace navigation', async ({ page }) => {
  await completeDraft(page)
  await page.locator('.main-nav').getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Return to workspace', exact: true }).click()
  await expect(page.locator('.customer-summary')).toContainText('Draft customer')
  await expect(page.locator('[aria-current=step]')).toBeFocused()
  for (let index = 0; index < 4; index++) await page.locator('.form-footer > button').click()
  await expect(page.locator('#estimate-title')).toHaveValue('Motor repair draft')
  await expect(page.locator('#branch-select')).toHaveValue(/020/)
  for (let index = 0; index < 4; index++) await next(page)
  await expect(page.locator('.customer-summary')).toContainText('Draft customer')
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toContainText('0000000042')
  await expect(page.locator('.draft-toolbar button svg')).toHaveCount(3)
  const toolbarLayout = await page.locator('.draft-toolbar').evaluate((toolbar) => {
    const actions = toolbar.querySelector('.draft-secondary-actions').getBoundingClientRect()
    const save = toolbar.querySelector('.draft-save-action').getBoundingClientRect()
    return { actionsRight: actions.right, actionsBottom: actions.bottom, saveLeft: save.left,
      saveTop: save.top, saveWidth: save.width, actionsWidth: actions.width }
  })
  if (page.viewportSize().width <= 640) {
    expect(toolbarLayout.saveTop).toBeGreaterThanOrEqual(toolbarLayout.actionsBottom)
    expect(Math.abs(toolbarLayout.saveWidth - toolbarLayout.actionsWidth)).toBeLessThan(2)
  } else {
    expect(toolbarLayout.saveLeft).toBeGreaterThan(toolbarLayout.actionsRight)
  }
  const saved = await page.evaluate(() => window.__draftCalls.at(-1))
  expect(saved.title).toBe('Motor repair draft')
  expect(saved.equipment.map((item) => item.id)).toEqual(['test-equipment'])
  expect(saved.packages.map((item) => item.id)).toEqual(['test-package'])
  expect(saved.fields).toEqual(expect.arrayContaining([{ key: 're_sellprice', value: '1500' }]))
})

for (const width of [320, 1366]) {
  test(`market unlocks on dashboard and clears saved workspace when changed at ${width}px`, async ({ page }) => {
    await completeDraft(page, { width, height: 768 })
    await page.locator('.draft-save-action').click()
    await expect(page.locator('.draft-saved')).toBeVisible()
    const market = page.locator('.market-control select')
    await expect(market).toBeDisabled()
    await page.locator('.main-nav').getByRole('button', { name: 'Dashboard', exact: true }).click()
    await expect(market).toBeEnabled()
    await market.selectOption('126110001')
    await expect(page.locator('.operations-dashboard h1')).toContainText('CKE')
    await expect.poll(() => page.evaluate(() => window.__estimateQueries?.at(-1)?.market)).toBe(126110001)
    await page.locator('.main-nav .nav-item').nth(1).click()
    await expect(page.locator('#estimate-title')).toHaveValue('')
    await expect(page.locator('#customer-name')).toHaveValue('')
    await expect(page.locator('#opportunity-building')).toHaveValue('')
    await expect(page.locator('#branch-select')).toBeEnabled()
    await expect(market).toBeEnabled()
    expect(await page.evaluate(() => window.__draftCalls.length)).toBe(1)
  })
}

test('dashboard market change confirms unsaved edits and cancellation keeps the saved workspace intact', async ({ page }) => {
  await completeDraft(page)
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toBeVisible()
  await page.locator('#request-re_notesforcttteam').fill('Keep these local edits')
  await page.locator('.main-nav').getByRole('button', { name: 'Dashboard', exact: true }).click()
  const market = page.locator('.market-control select')
  page.once('dialog', (dialog) => dialog.dismiss())
  await market.selectOption('126110001')
  await expect(market).toHaveValue('126110000')
  await page.locator('.main-nav .nav-item').nth(1).click()
  await expect(page.locator('#request-re_notesforcttteam')).toHaveValue('Keep these local edits')
  expect(await page.evaluate(() => window.__draftCalls.length)).toBe(1)
  await page.locator('.main-nav').getByRole('button', { name: 'Dashboard', exact: true }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await market.selectOption('126110001')
  await expect(market).toHaveValue('126110001')
  await page.locator('.main-nav .nav-item').nth(1).click()
  await expect(page.locator('#estimate-title')).toHaveValue('')
  await expect(market).toBeEnabled()
})

for (const [width, language] of [[1366, 'en'], [320, 'fr']]) {
  test(`canceled new request preserves the workspace and sidebar resumes it at ${width}px ${language}`, async ({ page }) => {
    await completeDraft(page, { width, height: 900 }, language)
    const dialogs = []
    const dismiss = async dialog => { dialogs.push(dialog.message()); await dialog.dismiss() }
    page.on('dialog', dismiss)

    await page.locator('.draft-secondary-actions button').first().click()
    expect(dialogs).toHaveLength(1)
    await expect(page.locator('.customer-summary')).toContainText('Draft customer')
    await page.locator('.main-nav .nav-item').first().click()
    await expect(page.locator('.operations-dashboard')).toBeVisible()
    await page.locator('.operations-dashboard .page-heading .primary').click()
    expect(dialogs).toHaveLength(2)
    await expect(page.locator('.operations-dashboard')).toBeVisible()

    await page.locator('.main-nav .nav-item').nth(1).click()
    await expect(page.locator('.customer-summary')).toContainText('Draft customer')
    expect(dialogs).toHaveLength(2)
    await expect(page.locator('[aria-current="step"]')).toContainText('5')
    await expect(page.locator('.summary-card li').filter({ hasText: 'TEST123' })).toBeVisible()
    await expect(page.locator('.summary-card li').filter({ hasText: 'PKG001' })).toBeVisible()

    for (const index of [2, 3, 4, 6]) {
      await page.locator('.main-nav .nav-item').nth(index).click()
      await page.locator('.main-nav .nav-item').nth(1).click()
      await expect(page.locator('.customer-summary')).toContainText('Draft customer')
      await expect(page.locator('[aria-current="step"]')).toContainText('5')
    }
    expect(dialogs).toHaveLength(2)
    expect(await page.evaluate(() => window.__draftCalls ?? [])).toEqual([])
    page.off('dialog', dismiss)

    for (let i = 0; i < 4; i++) await page.locator('.form-footer > button').click()
    await expect(page.locator('#estimate-title')).toHaveValue('Motor repair draft')
    await expect(page.locator('#customer-name')).toHaveValue('Draft customer')
    page.once('dialog', dialog => dialog.accept())
    await page.locator('.draft-secondary-actions button').first().click()
    await expect(page.locator('#estimate-title')).toHaveValue('')
    await expect(page.locator('#customer-name')).toHaveValue('')
  })
}

test('canceling reload or open draft retains local edits and allows returning to the same request', async ({ page }) => {
  await completeDraft(page)
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toBeVisible()
  for (let i = 0; i < 4; i++) await page.locator('.form-footer > button').click()
  await page.locator('#estimate-title').fill('Keep my original local changes')
  const calls = await page.evaluate(() => window.__draftCalls.length)
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'Reload draft', exact: true }).click()
  await expect(page.locator('#estimate-title')).toHaveValue('Keep my original local changes')
  expect(await page.evaluate(() => window.__draftCalls.length)).toBe(calls)

  await page.locator('.main-nav .nav-item').nth(2).click()
  page.once('dialog', dialog => dialog.dismiss())
  await page.locator('.request-record').getByRole('button', { name: 'Open draft', exact: true }).click()
  expect(await page.evaluate(() => window.__draftCalls.length)).toBe(calls)
  await page.locator('.main-nav .nav-item').nth(1).click()
  await expect(page.locator('#estimate-title')).toHaveValue('Keep my original local changes')
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.unsaved-badge')).toContainText('Draft saved')
  expect(await page.evaluate(() => window.__draftSaved.title)).toBe('Keep my original local changes')
})

for (const viewport of [{ width: 320, height: 568 }, { width: 1366, height: 768 }]) {
  test(`draft save, update, new and reopen at ${viewport.width}px`, async ({ page }) => {
    await completeDraft(page, viewport)
    await expect(page.locator('.footer-actions .button')).toBeEnabled()
    await page.locator('.draft-save-action').click()
    await expect(page.locator('.draft-saved')).toContainText('0000000042')
    for (let i = 0; i < 4; i++) await page.locator('.form-footer > button').click()
    await expect(page.locator('#estimate-title')).toHaveValue('Motor repair draft')
    await expect(page.locator('#salesperson')).toHaveValue('Original Salesperson')
    await expect(page.locator('#branch-select')).toBeDisabled()
    await expect(page.locator('.market-control select')).toBeDisabled()
    await expect(page.locator('.unsaved-badge')).toContainText('Draft saved')
    const first = await page.evaluate(() => window.__draftCalls[0])
    expect(first.version).toBeNull()
    expect(first.id).toMatch(/^[a-f0-9-]{36}$/)
    expect(first.fields).toEqual(expect.arrayContaining([
      { key: 're_usetax', value: '5' }, { key: 're_freight', value: '14' },
      { key: 're_sellprice', value: '1500' },
    ]))
    expect(first.equipment).toHaveLength(1)
    expect(first.equipment[0].matched).toBe(true)
    expect(first.packages.map((p) => p.id)).toEqual(['test-package'])
    await page.locator('#estimate-title').fill('Updated draft')
    await page.locator('.draft-toolbar .primary').click()
    await expect(page.locator('.unsaved-badge')).toContainText('Draft saved')
    const update = await page.evaluate(() => window.__draftCalls[1])
    expect(update.id).toBe(first.id)
    expect(update.version).toBe('1')
    await page.locator('.draft-toolbar').getByRole('button', { name: 'New draft', exact: true }).click()
    await expect(page.locator('#estimate-title')).toHaveValue('')
    await page.locator('.main-nav .nav-item').nth(2).click()
    await page.locator('.request-record').getByRole('button', { name: 'Open draft' }).click()
    await expect(page.locator('#estimate-title')).toHaveValue('Updated draft')
    await expect(page.locator('#draft-province')).toHaveAttribute('data-state-id', 'test-state')
    await expect(page.locator('#draft-province')).toBeDisabled()
    await expect(page.locator('#draft-currency')).toHaveValue('USD')
    await expect(page.locator('.unsaved-badge')).toContainText('Draft saved')
    await checkLayout(page, viewport, 'reopened draft')
    await next(page)
    await expect(page.locator('.selected-card').first()).toContainText('Persisted equipment snapshot')
    await expect(page.locator('.selected-card').last()).toContainText('Persisted package snapshot')
    await next(page)
    await expect(page.locator('#request-re_usetax')).toHaveValue('5.00')
    await expect(page.locator('#request-re_freight')).toHaveValue('14.00')
    await expect(page.locator('#request-re_additionallaborhours')).toHaveValue('')
  })
}

for (const width of [320, 1366]) {
  test(`standard rates stay locked after saving and reloading at ${width}px`, async ({ page }) => {
    await completeDraft(page, { width, height: 900 })
    await page.locator('.draft-save-action').click()
    await expect(page.locator('.draft-saved')).toBeVisible()
    await page.evaluate(() => {
      for (const field of window.__draftSaved.fields) {
        if (field.key === 're_usetax') field.value = '5.0000000000'
        if (field.key === 're_freight') field.value = '14.0000000000'
      }
    })
    await page.locator('.draft-toolbar').getByRole('button', { name: 'Reload draft', exact: true }).click()
    await expect(page.locator('.unsaved-badge')).toContainText('Draft saved')
    await next(page)
    await next(page)
    await expect(page.locator('#request-re_usetax')).toHaveValue('5.00')
    await expect(page.locator('#request-re_freight')).toHaveValue('14.00')
    await expect(page.locator('#request-re_usetax')).not.toBeEditable()
    await expect(page.locator('#request-re_freight')).not.toBeEditable()
    await expect(page.locator('.unsaved-badge')).toContainText('Draft saved')
  })

  for (const entry of ['dashboard', 'workspace']) {
    test(`new request clears the previous saved draft via ${entry} at ${width}px`, async ({ page }) => {
      await completeDraft(page, { width, height: 900 })
      await page.locator('.draft-save-action').click()
      await expect(page.locator('.draft-saved')).toBeVisible()
      const previous = await page.evaluate(() => structuredClone(window.__draftSaved))
      await page.locator('.main-nav .nav-item').nth(0).click()
      if (entry === 'workspace') {
        await page.locator('.main-nav .nav-item').nth(1).click()
        await expect(page.locator('.customer-summary')).toContainText('Draft customer')
        for (let i = 0; i < 4; i++) await page.locator('.form-footer > button').click()
        await expect(page.locator('#estimate-title')).toHaveValue(previous.title)
      }
      const start = entry === 'dashboard'
        ? page.locator('.operations-dashboard .page-heading .primary')
        : page.locator('.draft-secondary-actions button').first()
      await start.click()
      await expect(page.locator('#estimate-title')).toHaveValue('')
      await expect(page.locator('#opportunity-building')).toHaveValue('')
      await expect(page.locator('#branch-select')).toBeEnabled()
      await expect(page.locator('.market-control select')).toBeEnabled()
      await expect(page.locator('.draft-saved')).toHaveCount(0)
      await expect(page.locator('.draft-toolbar').getByRole('button', { name: 'Reload draft' })).toHaveCount(0)
      await expect(page.locator('.draft-toolbar .primary')).toBeEnabled()
      await page.locator('#estimate-title').fill('Fresh request')
      page.once('dialog', (dialog) => dialog.dismiss())
      await page.locator('.draft-secondary-actions button').first().click()
      await expect(page.locator('#estimate-title')).toHaveValue('Fresh request')
      page.once('dialog', (dialog) => dialog.accept())
      await page.locator('.draft-secondary-actions button').first().click()
      await expect(page.locator('#estimate-title')).toHaveValue('')
      await page.locator('#estimate-title').fill('Separate estimate')
      await page.locator('#branch-select').fill('020')
      await page.locator('#branch-select').press('ArrowDown')
      await page.locator('#branch-select').press('Enter')
      await page.locator('#equipment-type').selectOption('test-type')
      await page.locator('#opportunity-building').fill('New building')
      await expect(page.locator('#customer-name')).toHaveValue('')
      await expect(page.locator('#customer-email')).toHaveValue('')
      await selectCustomerMasters(page)
      await next(page)
      await expect(page.locator('.selected-card')).toHaveCount(0)
      await pickEquipmentAndPackage(page)
      await next(page)
      await expect(page.locator('#request-re_usetax')).toHaveValue('5.00')
      await expect(page.locator('#request-re_additionallaborhours')).toHaveValue('')
      await expect(page.locator('#request-re_freight')).toHaveValue('14.00')
      await next(page)
      await expect(page.locator('#request-re_sellprice')).toHaveValue('')
      await page.locator('#request-re_sellprice').fill('2000')
      await next(page)
      await expect(page.locator('.customer-summary')).toContainText('New customer')
      await page.locator('.draft-save-action').click()
      await expect(page.locator('.draft-saved')).toBeVisible()
      const calls = await page.evaluate(() => window.__draftCalls)
      expect(calls).toHaveLength(2)
      expect(calls[1].id).not.toBe(previous.id)
      expect(calls[1].version).toBeNull()
      expect(calls[1].title).toBe('Separate estimate')
    })
  }
}

test('decimal inputs display two places while preserving saved precision and editable blanks', async ({ page }) => {
  await completeDraft(page)
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toBeVisible()
  await page.evaluate(() => {
    window.__draftSaved.packages[0].isCustom = true
    window.__draftSaved.laborLines = [{ id: 'labor', packageId: 'test-package', role: 126110000, time: 126110000, hours: 1, rate: 100 }]
    window.__draftSaved.materialLines = [{ id: 'material', packageId: 'test-package', description: 'Part', vendor: '', part: 'PART-1', quantity: 1, unitCost: 10 }]
    window.__draftSaved.fields.push({ key: 're_additionallaborhours', value: '30.0000000000' })
    window.__draftSaved.fields.push({ key: 're_additionalmaterial', value: '25.1234567890' })
  })
  await page.locator('.draft-toolbar').getByRole('button', { name: 'Reload draft', exact: true }).click()
  await expect(page.locator('.unsaved-badge')).toContainText('Draft saved')
  await next(page)
  await next(page)
  const hours = page.locator('#request-re_additionallaborhours')
  const material = page.locator('#request-re_additionalmaterial')
  await expect(hours).toHaveValue('30.00')
  await expect(material).toHaveValue('25.12')
  await material.focus()
  await expect(material).toHaveValue('25.1234567890')
  await material.blur()
  await expect(material).toHaveValue('25.12')
  await expect(page.locator('.unsaved-badge')).toContainText('Draft saved')
  await hours.focus()
  await expect(hours).toHaveValue('30.0000000000')
  await hours.fill('')
  await hours.blur()
  await expect(hours).toHaveValue('')
  await hours.fill('1.2367')
  await hours.blur()
  await expect(hours).toHaveValue('1.24')
  await page.locator('.draft-toolbar .primary').click()
  await expect(page.locator('.draft-saved')).toBeVisible()
  const fields = await page.evaluate(() => window.__draftCalls.at(-1).fields)
  expect(fields).toContainEqual({ key: 're_additionallaborhours', value: '1.2367' })
  expect(fields).toContainEqual({ key: 're_additionalmaterial', value: '25.1234567890' })
})

for (const width of [320, 768, 1366, 1920]) {
  for (const language of ['en', 'fr']) {
    test(`dashboard percentage stays together with two decimals at ${width}px ${language}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await mockData(page, language, 'light')
      await page.addInitScript(() => { window.__dashboardAverage = -650.2816 })
      await page.goto('/')
      const value = page.locator('.metric-tone-3 strong')
      await expect(value).toHaveText(new Intl.NumberFormat(language === 'fr' ? 'fr-CA' : 'en-US', {
        style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
      }).format(-650.2816))
      const geometry = await value.evaluate((element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        const card = element.closest('article').getBoundingClientRect()
        return { lines: range.getClientRects().length, right: element.getBoundingClientRect().right, cardRight: card.right }
      })
      expect(geometry.lines).toBe(1)
      expect(geometry.right).toBeLessThanOrEqual(geometry.cardRight)
      await checkLayout(page, { width, height: 900 }, 'two-decimal dashboard')
    })
  }
}

test('draft save serializes clicks, blocks editing while saving and preserves input after permission errors', async ({ page }) => {
  await completeDraft(page)
  await page.evaluate(() => { window.__draftDelay = 500; window.__draftFailure = '403: Write permission denied' })
  await page.locator('.draft-save-action').click()
  await expect(page.locator('#request-re_notesforcttteam')).toBeDisabled()
  await expect(page.locator('.draft-toolbar .primary')).toBeDisabled()
  await expect(page.locator('.draft-error')).toContainText('403')
  await expect(page.locator('.customer-summary')).toContainText('Draft customer')
  expect(await page.evaluate(() => window.__draftCalls.length)).toBe(1)
  await page.evaluate(() => { window.__draftDelay = 0; window.__draftFailure = '' })
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toBeVisible()
  const calls = await page.evaluate(() => window.__draftCalls)
  expect(calls[0].id).toBe(calls[1].id)
})

test('uncertain create response recovers the same draft without duplicate creation', async ({ page }) => {
  await completeDraft(page)
  await page.evaluate(() => { window.__draftFailure = 'timeout-after-commit' })
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-error')).toContainText('outcome unknown')
  await expect(page.locator('.customer-summary')).toContainText('Draft customer')
  await page.evaluate(() => { window.__draftFailure = '' })
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('.draft-error').getByRole('button', { name: 'Reload draft' }).click()
  await expect(page.locator('.unsaved-badge')).toContainText('Draft saved')
  const calls = await page.evaluate(() => window.__draftCalls)
  expect(calls.map((c) => c.mode)).toEqual(['save', 'load'])
  expect(calls[0].id).toBe(calls[1].id)
  await expect(page.locator('#estimate-title')).toHaveValue('Motor repair draft')
})

test('stale update errors retain local edits until explicit reload', async ({ page }) => {
  await completeDraft(page)
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toBeVisible()
  for (let i = 0; i < 4; i++) await page.locator('.form-footer > button').click()
  await page.locator('#estimate-title').fill('My unsaved revision')
  await page.evaluate(() => { window.__draftFailure = '412: Row version conflict' })
  await page.locator('.draft-toolbar .primary').click()
  await expect(page.locator('.draft-error')).toContainText('Row version conflict')
  await expect(page.locator('#estimate-title')).toHaveValue('My unsaved revision')
  await page.evaluate(() => { window.__draftFailure = '' })
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('.draft-error').getByRole('button', { name: 'Reload draft' }).click()
  await expect(page.locator('#estimate-title')).toHaveValue('Motor repair draft')
})

test('draft adapter uses generated action service and validates its response', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await page.unroute('**/src/data/draftRepository.ts*')
  await page.route('**/src/generated/services/Re_DraftEstimateService.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export class Re_DraftEstimateService {
      static async re_DraftEstimate(input) {
        window.__actionInput = JSON.parse(input);
        return window.__actionResponse;
      }
    }`,
  }))
  await page.goto('/')
  const record = {
    mode: 'save', id: 'test-estimate', version: '42', title: 'Saved draft',
    branchId: 'test-branch', stateId: 'test-state', equipmentTypeId: 'test-type',
    building: 'Building', customer: 'Customer', market: 126110000,
    fields: [], equipment: [{ id: '', number: 'E1', matched: false }],
    packages: [{ id: 'P1', number: 'P1', nameEn: 'Package', scopeEn: 'Scope', hours: 2, material: 100 }],
  }
  const result = await page.evaluate(async (saved) => {
    const { draftOperation } = await import('/src/data/draftRepository.ts')
    window.__actionResponse = { success: true, data: { ResultJson: JSON.stringify(saved) } }
    const loaded = await draftOperation({ mode: 'load', id: saved.id })
    return { loaded, input: window.__actionInput }
  }, record)
  expect(result.input).toEqual({ mode: 'load', id: record.id })
  expect(result.loaded).toEqual(record)
  for (const mode of ['save', 'submit']) {
    await page.evaluate(async (input) => {
      const { draftOperation } = await import('/src/data/draftRepository.ts')
      await draftOperation(input)
    }, { ...record, mode })
    const timing = await page.evaluate(operation =>
      performance.getEntriesByName(`repair-estimator:draft-${operation}`, 'measure')
        .map(entry => ({ duration: entry.duration, detail: entry.detail })), mode)
    expect(timing).toHaveLength(1)
    expect(timing[0].duration).toBeGreaterThanOrEqual(0)
    expect(timing[0].detail).toEqual({ outcome: 'completed' })
  }
  for (const response of [
    { success: true, data: {} },
    { success: true, data: { ResultJson: '{}' } },
    { success: false, error: { message: 'Permission denied', status: 403 } },
  ]) {
    const error = await page.evaluate(async (value) => {
      const { draftOperation } = await import('/src/data/draftRepository.ts')
      window.__actionResponse = value
      try { await draftOperation({ mode: 'load', id: 'test-estimate' }); return '' }
      catch (reason) { return reason.message }
    }, response)
    expect(error).toMatch(/invalid response|incomplete data|Permission denied/)
  }
  expect(await page.evaluate(() =>
    performance.getEntriesByName('repair-estimator:draft-load', 'measure')
      .map(entry => entry.detail.outcome))).toEqual(['completed', 'failed', 'failed', 'failed'])
})

test('saved draft explicitly reports unavailable pricing without claiming a failed save', async ({ page }) => {
  await completeDraft(page)
  await page.evaluate(() => { window.__pricingState = 'unavailable' })
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toContainText('0000000042')
  await expect(page.locator('.draft-notice[role=alert]')).toContainText('The draft is saved, but pricing and CMII are unavailable.')
  await expect(page.locator('.draft-error')).toHaveCount(0)
  await expect(page.locator('.pricing-summary')).toContainText('pricing and CMII are unavailable.')
  await expect(page.locator('.pricing-summary')).not.toContainText('$31,807.21')
})

for (const language of ['en', 'fr']) {
  for (const width of [320, 1366]) {
    test(`pricing dashboard reference preserves real outputs at ${width}px in ${language}`, async ({ page }, testInfo) => {
      await completeDraft(page, { width, height: 900 }, language, language === 'fr' ? 'dark' : 'light')
      await page.evaluate(() => { window.__pricingOverrides = {
        re_totaltruecost: 49677.97, re_sellprice: 60000, re_suggestedprice: 248389.85,
        re_suggestedpricewithkonematerial: 310889.85, re_packageestimatedcost: 30164.12,
        re_customlaborcost: 750.6, re_custommaterialcost: 10000, re_totaladditionalcost: 19513.85,
        re_usetaxamount: 664.46, re_freightamount: 2657.86, re_basetargetcmii: 0.65,
        re_recommendedcmii: 0.8, re_actualcmii: 0.172, re_cmiivariance: -0.628,
      } })
      const summary = page.locator('.pricing-summary')
      await summary.getByRole('button', { name: language === 'fr' ? 'Calculer' : 'Calculate', exact: true }).click()
      await expect(summary.locator('.pricing-kpi')).toHaveCount(4)
      const formatter = new Intl.NumberFormat(language === 'fr' ? 'fr-CA' : 'en-US', { style: 'currency', currency: 'USD' })
      await expect(summary.locator('.pricing-kpi-suggested dd')).toHaveText(formatter.format(248389.85))
      await expect(summary.locator('.pricing-kpi-kone dd')).toHaveText(formatter.format(310889.85))
      await expect(summary.locator('.pricing-breakdown > div')).toHaveCount(6)
      await expect(summary.locator('.pricing-composition-legend > div').last()).toContainText(formatter.format(8763.25))
      await expect(summary.locator('.pricing-gauge strong')).toHaveText(language === 'fr' ? /17,2\s*%/ : '17.2%')
      await expect(summary.locator('.pricing-gauge-fill')).toHaveAttribute('stroke-dasharray', /^17\.2/)
      await expect(summary.locator('.pricing-margin-2')).toHaveClass(/is-negative/)
      await expect(summary.locator('.pricing-incentives dd')).toHaveCount(2)
      await expect(summary.getByRole('button', { name: language === 'fr' ? 'Recalculer' : 'Recalculate', exact: true })).toBeEnabled()
      await checkLayout(page, { width, height: 900 }, 'pricing dashboard reference')
      const internalOverflow = await summary.evaluate((el) => [...el.querySelectorAll('dl, figure, section, .pricing-kpi')].filter(
        (node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.className))
      expect(internalOverflow).toEqual([])
      if (width === 1366) {
        const layout = await summary.evaluate((el) => ({
          priceColumns: getComputedStyle(el.querySelector('.pricing-totals')).gridTemplateColumns.split(' ').length,
          panelColumns: getComputedStyle(el.querySelector('.pricing-dashboard')).gridTemplateColumns.split(' ').length,
        }))
        expect(layout).toEqual({ priceColumns: 4, panelColumns: 2 })
      }
      await summary.screenshot({ path: testInfo.outputPath(`pricing-dashboard-${language}-${width}.png`),
        style: '.topbar { visibility: hidden; }' })
    })
  }
}

test('pricing dashboard missing and out-of-range values are not fabricated or hidden', async ({ page }) => {
  await completeDraft(page, { width: 320, height: 900 })
  await page.evaluate(() => { window.__pricingOverrides = {
    re_actualcmii: null, re_cmiivariance: null, re_suggestedpricewithkonematerial: null,
  } })
  const summary = page.locator('.pricing-summary')
  await summary.getByRole('button', { name: 'Calculate', exact: true }).click()
  await expect(summary.locator('.pricing-gauge strong')).toHaveText('—')
  await expect(summary.locator('.pricing-kpi-kone dd')).toHaveText('—')
  await expect(summary.locator('.pricing-gauge-fill')).toHaveCount(0)
  await expect(summary.locator('.pricing-chart-unavailable')).toBeVisible()
  await expect(summary).toContainText('Enter a selling price and recalculate')
  await page.evaluate(() => { window.__pricingOverrides = { re_actualcmii: 1.5 } })
  await summary.getByRole('button', { name: 'Recalculate', exact: true }).click()
  await expect(summary.locator('.pricing-gauge strong')).toHaveText('150%')
  await expect(summary.locator('.pricing-gauge-fill')).toHaveAttribute('stroke-dasharray', '100 100')
  await expect(summary).toContainText('The actual saved value is displayed without a limit.')
  await page.evaluate(() => { window.__pricingOverrides = {} })
  await summary.getByRole('button', { name: 'Recalculate', exact: true }).click()
  await expect(summary.locator('.pricing-gauge strong')).toHaveText('-65,028.16%')
  await expect(summary.locator('.pricing-gauge-fill')).toHaveCount(0)
  await checkLayout(page, { width: 320, height: 900 }, 'out-of-range CMII')
})

for (const width of [320, 1366]) {
  test(`saved pricing summary shows server values, localization and stale state at ${width}px`, async ({ page }) => {
    await completeDraft(page, { width, height: 768 })
    const summary = page.locator('.pricing-summary')
    await expect(summary).toContainText('Select Calculate to get pricing and CMII.')
    await expect(summary).toContainText('Calculating saves your draft')
    await summary.getByRole('button', { name: 'Calculate', exact: true }).click()
    await expect(summary).toContainText('$31,807.21')
    await expect(summary).toContainText('48.81%')
    await expect(summary).toContainText('-65,028.16%')
    await expect(summary).toContainText('-65,076.97 percentage points')
    await expect(summary).toContainText('Selling price is below cost.')
    await expect(page.locator('.draft-error')).toHaveCount(0)
    const reads = await page.evaluate(() => window.__pricingReads)
    expect(reads[0].options.select).toContain('re_actualcmii')
    expect(reads[0].options.select).not.toContain('re_customername')
    await page.locator('#request-re_notesforcttteam').fill('Unsaved notes edit')
    await expect(summary).toContainText('Unsaved changes:')
    await expect(summary.getByRole('button', { name: 'Recalculate', exact: true })).toBeEnabled()
    await expect(summary).toContainText('$31,807.21')
    await changeLanguageInSettings(page, 'fr')
    await expect(summary).toContainText('Résumé des prix et du CMII')
    await expect(summary).toContainText('Modifications non enregistrées')
    await expect(summary.getByRole('button', { name: 'Recalculer', exact: true })).toBeEnabled()
    await expect(summary).toContainText(/48,81\s*%/)
    await checkLayout(page, { width, height: 768 }, 'saved French pricing summary')
    await page.locator('.form-footer > button').click()
    await expect(summary).toBeVisible()
    await expect(summary).toContainText('Résumé des prix et du CMII')
  })
}

for (const language of ['en', 'fr']) {
  test(`calculate saves current pricing inputs and recalculates after changes in ${language}`, async ({ page }) => {
    await completeDraft(page, { width: 320, height: 768 }, language)
    await page.locator('.form-footer > button').click()
    const summary = page.locator('.pricing-summary')
    const calculate = summary.getByRole('button', { name: language === 'fr' ? 'Calculer' : 'Calculate', exact: true })
    await page.evaluate(() => { window.__draftDelay = 800 })
    await calculate.click()
    await expect(summary.getByRole('button', { name: language === 'fr' ? 'Calcul en cours…' : 'Calculating…' })).toBeDisabled()
    await expect(page.locator('#request-re_sellprice')).toBeDisabled()
    await expect(page.locator('.draft-save-action')).toBeDisabled()
    const recalculate = summary.getByRole('button', { name: language === 'fr' ? 'Recalculer' : 'Recalculate', exact: true })
    await expect(recalculate).toBeEnabled()
    expect(await page.evaluate(() => window.__draftCalls.length)).toBe(1)
    await page.locator('#request-re_sellprice').focus()
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('2400')
    await expect(page.locator('#request-re_sellprice')).toHaveValue('2400')
    await expect(summary).toContainText(language === 'fr' ? 'résultats obsolètes' : 'results are out of date')
    await recalculate.click()
    await expect(recalculate).toBeEnabled()
    const calls = await page.evaluate(() => window.__draftCalls)
    expect(calls.map((call) => call.mode)).toEqual(['save', 'save'])
    expect(calls[1].id).toBe(calls[0].id)
    expect(calls[1].version).toBe('1')
    expect(calls[1].fields).toContainEqual({ key: 're_sellprice', value: '2400' })
    await expect(summary).not.toContainText(language === 'fr' ? 'résultats obsolètes' : 'results are out of date')
    await checkLayout(page, { width: 320, height: 768 }, 'calculate and recalculate')
  })
}

test('calculate preserves edits on save failure and requires mandatory inputs', async ({ page }) => {
  await completeDraft(page)
  await page.locator('.form-footer > button').click()
  const calculate = page.locator('.pricing-summary').getByRole('button', { name: 'Calculate', exact: true })
  await page.locator('.form-footer > button').click()
  await page.locator('#request-re_timecategory').selectOption('')
  await expect(page.locator('#request-re_timecategory')).toHaveValue('')
  await next(page)
  await expect(calculate).toBeDisabled()
  await expect(page.locator('.pricing-summary')).toContainText('Complete the required fields before calculating.')
  await page.locator('.form-footer > button').click()
  await page.locator('#request-re_timecategory').selectOption('126110000')
  await next(page)
  await page.evaluate(() => { window.__draftFailure = '403: Write permission denied' })
  await calculate.click()
  await expect(page.locator('.draft-error')).toContainText('403')
  await expect(page.locator('.pricing-summary').getByRole('alert')).toContainText('403: Write permission denied')
  await expect(page.locator('.pricing-summary')).not.toContainText('Select Calculate to get pricing and CMII.')
  await expect(page.locator('#request-re_sellprice')).toHaveValue(/^1500(?:\.00)?$/)
  await expect(calculate).toBeEnabled()
  await expect(page.locator('.draft-saved')).toHaveCount(0)
  await page.evaluate(() => { window.__draftFailure = '' })
  await calculate.click()
  await expect(page.locator('.pricing-summary')).toContainText('$31,807.21')
  await expect(page.locator('.pricing-summary').getByRole('alert')).toHaveCount(0)
})

for (const language of ['en', 'fr']) {
  test(`selected Account references persist through draft save and reload in ${language}`, async ({ page }) => {
    await completeDraft(page, { width: 320, height: 900 }, language)
    for (let i = 0; i < 4; i++) await page.locator('.form-footer > button').click()
    await expect(page.locator('.customer-master-select')).toContainText('00042 — Acme Corporation')
    await page.locator('.draft-save-action').click()
    await expect(page.locator('.draft-saved')).toBeVisible()
    const saved = await page.evaluate(() => window.__draftSaved)
    expect(saved).toMatchObject({
      accountId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', accountNumber:'00042',
      accountName:'Acme Corporation', contactId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    })
    await page.locator('.main-nav .nav-item').first().click()
    await page.locator('.main-nav .nav-item').nth(1).click()
    await expect(page.locator('.customer-master-select')).toContainText('00042 — Acme Corporation')
    await expect(page.locator('#customer-name')).toHaveValue('Draft customer')
    await page.locator('.draft-secondary-actions button').nth(1).click()
    await expect(page.locator('.customer-master-select')).toContainText('00042 — Acme Corporation')
    await page.locator('.draft-secondary-actions button').first().click()
    await expect(page.locator('#customer-name')).toHaveValue('')
    await expect(page.locator('.customer-master-select')).not.toContainText('00042 — Acme Corporation')
  })
}

test('calculate reports invalid pricing input in the summary instead of silently returning', async ({ page }) => {
  await completeDraft(page)
  await page.locator('.form-footer > button').click()
  await page.locator('#request-re_sellprice').fill('-1')
  const summary = page.locator('.pricing-summary')
  await summary.getByRole('button', { name: 'Calculate', exact: true }).click()
  await expect(summary.getByRole('alert')).toContainText('Sell price')
  await expect(summary).not.toContainText('Select Calculate to get pricing and CMII.')
  expect(await page.evaluate(() => window.__draftCalls ?? [])).toEqual([])
  await page.locator('#request-re_sellprice').fill('2400')
  await summary.getByRole('button', { name: 'Calculate', exact: true }).click()
  await expect(summary).toContainText('$31,807.21')
  await expect(summary.getByRole('alert')).toHaveCount(0)
})

test('pricing read failure does not claim save failure and can be retried', async ({ page }) => {
  await completeDraft(page)
  await page.evaluate(() => { window.__pricingError = 'Permission denied' })
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toBeVisible()
  await expect(page.locator('.pricing-summary')).toContainText('Your saved draft is unchanged.')
  await expect(page.locator('.pricing-summary')).toContainText('Permission denied')
  await expect(page.locator('.draft-error')).toHaveCount(0)
  await page.evaluate(() => { window.__pricingError = '' })
  await page.locator('.pricing-summary').getByRole('button', { name: 'Retry' }).click()
  await expect(page.locator('.pricing-summary')).toContainText('$31,807.21')
})

test('pricing uses saved CAD currency and never shows a different row version as current', async ({ page }) => {
  await page.addInitScript(() => { window.__currencyCode = 'CAD' })
  await completeDraft(page)
  await page.evaluate(() => { window.__pricingDelay = 800 })
  await page.locator('.draft-save-action').click()
  const summary = page.locator('.pricing-summary')
  await expect(summary).toContainText('Loading saved pricing')
  await expect(summary).toContainText('CA$31,807.21')
  await page.evaluate(() => { window.__pricingOverrides = { versionnumber: 99 } })
  await page.locator('.form-footer > button').click()
  await expect(summary).toContainText('CA$31,807.21')
  expect(await page.evaluate(() => window.__pricingReads.length)).toBe(1)
  await page.locator('.draft-secondary-actions button').nth(1).click()
  for (let step = 0; step < 3; step++) await next(page)
  await expect(summary).toContainText('different saved version')
  await expect(summary).not.toContainText('CA$31,807.21')
  expect(await page.evaluate(() => window.__pricingReads.length)).toBe(2)
  await page.evaluate(() => { window.__pricingOverrides = {} })
  await summary.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(summary).toContainText('CA$31,807.21')
  expect(await page.evaluate(() => window.__pricingReads.length)).toBe(3)
})

test('dashboard aggregates are independent of list paging and refresh safely across markets', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 768 })
  await mockData(page, 'en', 'light')
  await page.goto('/')
  const metrics = page.locator('.dashboard-metrics')
  await expect(metrics).toContainText('125 estimates')
  await expect(page.locator('.dashboard-stats strong')).toHaveText(['125', '100', '5', '-25.00%'])
  await expect(page.locator('.request-record')).toHaveCount(1)
  await expect(metrics.getByRole('meter')).toHaveCount(4)
  await page.evaluate(() => { window.__dashboardError = 'Permission denied' })
  await metrics.getByRole('button', { name: 'Refresh' }).click()
  await expect(metrics.getByRole('alert')).toContainText('Permission denied')
  await expect(metrics.locator('.dashboard-stats')).toHaveCount(0)
  await page.evaluate(() => { window.__dashboardError = ''; window.__dashboardDelay = 500 })
  await metrics.getByRole('button', { name: 'Refresh' }).click()
  await expect(metrics.getByRole('status')).toContainText('Loading')
  await expect(metrics).toContainText('125 estimates')
  await page.locator('.market-control select').selectOption('126110001')
  await expect(metrics.locator('.dashboard-stats')).toHaveCount(0)
  await expect(metrics).toContainText('No estimates for this market.')
  await expect(metrics.locator('.dashboard-stats strong')).toHaveText(['0', '0', '0', '—'])
  await page.locator('.market-control select').selectOption('126110000')
  await expect(metrics).toContainText('125 estimates')
  await changeLanguageInSettings(page, 'fr')
  await expect(metrics).toContainText('CMII réel moyen')
  await expect(metrics).toContainText('Equipment repair')
  await checkLayout(page, { width: 320, height: 768 }, 'French live dashboard')
  const calls = await page.evaluate(() => window.__dashboardCalls)
  expect(calls.every((c) => c.owner === null)).toBe(true)
})

for (const theme of ['light', 'dark']) {
  test(`compact recent requests cap at five without changing full request controls: ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: theme === 'dark' ? 320 : 1440, height: 900 })
    await mockData(page, 'en', theme)
    await page.addInitScript(() => { window.__estimateRecordCount = 6 })
    await page.goto('/')
    await expect(page.locator('.recent-card .request-record')).toHaveCount(5)
    expect(await page.evaluate(() => window.__estimateQueries.at(-1).recent)).toBe(true)
    await expect(page.locator('.recent-card .request-filters')).toHaveCount(0)
    await expect(page.locator('.recent-card .request-pagination')).toHaveCount(0)
    await expect(page.locator('.user-avatar')).toHaveCSS('background-color', 'rgb(20, 80, 245)')
    const refresh = await page.getByRole('button', { name: 'Refresh', exact: true }).boundingBox()
    expect(refresh.height).toBeGreaterThanOrEqual(44)
    await checkLayout(page, page.viewportSize(), 'compact recent requests')
    await page.getByRole('button', { name: /View requests/ }).click()
    await expect(page.locator('.request-record')).toHaveCount(6)
    expect(await page.evaluate(() => window.__estimateQueries.at(-1).recent)).toBe(false)
    await expect(page.locator('.request-filters select')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled()
  })
}

for (const width of [1440, 1920]) {
  test(`header search fills available desktop space at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await mockData(page, 'en', 'light')
    await page.goto('/')
    await expect(page.locator('.market-control select')).toBeEnabled()
    const geometry = await page.locator('.topbar').evaluate((header) => {
      const search = header.querySelector('.header-request-search').getBoundingClientRect()
      const actions = header.querySelector('.topbar-actions').getBoundingClientRect()
      return { gap: actions.left - search.right, expectedGap: parseFloat(getComputedStyle(header).columnGap),
        sameRow: Math.abs(search.top - actions.top) < 2 }
    })
    expect(geometry.sameRow).toBe(true)
    expect(Math.abs(geometry.gap - geometry.expectedGap)).toBeLessThan(2)
    await checkLayout(page, { width, height: 900 }, 'expanded header search')
  })
}

test('mockup dashboard charts retain exact totals and accessible legends', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await mockData(page, 'en', 'light')
  await page.goto('/')
  await expect(page.locator('.donut-total strong')).toHaveText('105')
  await expect(page.locator('.status-legend strong')).toHaveText(['100', '5'])
  await expect(page.locator('.status-legend')).not.toContainText('Pending')
  await expect(page.locator('.dashboard-stats strong')).toHaveText(['125', '100', '5', '-25.00%'])
  await expect(page.locator('.dashboard-stat-copy > span')).toHaveText(['Total estimates', 'Draft', 'Submitted', 'Average actual CMII'])
  await expect(page.locator('.dashboard-stat').first()).toContainText('All statuses')
  await expect(page.locator('.dashboard-stats')).not.toContainText('Pending')
  await expect(page.locator('.job-chart-card .metric-bars strong')).toHaveText(['96% (120)', '4% (5)'])
  await expect(page.locator('.dashboard-stat-icon svg')).toHaveCount(4)
  await expect(page.locator('.recent-card .request-record')).toHaveCount(1)
  await expect(page.locator('.recent-card .request-filters')).toHaveCount(0)
  await expect(page.locator('.recent-card .request-pagination')).toHaveCount(0)
  await expect(page.locator('.recent-column-headings')).toBeVisible()
  await expect(page.locator('.metric-refresh svg')).toBeVisible()
  await expect(page.locator('.user-avatar')).toHaveCSS('background-color', 'rgb(20, 80, 245)')
  const arcs = await page.locator('.donut-segment').evaluateAll((segments) =>
    segments.map((segment) => Number(segment.getAttribute('stroke-dasharray').split(' ')[0])))
  expect(arcs).toHaveLength(2)
  expect(arcs[0]).toBeCloseTo(100 / 105 * 100)
  expect(arcs[1]).toBeCloseTo(5 / 105 * 100)
  expect(arcs[0] + arcs[1]).toBeCloseTo(100)
  await page.screenshot({ path: testInfo.outputPath('dashboard-desktop.png'), fullPage: true })
  await page.locator('.recent-card').getByRole('button', { name: 'View requests' }).click()
  await expect(page.locator('.operations-dashboard')).toHaveCount(0)
  await expect(page.locator('.request-record')).toHaveCount(1)
})

for (const width of [320, 1366]) {
  test(`header request search navigates, preserves filters and resets paging at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 768 })
    await mockData(page, 'en', 'light')
    await page.goto('/')
    const search = page.locator('#header-request-search')
    await expect(search).toBeEnabled()
    await expect(page.locator('input[type=search]')).toHaveCount(1)
    await search.fill("O'Brien")
    await search.press('Enter')
    await expect(page.locator('.operations-dashboard')).toHaveCount(0)
    await expect(page.locator('.request-record')).toHaveCount(1)
    await expect(page.locator('.request-filters')).toContainText("O'Brien")
    const status = page.locator('.request-filters select')
    await status.selectOption('126110000')
    await expect(page.locator('.request-record')).toHaveCount(1)
    await page.locator('.request-pagination button').last().click()
    await expect(page.locator('.request-pagination > span')).toContainText('2')
    await search.fill('Building')
    await page.getByRole('search').getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page.locator('.request-pagination > span')).toContainText('1')
    await expect(status).toHaveValue('126110000')
    await expect.poll(() => page.evaluate(() => window.__estimateQueries.at(-1))).toEqual({
      search: 'Building', status: '126110000', market: 126110000, recent: false, skipToken: undefined, ownerId: undefined,
    })
    await search.fill('')
    await search.press('Enter')
    await expect.poll(() => page.evaluate(() => window.__estimateQueries.at(-1).search)).toBe('')
    await changeLanguageInSettings(page, 'fr')
    await expect(search).toHaveAttribute('placeholder', 'Rechercher par début de numéro, client ou immeuble')
    await checkLayout(page, { width, height: 768 }, 'header search results in French')
  })
}

test('header search preserves the unsaved workspace without a discard prompt', async ({ page }) => {
  await completeDraft(page)
  const dialogs = []
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss() })
  const search = page.locator('#header-request-search')
  await search.fill('Repair')
  await search.press('Enter')
  await expect(page.locator('.stepper')).toHaveCount(0)
  await expect(page.locator('.request-record')).toHaveCount(1)
  await page.locator('.main-nav .nav-item').nth(1).click()
  await expect(page.locator('.customer-summary')).toContainText('Draft customer')
  await expect(page.locator('[aria-current="step"]')).toContainText('5')
  expect(dialogs).toEqual([])
})

for (const language of ['en', 'fr']) {
  test(`Pending-only donut has a zero total and no invalid segments in ${language}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 768 })
    await mockData(page, language, 'light')
    await page.addInitScript(() => { window.__dashboardStatuses = [{ status: 126110001, count: 125 }] })
    await page.goto('/')
    await expect(page.locator('.donut-total strong')).toHaveText('0')
    await expect(page.locator('.status-legend strong')).toHaveText(['0', '0'])
    await expect(page.locator('.donut-segment')).toHaveCount(0)
    await expect(page.locator('.status-chart-card')).toContainText(language === 'fr'
      ? 'Aucun brouillon ni devis soumis' : 'No Draft or Submitted estimates')
    await expect(page.locator('.dashboard-stats strong').first()).toHaveText('125')
    await expect(page.locator('.dashboard-stat-copy > span')).toHaveText(language === 'fr'
      ? ['Total des devis', 'Brouillons', 'Soumis', 'CMII réel moyen']
      : ['Total estimates', 'Draft', 'Submitted', 'Average actual CMII'])
    await expect(page.locator('.dashboard-stats')).not.toContainText(language === 'fr' ? 'En attente' : 'Pending')
    await checkLayout(page, { width: 320, height: 768 }, 'Pending-only donut')
  })
}

test('dashboard adapter calls the existing generated action without a client-selected owner or year', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await page.unroute('**/src/data/dashboardRepository.ts*')
  await page.route('**/src/generated/services/Re_DraftEstimateService.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export class Re_DraftEstimateService {
      static async re_DraftEstimate(input) {
        window.__dashboardActionInput = JSON.parse(input);
        return window.__dashboardActionResponse || {success:false,error:{message:'Not deployed'}};
      }
    }`,
  }))
  await page.goto('/')
  const response = {
    mode: 'dashboard', ownerId: 'user', market: 126110000, period: 'all-time',
    generatedAt: '2026-10-26T11:15:58Z', total: 0, marginCount: 0, averageCmii: null,
    statuses: [], jobTypes: [],
  }
  const result = await page.evaluate(async (data) => {
    const { getDashboard } = await import('/src/data/dashboardRepository.ts')
    window.__dashboardActionResponse = { success: true, data: { ResultJson: JSON.stringify(data) } }
    const loaded = await getDashboard(126110000, 'user')
    return { loaded, input: window.__dashboardActionInput }
  }, response)
  expect(result.loaded).toEqual(response)
  expect(result.input).toEqual({ mode: 'dashboard', market: 126110000 })
  for (const actionResponse of [
    { success: true, data: {} }, { success: true, data: { ResultJson: '{}' } },
    { success: false, error: { message: 'Permission denied' } },
  ]) {
    const error = await page.evaluate(async (data) => {
      const { getDashboard } = await import('/src/data/dashboardRepository.ts')
      window.__dashboardActionResponse = data
      try { await getDashboard(126110000, 'user'); return '' }
      catch (reason) { return reason.message }
    }, actionResponse)
    expect(error).toMatch(/invalid response|Invalid dashboard|Permission denied/)
  }
})

async function equipmentWorkbook(rows, headers = ['Equipment Number', 'Equipment Name', 'Age', 'Location', 'Manufacturer']) {
  const book = new ExcelJS.Workbook()
  const sheet = book.addWorksheet('Equipment')
  sheet.addRow(headers)
  sheet.getColumn(1).numFmt = '@'
  for (const row of rows) sheet.addRow(row)
  return { name: 'equipment.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await book.xlsx.writeBuffer()) }
}

for (const language of ['en', 'fr']) for (const width of [320, 1366]) {
  test(`Excel equipment upload adds matched and unlisted details and survives reopen at ${width}px ${language}`, async ({ page }, testInfo) => {
    test.setTimeout(180000)
    await completeDraft(page, { width, height: 900 }, language)
    for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
    await page.evaluate(() => {
      window.__equipmentResults = [{
        re_equipmentid: 'master-from-excel', re_equipment: '20000711', re_equipmentname: 'Trusted master lift',
        re_functionallocation: 'Master location', re_equipmentage: 12, re_oem: 'Master manufacturer',
        re_soldtoname: 'Master customer',
      }]
    })
    const importPanel = page.locator('.equipment-excel-upload').first()
    const upload = importPanel.locator('input[type="file"]')
    await expect(upload).toBeHidden()
    const buttons = importPanel.getByRole('button')
    await expect(buttons).toHaveCount(2)
    const boxes = await buttons.evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, height: rect.height,
        fits: element.scrollWidth <= element.clientWidth + 1 }
    }))
    expect(boxes.every(box => box.height >= 44 && box.fits)).toBe(true)
    if (width === 320) expect(boxes[1].y).toBeGreaterThan(boxes[0].bottom)
    else {
      expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(2)
      expect(boxes[1].x).toBeGreaterThan(boxes[0].right)
    }
    const chooserEvent = page.waitForEvent('filechooser')
    await importPanel.getByRole('button', { name: language === 'fr' ? 'Téléverser le fichier Excel' : 'Upload Excel file', exact: true }).click()
    const chooser = await chooserEvent
    const file = await equipmentWorkbook([
      ['20000711', 'Do not override master', 99, 'Wrong location', 'Wrong manufacturer'],
      ['00000712', 'New lobby lift', 0, 'Ground floor', 'KONE'],
      ['00000712', 'New lobby lift', 0, 'Ground floor', 'KONE'],
      ['TEST123', 'Already selected', 15, '', ''],
    ])
    await chooser.setFiles(file)
    await expect(page.locator('.equipment-card:not(.selected-package-card)')).toHaveCount(3, { timeout: 90000 })
    const matched = page.locator('.equipment-card:not(.selected-package-card)').filter({ hasText: '20000711' })
    await expect(matched).toContainText('Trusted master lift')
    await expect(matched).not.toContainText('Do not override master')
    const unlisted = page.locator('.equipment-card:not(.selected-package-card)').filter({ hasText: '00000712' })
    for (const value of ['New lobby lift', 'Ground floor', 'KONE', 'Draft customer'])
      await expect(unlisted).toContainText(value)
    await expect(unlisted).toContainText(language === 'fr' ? 'Âge: 0' : 'Age: 0')
    await expect(importPanel.locator('.equipment-excel-filename')).toContainText('equipment.xlsx')
    await expect(page.locator('.equipment-import-total')).toContainText(language === 'fr' ? 'Équipements ajoutés' : 'Equipment added')
    await expect(page.locator('.equipment-import-summary')).not.toContainText('pasted list')
    await importPanel.screenshot({ path: testInfo.outputPath('excel-import-panel.png') })
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', width)
    await expect(page.locator('.selected-package-card dt').filter({ hasText: /^(Number of equipment|Nombre d’équipements)$/ }).locator('+ dd')).toHaveText('3')
    await upload.setInputFiles(file)
    await expect(page.locator('.equipment-card:not(.selected-package-card)')).toHaveCount(3)
    await page.locator('.draft-save-action').click()
    await expect(page.locator('.draft-saved')).toBeVisible()
    const equipment = await page.evaluate(() => window.__draftSaved.equipment)
    expect(equipment.map(row => row.number)).toEqual(['TEST123', '20000711', '00000712'])
    expect(equipment[2]).toMatchObject({ matched: false, name: 'New lobby lift', age: 0,
      location: 'Ground floor', oem: 'KONE', customer: 'Draft customer' })
    await page.locator('.draft-secondary-actions button').nth(1).click()
    await next(page)
    await expect(page.locator('.equipment-card:not(.selected-package-card)')).toHaveCount(3)
    await expect(page.locator('.equipment-card:not(.selected-package-card)').filter({ hasText: '00000712' })).toContainText('New lobby lift')
  })
}

test('Excel equipment template downloads and corrupt, conflicting and invalid rows add nothing', async ({ page }) => {
  await completeDraft(page)
  for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
  const downloadEvent = page.waitForEvent('download')
  await page.locator('.equipment-excel-upload').first().getByRole('button', { name: 'Download Excel template', exact: true }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('Equipment-Template.xlsx')
  const book = new ExcelJS.Workbook()
  await book.xlsx.readFile(await download.path())
  expect(book.worksheets[0].getRow(1).values.slice(1)).toEqual(['Equipment Number', 'Equipment Name', 'Age', 'Location', 'Manufacturer'])
  const upload = page.locator('.equipment-excel-upload').first().locator('input[type="file"]')
  for (const [file, error] of [
    [{ name: 'equipment.csv', mimeType: 'text/csv', buffer: Buffer.from('20000711') }, 'Upload an Excel .xlsx file'],
    [{ name: 'corrupt.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('not Excel') }, 'Cannot read this workbook'],
    [await equipmentWorkbook([['NEW1', 'Valid'], ['NEW2', 'Invalid age', 201]]), 'Row 3'],
    [await equipmentWorkbook([['NEW1', 'One'], ['NEW1', 'Conflicting']]), 'conflicting details'],
  ]) {
    await upload.setInputFiles(file)
    await expect(page.locator('.error-box').filter({ hasText: error })).toBeVisible()
    await expect(page.locator('.equipment-card:not(.selected-package-card)')).toHaveCount(1)
  }
})

test('Excel equipment lookup failure adds no unlisted rows and retry uses batches without truncation', async ({ page }) => {
  await completeDraft(page)
  for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
  await page.evaluate(() => {
    window.__equipmentLookupError = 'Equipment lookup unavailable'
    window.__equipmentResults = []
    window.__equipmentLookups = []
  })
  const file = await equipmentWorkbook(Array.from({ length: 60 }, (_, i) => [`EXCEL-${i}`, `Lift ${i}`, 5, 'Lobby', 'KONE']))
  const upload = page.locator('.equipment-excel-upload').first().locator('input[type="file"]')
  await upload.setInputFiles(file)
  await expect(page.locator('.error-box').filter({ hasText: 'Equipment lookup unavailable' })).toBeVisible()
  await expect(page.locator('.equipment-card:not(.selected-package-card)')).toHaveCount(1)
  await page.evaluate(() => { window.__equipmentLookupError = ''; window.__equipmentLookups = [] })
  await upload.setInputFiles(file)
  await expect(page.locator('.equipment-card:not(.selected-package-card)')).toHaveCount(61)
  expect(await page.evaluate(() => window.__equipmentLookups.map(call => call.numbers.length))).toEqual([50, 10])
})

test('Excel equipment late lookup cannot populate a new draft and saving is blocked while importing', async ({ page }) => {
  await completeDraft(page)
  for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
  await page.evaluate(() => { window.__equipmentLookupDelay = 1500; window.__equipmentResults = [] })
  await page.locator('.equipment-excel-upload').first().locator('input[type="file"]').setInputFiles(await equipmentWorkbook([['LATE1', 'Late lift']]))
  await expect(page.locator('.draft-save-action')).toBeDisabled()
  page.once('dialog', dialog => dialog.accept())
  await page.locator('.draft-secondary-actions button').first().click()
  await expect(page.locator('#estimate-title')).toHaveValue('')
  await page.waitForTimeout(1700)
  await expect(page.locator('.equipment-card:not(.selected-package-card)')).toHaveCount(0)
  await expect(page.locator('#estimate-title')).toHaveValue('')
})

test('Excel equipment details are kept on screen with explicit warning when an older server drops snapshots', async ({ page }) => {
  await completeDraft(page)
  for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
  await page.locator('.equipment-excel-upload').first().locator('input[type="file"]').setInputFiles(await equipmentWorkbook([['NEW1', 'Keep my lift', 5, 'Lobby', 'KONE']]))
  await expect(page.locator('.equipment-card:not(.selected-package-card)')).toHaveCount(2)
  await page.evaluate(() => { window.__dropUnlistedDetails = true })
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.error-box').filter({ hasText: 'server did not retain unlisted equipment details' })).toBeVisible()
  await expect(page.locator('.equipment-card:not(.selected-package-card)').filter({ hasText: 'NEW1' })).toContainText('Keep my lift')
  await expect(page.locator('.draft-saved')).toHaveCount(0)
})

test('equipment step has no contract card and sends no contract operations', async ({ page }) => {
  await completeDraft(page, { width: 1366, height: 900 }, 'en', 'light')
  for (let i = 0; i < 3; i++) await page.locator('.form-footer > button').click()
  await expect(page.locator('#equipment-search')).toBeEnabled()
  await expect(page.locator('.contract-equipment-card')).toHaveCount(0)
  await expect(page.getByText('Add equipment by contract')).toHaveCount(0)
  expect(await page.evaluate(() => window.__contractCalls ?? [])).toEqual([])
})
