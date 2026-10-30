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
          status:input.mode === 'submit' ? 126110002 : 126110000,
          version:String(Number(window.__draftSaved?.version || 0) + 1),
          number:'0000000042', salesperson:'Original Salesperson', pricingState:window.__pricingState,
          equipment:input.equipment.map((e) => e.matched ? {...e,name:'Persisted equipment snapshot'}
            : window.__dropUnlistedDetails ? {...e,name:'',location:'',oem:'',age:null} : e),
          packages:input.packages.map((p) => {
            const packagePriced = input.materialLines?.some(m => m.packageId === p.id && m.pricingSource === 'package');
            const source = window.__extraPackages?.find(master => master.re_repairpackageid === p.id);
            return {...p,nameEn:'Persisted package snapshot',nameFr:'Forfait enregistré',scopeEn:'Persisted scope',
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
      await expect(logo).toHaveAttribute('src', /kone-logo-small\.jpg/)
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
      await branch.fill('020')
      await expect(page.locator('#branch-options')).toBeVisible()
      await checkLayout(page, viewport, 'branch search open')
      await branch.press('ArrowDown')
      await branch.press('Enter')
      await page.locator('#equipment-type').selectOption('test-type')
      await page.locator('#opportunity-building').fill('Test building / Immeuble de démonstration')
      await page.locator('#customer-name').fill('Test customer')
      await page.locator('#customer-email').fill('test@example.invalid')
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

      await expect(page.locator('#request-re_additionallaborhours')).not.toBeEditable()
      await expect(page.locator('#request-re_additionalmaterial')).not.toBeEditable()
      await checkLayout(page, viewport, 'cost inputs')
      await next(page)
      await page.locator('#request-re_sellprice').fill('1500')
      await page.locator('#request-re_margincomments').fill('Representative margin comment / Commentaire représentatif.')
      await checkLayout(page, viewport, 'pricing')
      await next(page)
      await expect(page.locator('.customer-summary')).toContainText('Test customer')
      await page.locator('details').evaluateAll((details) => details.forEach((el) => { el.open = true }))
      await checkLayout(page, viewport, 'expanded review')
      await expect(page.locator('.footer-actions .button')).toBeDisabled()
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
  await expect(logo).toHaveAttribute('src', /kone-logo-small\.jpg/)
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
    const lookups = await page.evaluate(() => window.__equipmentLookups)
    expect(lookups.flatMap((lookup) => lookup.numbers)).toEqual(numbers)
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

async function completeDraft(page, viewport = { width: 1366, height: 768 }, language = 'en', theme = 'light') {
  await page.setViewportSize(viewport)
  await mockData(page, language, theme)
  await page.goto('/')
  await expect(page.locator('.market-control select')).toBeEnabled()
  await page.locator('.main-nav .nav-item').nth(1).click()
  await page.locator('#estimate-title').fill('Motor repair draft')
  await page.locator('#branch-select').fill('020')
  await page.locator('#branch-select').press('ArrowDown')
  await page.locator('#branch-select').press('Enter')
  await page.locator('#equipment-type').selectOption('test-type')
  await page.locator('#opportunity-building').fill('Building 42')
  await page.locator('#customer-name').fill('Draft customer')
  await page.locator('#customer-email').fill('draft@example.invalid')
  await next(page)
  await pickEquipmentAndPackage(page)
  await next(page)
  await expect(page.locator('#request-re_usetax')).toHaveValue('5.00')
  await expect(page.locator('#request-re_freight')).toHaveValue('14.00')
  await expect(page.locator('#request-re_usetax')).not.toBeEditable()
  await expect(page.locator('#request-re_freight')).not.toBeEditable()
  await expect(page.locator('#request-re_additionallaborhours')).not.toBeEditable()
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
    for (const [key, value] of [['re_usetax', '5'], ['re_freight', '14']]) {
      const input = page.locator(`#request-${key}`)
      await input.focus()
      await input.press('ControlOrMeta+A')
      await input.pressSequentially(value)
    }
    await page.getByRole('button', { name: language === 'fr' ? 'Ajouter main-d’œuvre' : 'Add labor', exact: true }).click()
    await page.locator('.custom-cost-line').filter({ has: page.locator('legend', { hasText: /^(Labor|Main-d’œuvre)/ }) }).getByRole('spinbutton').fill('2')
    await page.getByRole('button', { name: language === 'fr' ? 'Ajouter un matériau' : 'Add material', exact: true }).click()
    return page.locator('.custom-cost-line').filter({ has: page.locator('legend', { hasText: /^(Material|Matériau)/ }) })
  }

  for (const width of [320, 1366]) for (const language of ['en', 'fr']) {
    test(`CSTM package KONE and manual non-KONE save without catalog at ${width}px ${language}`, async ({ page }) => {
      const fr = language === 'fr'
      const materials = await openCatalogMaterial(page, false, language, width)
      const material = materials.first()
      const type = fr ? 'Type de pièce' : 'Part type'
      await material.getByRole('combobox', { name: type, exact: true }).selectOption('package')
      await material.getByRole('textbox', { name: 'Description', exact: true }).fill('Package-priced motor')
      await material.getByRole('textbox', { name: fr ? 'Numéro de pièce' : 'Part number', exact: true }).fill('KM-MANUAL')
      await material.getByRole('spinbutton', { name: fr ? 'Quantité (information seulement)' : 'Quantity (reference only)', exact: true }).fill('50')
      await expect(material.getByLabel(fr ? 'Majoration KONE (%)' : 'KONE markup (%)')).toHaveCount(0)
      await expect(material.getByRole('spinbutton', { name: fr ? 'Coût unitaire' : 'Unit cost', exact: true })).toHaveCount(0)
      await expect(material).toContainText(fr ? '617,45' : '617.45')
      await expect(material).toContainText(fr ? '849,77' : '849.77')
      await page.getByRole('button', { name: fr ? 'Ajouter un matériau' : 'Add material', exact: true }).click()
      const manual = materials.last()
      await manual.getByRole('combobox', { name: type, exact: true }).selectOption('manual')
      await manual.getByRole('textbox', { name: 'Description', exact: true }).fill('Manual non-KONE component')
      await manual.getByRole('textbox', { name: fr ? 'Numéro de pièce' : 'Part number', exact: true }).fill('MANUAL-001')
      await manual.getByRole('spinbutton', { name: fr ? 'Coût unitaire' : 'Unit cost', exact: true }).fill('12.50')
      await expect(page.locator('body')).toHaveJSProperty('scrollWidth', width)
      await page.getByRole('button', { name: fr ? 'Calculer et retourner aux forfaits' : 'Calculate and return to packages', exact: true }).click()
      await expect(page.locator('#package-search')).toBeVisible()
      await page.locator('.draft-save-action').click()
      await expect(page.locator('.draft-saved')).toBeVisible()
      const lines = await page.evaluate(() => window.__draftSaved.materialLines)
      expect(await page.evaluate(() => window.__draftSaved.packages.find(p => p.id === 'catalog-custom')))
        .toMatchObject({ materialBeforeMarkup: 617.45, material: 849.77 })
      expect(lines[0]).toMatchObject({ partType: 'kone', pricingSource: 'package',
        unitCost: 0, part: 'KM-MANUAL', quantity: 50, packageId: 'catalog-custom' })
      expect(lines[0].catalogPartId).toBeUndefined()
      expect(lines[0].markupPercent).toBeUndefined()
      expect(lines[1]).toMatchObject({ partType: 'non-kone', pricingSource: 'manual', part: 'MANUAL-001', unitCost: 12.5 })
      expect(lines[1].catalogPartId).toBeUndefined()
      expect(lines[1].markupPercent).toBeUndefined()
      expect(await page.evaluate(() => window.__catalogRequests || [])).toEqual([])
    })
  }

  test('CSTM manual entry is available without catalog warnings or requests', async ({ page }) => {
    const material = (await openCatalogMaterial(page, false)).first()
    await expect(page.locator('.custom-cost-lines')).not.toContainText('Catalog unavailable')
    await expect(material.getByRole('combobox', { name: 'Part type', exact: true })).toBeEnabled()
    await material.getByRole('textbox', { name: 'Description', exact: true }).fill('Existing manual motor')
    await material.getByRole('spinbutton', { name: 'Unit cost', exact: true }).fill('25')
    await page.getByRole('button', { name: 'Calculate and return to packages', exact: true }).click()
    await page.locator('.draft-save-action').click()
    await expect(page.locator('.draft-saved')).toBeVisible()
    expect(await page.evaluate(() => window.__draftSaved.materialLines[0].pricingSource)).toBe('manual')
  })

  test('CSTM switching between package KONE and manual non-KONE clears extra pricing', async ({ page }) => {
    const material = (await openCatalogMaterial(page, true)).first()
    await material.getByRole('textbox', { name: 'Description', exact: true }).fill('Manual motor')
    await material.getByRole('spinbutton', { name: 'Unit cost', exact: true }).fill('100')
    await material.getByRole('combobox', { name: 'Part type', exact: true }).selectOption('package')
    await expect(material.getByRole('spinbutton', { name: 'Unit cost', exact: true })).toHaveCount(0)
    await expect(material.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue('Manual motor')
    await material.getByRole('combobox', { name: 'Part type', exact: true }).selectOption('manual')
    await expect(material.getByRole('spinbutton', { name: 'Unit cost', exact: true })).toHaveValue('0')
    await expect(page.locator('.draft-save-action')).toBeDisabled()
  })

  test('CSTM package KONE preview rejects missing source amounts rather than pricing them as zero', async ({ page }) => {
    const material = (await openCatalogMaterial(page, false, 'en', 1366, true)).first()
    await material.getByRole('combobox', { name: 'Part type', exact: true }).selectOption('package')
    await material.getByRole('textbox', { name: 'Description', exact: true }).fill('Motor')
    await expect(material).toContainText('Package amounts are missing')
    await page.getByRole('button', { name: 'Calculate and return to packages', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Package Material Before Markup is missing or invalid.' })).toBeVisible()
    expect(await page.evaluate(() => window.__draftCalls || [])).toEqual([])
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
    await expect(page.locator('.package-cost-details').first()).toContainText('Tax (%)')
    await expect(page.locator('.package-cost-details').first()).toContainText('Freight (%)')
    await expect(page.locator('.draft-save-action')).toBeDisabled()
    const calculate = page.getByRole('button', { name: 'Calculate and return to packages', exact: true })
    await calculate.click()
    await expect(page.locator('.custom-cost-lines')).toBeVisible()
    await page.getByRole('button', { name: 'Add labor', exact: true }).click()
    const labor = page.locator('.custom-cost-line').filter({ has: page.locator('legend', { hasText: /^Labor/ }) }).last()
    await labor.locator('input').fill(String(index + 2))
    await page.getByRole('button', { name: 'Add material', exact: true }).click()
    const material = page.locator('.custom-cost-line').filter({ has: page.locator('legend', { hasText: /^Material/ }) }).last()
    await material.locator('textarea').fill(`Motor ${index}`)
    await material.locator('input').nth(2).fill('2')
    await calculate.click()
    await expect(page.locator('.custom-cost-lines')).toBeVisible()
    await expect(page.locator('.draft-save-action')).toBeDisabled()
    await material.locator('input').nth(3).fill('25')
    if (index === 0) {
      await expect(page.locator('.package-cost-pending')).toBeVisible()
      const labels = await page.locator('.package-cost-details dt').evaluateAll((elements) =>
        elements.map((el) => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })))
      expect(labels.every((label) => label.width >= 100 && label.height < 80)).toBe(true)
    }
    await expect(page.locator('#request-re_usetax')).toBeEditable()
    await expect(page.locator('#request-re_freight')).toBeEditable()
    for (const [key, value] of [['re_usetax', '8'], ['re_freight', '20']]) {
      const input = page.locator(`#request-${key}`)
      await input.click()
      await input.press('ControlOrMeta+A')
      await input.pressSequentially(value)
    }
    await calculate.click()
    await expect(page.locator('#package-search')).toBeVisible()
    await expect(page.locator('.selected-package-card').first()).toContainText('259.50 USD')
    await expect(page.locator('.selected-package-card').nth(index + 1)).toContainText(`${(index + 2) * 100 + 64}.00 USD`)
    const customCard = page.locator('.selected-package-card').nth(index + 1)
    await expect(customCard.locator('dt').filter({ hasText: /^Tax \(%\)$/ }).locator('+ dd')).toHaveText('8.00%')
    await expect(customCard.locator('dt').filter({ hasText: /^Freight \(%\)$/ }).locator('+ dd')).toHaveText('20.00%')
  }
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.draft-saved')).toBeVisible()
  expect(await page.evaluate(() => window.__draftSaved.laborLines.map((l) => l.packageId))).toEqual(['custom-0', 'custom-1'])
  expect(await page.evaluate(() => window.__draftSaved.materialLines.map((m) => m.packageId))).toEqual(['custom-0', 'custom-1'])
  const fields = await page.evaluate(() => window.__draftSaved.fields)
  expect(fields).toContainEqual({ key: 're_usetax', value: '8' })
  expect(fields).toContainEqual({ key: 're_freight', value: '20' })
  await page.locator('.draft-secondary-actions button').nth(1).click()
  await next(page)
  await expect(page.locator('.package-cost-details')).toHaveCount(3)
})

for (const width of [320, 1366]) {
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
      await expect(page.locator(`#request-${key}`)).not.toBeEditable()
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
    await material.locator('textarea').fill('Motor')
    await material.locator('input').nth(2).fill('2')
    await material.locator('input').nth(3).fill('25')
    await page.locator('#request-re_usetax').fill('8')
    await page.locator('#request-re_freight').fill('20')
    await page.getByRole('button', { name: 'Calculate and return to packages', exact: true }).click()
    await page.locator('#package-search').fill('PIT')
    await page.locator('#package-options button').first().click()
    await page.locator('#package-search').press('Escape')
    await next(page)
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
    await checkLayout(page, { width, height: 900 }, 'all package costs before additions')
    await summary.screenshot({ path: testInfo.outputPath('all-package-costs.png') })
    await next(page)
    await expect(summary.locator('.package-combined-total dd')).toHaveText('742.50 USD')
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

test('customer email is required before continuing or saving a draft', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await page.goto('/')
  await page.locator('.main-nav .nav-item').nth(1).click()
  await page.locator('#branch-select').fill('020')
  await page.locator('#branch-select').press('ArrowDown')
  await page.locator('#branch-select').press('Enter')
  await page.locator('#equipment-type').selectOption('test-type')
  await page.locator('#opportunity-building').fill('Building 42')
  await page.locator('#customer-name').fill('Test customer')

  const email = page.locator('#customer-email')
  await expect(email).toHaveAttribute('required', '')
  await expect(email).toHaveAttribute('aria-required', 'true')
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
  await expect(page.locator('.footer-actions .button')).toBeDisabled()
  await expect(page.locator('.draft-toolbar .primary')).toBeDisabled()

  await email.fill('not-an-email')
  await expect(page.locator('.footer-actions .button')).toBeEnabled()
  await page.locator('.footer-actions .button').click()
  await expect(page.locator('#equipment-search')).toHaveCount(0)

  await email.fill('test@example.invalid')
  await page.locator('.footer-actions .button').click()
  await expect(page.locator('#equipment-search')).toBeVisible()
})

for (const language of ['en', 'fr']) {
  test(`customer combobox uses branch names, supports keyboard and manual entry in ${language}`, async ({ page }) => {
    await mockData(page, language, 'light')
    await page.goto('/')
    await expect(page.locator('.market-control select')).toBeEnabled()
    await page.evaluate(() => {
      window.__branches = [
        { re_branchid: 'branch-a', re_branchname: 'Alpha branch', re_branchnumber: '020', re_market: 126110000 },
        { re_branchid: 'branch-b', re_branchname: 'Beta branch', re_branchnumber: '030', re_market: 126110000 },
      ]
    })
    await page.locator('.main-nav .nav-item').nth(1).click()
    const customer = page.locator('#customer-name')
    await expect(customer).toBeDisabled()
    await page.locator('#branch-select').fill('020')
    await page.locator('#branch-select').press('ArrowDown')
    await page.locator('#branch-select').press('Enter')
    await customer.click()
    await expect(page.locator('#customer-name-options [role=option]')).toHaveCount(2)
    await expect.poll(() => page.evaluate(() => window.__customerCalls)).toEqual(['branch-a'])
    await customer.fill('acme')
    await expect(page.locator('#customer-name-options [role=option]')).toHaveCount(1)
    await customer.press('ArrowDown')
    await customer.press('Enter')
    await expect(customer).toHaveValue('Acme Customer')
    await expect(customer).toHaveAttribute('aria-expanded', 'false')
    await customer.fill('New unlisted customer')
    await customer.press('Escape')
    await expect(customer).toHaveValue('New unlisted customer')
    await page.evaluate(() => { window.__customerNames = ['Other branch customer'] })
    await page.locator('#branch-select').fill('030')
    await page.locator('#branch-select').press('ArrowDown')
    await page.locator('#branch-select').press('Enter')
    await expect(customer).toHaveValue('')
    await customer.click()
    await expect(page.locator('#customer-name-options')).toContainText('Other branch customer')
    await expect(page.locator('#customer-name-options')).not.toContainText('Acme Customer')
    await expect.poll(() => page.evaluate(() => window.__customerCalls)).toEqual(['branch-a', 'branch-b'])
  })
}

test('customer combobox exposes loading errors, retries and searches beyond the displayed suggestions', async ({ page }) => {
  await mockData(page, 'en', 'light')
  await page.goto('/')
  await expect(page.locator('.market-control select')).toBeEnabled()
  await page.locator('.main-nav .nav-item').nth(1).click()
  await page.locator('#branch-select').fill('020')
  await page.locator('#branch-select').press('ArrowDown')
  await page.locator('#branch-select').press('Enter')
  await page.evaluate(() => { window.__customerError = 'Equipment access denied' })
  const customer = page.locator('#customer-name')
  await customer.click()
  await expect(page.locator('.branch-popup [role=alert]')).toContainText('Equipment access denied')
  await customer.fill('Manual customer despite error')
  await expect(customer).toHaveValue('Manual customer despite error')
  await customer.fill('')
  await page.evaluate(() => {
    window.__customerError = ''
    window.__customerDelay = 300
    window.__customerNames = Array.from({ length: 60 }, (_, i) => `Customer ${String(i).padStart(2, '0')}`)
  })
  await page.locator('.branch-popup button', { hasText: 'Retry' }).click()
  await expect(page.getByText('Loading customers…', { exact: true })).toBeVisible()
  await expect(page.locator('#customer-name-options [role=option]')).toHaveCount(50)
  await expect(page.getByText('Showing 50 results.', { exact: false })).toBeVisible()
  await customer.fill('Customer 59')
  await expect(page.locator('#customer-name-options [role=option]')).toHaveCount(1)
  await page.locator('#customer-name-options button').click()
  await expect(customer).toHaveValue('Customer 59')
})

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
  await page.locator('#customer-name').fill('Paste customer')
  await page.locator('#customer-email').fill('paste@example.invalid')
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
      const caption = label.getBoundingClientRect()
      const marker = label.querySelector('.required').getBoundingClientRect()
      const input = document.querySelector('#customer-name').getBoundingClientRect()
      const email = document.querySelector('#customer-email').getBoundingClientRect()
      return { inline: marker.top >= caption.top && marker.bottom <= caption.bottom + 1,
        aligned: Math.abs(input.top - email.top) <= 1 }
    })
    expect(geometry).toEqual({ inline: true, aligned: true })
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
  await page.evaluate(() => { window.__draftFailure = 'RE-101|MARGIN_COMMENT_REQUIRED' })
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Submit estimate', exact: true }).click()
  await expect(page.locator('.draft-error')).toContainText('MARGIN_COMMENT_REQUIRED')
  await expect(page.locator('.draft-saved')).toHaveCount(0)
  await expect(page.locator('#request-re_notesforcttteam')).toBeEditable()
  await expect(page.locator('.customer-summary')).toContainText('Draft customer')
})

test('customer details edit only on opportunity page and survive save and reopen', async ({ page }) => {
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
  await expect(page.locator('#opportunity-building')).toHaveCount(1)
  await customer.locator('#customer-phone').fill('1234567890')
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320)
  await page.locator('.draft-save-action').click()
  await expect.poll(() => page.evaluate(() => window.__draftCalls.at(-1).phone)).toBe('1234567890')
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
    await material.locator('textarea').fill('Custom motor')
    await material.locator('input').nth(0).fill('KONE')
    await material.locator('input').nth(1).fill('KM123')
    await material.locator('input').nth(2).fill('2')
    await material.locator('input').nth(3).fill('25.50')
    await page.locator('#request-re_usetax').fill('5')
    await page.locator('#request-re_freight').fill('14')
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320)
    await checkLayout(page, { width: 320, height: 700 }, 'custom cost entry')
    await page.locator('.footer-actions .button').click()
    await expect(page.locator('#package-search')).toBeVisible()
    await next(page)
    await next(page)
    await page.locator('#request-re_konesparessalespricevk13').fill('150')
    await next(page)
    await page.locator('.draft-save-action').click()
    await expect(page.locator('.draft-saved')).toContainText('0000000042')
    const saved = await page.evaluate(() => window.__draftCalls.at(-1))
    expect(saved.packages).toHaveLength(5)
    expect(saved.laborLines[0]).toMatchObject({ role: 126110001, time: 126110001, hours: 3.25 })
    expect(saved.materialLines[0]).toMatchObject({ description: 'Custom motor', vendor: 'KONE', quantity: 2, unitCost: 25.5 })
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
    await page.locator('#customer-email').fill('new@example.invalid')
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
      id: `material${i}`, description: `Part ${i + 1}`, vendor: '', part: '', quantity: 1, unitCost: 10,
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
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.locator('.main-nav .nav-item').nth(1).click()
  await expect(page.locator('.operations-dashboard')).toBeVisible()
  expect(await page.evaluate(() => window.__draftCalls.length)).toBe(1)
  page.once('dialog', (dialog) => dialog.accept())
  await market.selectOption('126110001')
  await expect(market).toHaveValue('126110001')
  await page.locator('.main-nav .nav-item').nth(1).click()
  await expect(page.locator('#estimate-title')).toHaveValue('')
  await expect(market).toBeEnabled()
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

  for (const entry of ['dashboard', 'sidebar']) {
    test(`new request clears the previous saved draft via ${entry} at ${width}px`, async ({ page }) => {
      await completeDraft(page, { width, height: 900 })
      await page.locator('.draft-save-action').click()
      await expect(page.locator('.draft-saved')).toBeVisible()
      const previous = await page.evaluate(() => structuredClone(window.__draftSaved))
      await page.locator('.main-nav .nav-item').nth(0).click()
      const start = entry === 'dashboard'
        ? page.locator('.operations-dashboard .page-heading .primary')
        : page.locator('.main-nav .nav-item').nth(1)
      await start.click()
      await expect(page.locator('#estimate-title')).toHaveValue('')
      await expect(page.locator('#opportunity-building')).toHaveValue('')
      await expect(page.locator('#branch-select')).toBeEnabled()
      await expect(page.locator('.market-control select')).toBeEnabled()
      await expect(page.locator('.draft-saved')).toHaveCount(0)
      await expect(page.locator('.draft-toolbar').getByRole('button', { name: 'Reload draft' })).toHaveCount(0)
      await expect(page.locator('.draft-toolbar .primary')).toBeDisabled()
      await page.locator('#estimate-title').fill('Fresh request')
      page.once('dialog', (dialog) => dialog.dismiss())
      await page.locator('.main-nav .nav-item').nth(1).click()
      await expect(page.locator('#estimate-title')).toHaveValue('Fresh request')
      page.once('dialog', (dialog) => dialog.accept())
      await page.locator('.main-nav .nav-item').nth(1).click()
      await expect(page.locator('#estimate-title')).toHaveValue('')
      await page.locator('#estimate-title').fill('Separate estimate')
      await page.locator('#branch-select').fill('020')
      await page.locator('#branch-select').press('ArrowDown')
      await page.locator('#branch-select').press('Enter')
      await page.locator('#equipment-type').selectOption('test-type')
      await page.locator('#opportunity-building').fill('New building')
      await expect(page.locator('#customer-name')).toHaveValue('')
      await expect(page.locator('#customer-email')).toHaveValue('')
      await page.locator('#customer-name').fill('New customer')
      await page.locator('#customer-email').fill('new@example.invalid')
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
    window.__draftSaved.materialLines = [{ id: 'material', packageId: 'test-package', description: 'Part', vendor: '', part: '', quantity: 1, unitCost: 10 }]
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
  await expect(page.locator('#request-re_sellprice')).toHaveValue(/^1500(?:\.00)?$/)
  await expect(calculate).toBeEnabled()
  await expect(page.locator('.draft-saved')).toHaveCount(0)
  await page.evaluate(() => { window.__draftFailure = '' })
  await calculate.click()
  await expect(page.locator('.pricing-summary')).toContainText('$31,807.21')
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
  await expect(summary).toContainText('different saved version')
  await expect(summary).not.toContainText('CA$31,807.21')
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

test('header search respects unsaved draft confirmation and retains inputs on cancellation', async ({ page }) => {
  await completeDraft(page)
  const search = page.locator('#header-request-search')
  await search.fill('Repair')
  page.once('dialog', (dialog) => dialog.dismiss())
  await search.press('Enter')
  await expect(page.locator('.customer-summary')).toBeVisible()
  await expect(page.locator('.stepper')).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await search.press('Enter')
  await expect(page.locator('.stepper')).toHaveCount(0)
  await expect(page.locator('.request-record')).toHaveCount(1)
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
    const upload = page.locator('.equipment-excel-upload input[type="file"]')
    const importPanel = page.locator('.equipment-excel-upload')
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
  await page.getByRole('button', { name: 'Download Excel template', exact: true }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toBe('Equipment-Template.xlsx')
  const book = new ExcelJS.Workbook()
  await book.xlsx.readFile(await download.path())
  expect(book.worksheets[0].getRow(1).values.slice(1)).toEqual(['Equipment Number', 'Equipment Name', 'Age', 'Location', 'Manufacturer'])
  const upload = page.locator('.equipment-excel-upload input[type="file"]')
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
  const upload = page.locator('.equipment-excel-upload input[type="file"]')
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
  await page.locator('.equipment-excel-upload input[type="file"]').setInputFiles(await equipmentWorkbook([['LATE1', 'Late lift']]))
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
  await page.locator('.equipment-excel-upload input[type="file"]').setInputFiles(await equipmentWorkbook([['NEW1', 'Keep my lift', 5, 'Lobby', 'KONE']]))
  await expect(page.locator('.equipment-card:not(.selected-package-card)')).toHaveCount(2)
  await page.evaluate(() => { window.__dropUnlistedDetails = true })
  await page.locator('.draft-save-action').click()
  await expect(page.locator('.error-box').filter({ hasText: 'server did not retain unlisted equipment details' })).toBeVisible()
  await expect(page.locator('.equipment-card:not(.selected-package-card)').filter({ hasText: 'NEW1' })).toContainText('Keep my lift')
  await expect(page.locator('.draft-saved')).toHaveCount(0)
})
