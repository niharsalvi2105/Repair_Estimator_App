import { test, expect } from '@playwright/test'

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
        mode:'dashboard',ownerId:owner,market,year:2026,generatedAt:'2026-10-26T11:15:58Z',
        total:empty ? 0 : 125,marginCount:empty ? 0 : 100,averageCmii:empty ? null : window.__dashboardAverage ?? -0.25,
        statuses:empty ? [] : [{status:126110000,count:100},{status:126110001,count:20},{status:126110002,count:5}],
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
        if (input.mode === 'load') {
          if (!window.__draftSaved || window.__draftSaved.id !== input.id) throw new Error('Draft not found');
          return structuredClone(window.__draftSaved);
        }
        window.__draftSaved = { ...structuredClone(input),
          version:String(Number(window.__draftSaved?.version || 0) + 1),
          number:'0000000042', salesperson:'Original Salesperson', pricingState:window.__pricingState,
          equipment:input.equipment.map((e) => ({...e,name:'Persisted equipment snapshot'})),
          packages:input.packages.map((p) => ({...p,nameEn:'Persisted package snapshot',
            nameFr:'Forfait enregistré',scopeEn:'Persisted scope',hours:2.5,material:125}))
        };
        if (failure === 'timeout-after-commit') throw new Error('Timeout: outcome unknown');
        return structuredClone(window.__draftSaved);
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
      export async function getBranches() { return [{
        re_branchid:'test-branch', re_branchname:name, re_branchnumber:'020',
        re_market:126110000, _re_country_value:'test-country',
        _re_currency_value:'test-currency', _re_stateprovince_value:'test-state'
      }] }
      export async function getDraftReferences() { return {
        states:[{id:'test-state',en:'Test province',fr:'Province test',countryId:'test-country',frenchRequired:false}],
        currencies:[{id:'test-currency',code:window.__currencyCode || 'USD'}]
      } }
      export async function getRequestReferences() { return {
        equipmentTypes:[{id:'test-type',en:'Passenger elevator',fr:'Ascenseur pour passagers'}],
        jobTypes:[{id:'test-job',en:'Equipment repair',fr:'Réparation d’équipement'}]
      } }
      export async function searchEquipment() { return [{
        re_equipmentid:'test-equipment', re_equipment:'TEST123',
        re_equipmentname:'Equipment with a long descriptive name / Équipement avec un nom long',
        re_functionallocation:'Test location', re_soldtoname:'Customer with a long descriptive name',
        re_oem:'Test OEM', re_equipmentage:20
      }] }
      export async function searchStandardPackages() { return [{
        re_repairpackageid:'test-package',re_packagenumber:'PKG001',
        re_packagenameen:'Repair package with a long descriptive name',
        re_packagenamefr:'Forfait de réparation avec un long nom descriptif',
        re_proposalscopeen:'Representative scope text for responsive layout testing.',
        re_effectivefrom:'2020-01-01'
      }] }
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
    const buttonRect = await action.boundingBox()
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
      await expect(page.locator('.dashboard-stats strong').first()).toHaveText('100')
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
      await expect(opportunity.locator('fieldset > legend')).toHaveCount(2)
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
      await checkLayout(page, viewport, 'opportunity')
      await next(page)

      await page.locator('#equipment-search').fill('TEST')
      await expect(page.locator('.result-row')).toHaveCount(1)
      await checkLayout(page, viewport, 'equipment results')
      await page.locator('.result-row button').click()
      await page.locator('#package-search').fill('PK')
      await expect(page.locator('.result-row')).toHaveCount(1)
      await checkLayout(page, viewport, 'package results')
      await page.locator('.result-row button').click()
      await checkLayout(page, viewport, 'equipment and packages selected')
      await next(page)

      await page.locator('#request-re_additionallaborhours').fill('2.5')
      await page.locator('#request-re_additionalmaterial').fill('125')
      await checkLayout(page, viewport, 'cost inputs')
      await next(page)
      await page.locator('#request-re_sellprice').fill('1500')
      await page.locator('#request-re_margincomments').fill('Representative margin comment / Commentaire représentatif.')
      await checkLayout(page, viewport, 'pricing')
      await next(page)
      await page.locator('#customer-name').fill('Test customer')
      await page.locator('#customer-email').fill('test@example.invalid')
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

async function mockMasterData(page) {
  await page.route('**/src/data/masterDataRepository.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `
      import { tableByName, buildMasterChanges } from '/src/data/masterDataSchema.ts';
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
        fail();
        const table = tableByName(name);
        const allowed = ['re_packagenumber','re_packagenameen','re_packagenamefr','re_proposalscopeen',
          're_proposalscopefr','re_mechanichours','re_materialmisctaxcost','re_country'];
        return { ...table, fields:table.fields.filter((f) => name !== 're_repairpackage' || allowed.includes(f.name))
          .map((f) => ({...f,target:f.name === 're_country' ? 're_countries' : f.target})) };
      }
      export async function listMasterRecords(name, search, status, skipToken) {
        window.__masterQueries ??= []; window.__masterQueries.push({name,search,status,skipToken});
        fail();
        const table = tableByName(name);
        return { records:window.__masterEmpty ? [] : [row(table)],skipToken:skipToken ? undefined : 'master-next' };
      }
      export async function getMasterRecord(table, recordId) {
        fail();
        window.__masterReads ??= []; window.__masterReads.push(recordId);
        return {...row(table),[table.id]:recordId};
      }
      export async function searchMasterLookup(entitySet, search) {
        fail(); return {records:[{id:reference,label:'United States'}],more:true};
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
      import { tableByName } from '/src/data/masterDataSchema.ts';
      const log = (method, args) => { (window.__masterSdkCalls ??= []).push({method,args}); };
      export function getClient() { return {
        async executeAsync(request) {
          log('metadata', request);
          const table = tableByName(request.dataverseRequest.parameters.tableName);
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
    const table = await repository.getMasterMetadata('re_repairpackage', 'en')
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
    return { errors, denied, rejectedTable, tables: schema.masterTables.length, calls: window.__masterSdkCalls }
  })
  expect(result.errors).toEqual(Array(8).fill(true))
  expect(result.denied).toBe(403)
  expect(result.rejectedTable).toBe(true)
  expect(result.tables).toBe(21)
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

async function completeDraft(page, viewport = { width: 1366, height: 768 }) {
  await page.setViewportSize(viewport)
  await mockData(page, 'en', 'light')
  await page.goto('/')
  await expect(page.locator('.market-control select')).toBeEnabled()
  await page.locator('.main-nav .nav-item').nth(1).click()
  await page.locator('#estimate-title').fill('Motor repair draft')
  await page.locator('#branch-select').fill('020')
  await page.locator('#branch-select').press('ArrowDown')
  await page.locator('#branch-select').press('Enter')
  await page.locator('#equipment-type').selectOption('test-type')
  await page.locator('#opportunity-building').fill('Building 42')
  await next(page)
  await page.locator('#equipment-search').fill('TEST')
  await page.locator('.result-row button').click()
  await page.locator('#package-search').fill('PK')
  await page.locator('.result-row button').click()
  await next(page)
  // Missing branch defaults must remain blank, not silently become zero.
  await expect(page.locator('#request-re_usetax')).toHaveValue('')
  await expect(page.locator('#request-re_freight')).toHaveValue('')
  await page.locator('#request-re_usetax').fill('5')
  await page.locator('#request-re_freight').fill('0')
  await page.locator('#request-re_additionallaborhours').fill('2.5')
  await next(page)
  await page.locator('#request-re_sellprice').fill('1500')
  await next(page)
  await page.locator('#customer-name').fill('Draft customer')
  await page.locator('#customer-email').fill('draft@example.invalid')
}

for (const viewport of [{ width: 320, height: 568 }, { width: 1366, height: 768 }]) {
  test(`draft save, update, new and reopen at ${viewport.width}px`, async ({ page }) => {
    await completeDraft(page, viewport)
    await expect(page.locator('.footer-actions .button')).toBeEnabled()
    await page.locator('.footer-actions .button').click()
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
      { key: 're_usetax', value: '5' }, { key: 're_freight', value: '0' },
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
    await expect(page.locator('#draft-province')).toHaveValue('test-state')
    await expect(page.locator('#draft-currency')).toHaveValue('USD')
    await expect(page.locator('.unsaved-badge')).toContainText('Draft saved')
    await checkLayout(page, viewport, 'reopened draft')
    await next(page)
    await expect(page.locator('.selected-card').first()).toContainText('Persisted equipment snapshot')
    await expect(page.locator('.selected-card').last()).toContainText('Persisted package snapshot')
    await next(page)
    await expect(page.locator('#request-re_usetax')).toHaveValue('5.00')
    await expect(page.locator('#request-re_freight')).toHaveValue('0.00')
    await expect(page.locator('#request-re_additionallaborhours')).toHaveValue('2.50')
  })
}

for (const width of [320, 1366]) {
  for (const entry of ['dashboard', 'sidebar']) {
    test(`new request clears the previous saved draft via ${entry} at ${width}px`, async ({ page }) => {
      await completeDraft(page, { width, height: 900 })
      await page.locator('.footer-actions .button').click()
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
      await next(page)
      await expect(page.locator('.selected-card')).toHaveCount(0)
      await page.locator('#equipment-search').fill('TEST')
      await page.locator('.result-row button').click()
      await page.locator('#package-search').fill('PK')
      await page.locator('.result-row button').click()
      await next(page)
      await expect(page.locator('#request-re_usetax')).toHaveValue('')
      await expect(page.locator('#request-re_additionallaborhours')).toHaveValue('')
      await page.locator('#request-re_usetax').fill('5')
      await page.locator('#request-re_freight').fill('0')
      await next(page)
      await expect(page.locator('#request-re_sellprice')).toHaveValue('')
      await page.locator('#request-re_sellprice').fill('2000')
      await next(page)
      await expect(page.locator('#customer-name')).toHaveValue('')
      await expect(page.locator('#customer-email')).toHaveValue('')
      await page.locator('#customer-name').fill('New customer')
      await page.locator('.footer-actions .button').click()
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
  await page.locator('.footer-actions .button').click()
  await expect(page.locator('.draft-saved')).toBeVisible()
  await page.evaluate(() => {
    for (const field of window.__draftSaved.fields) {
      if (field.key === 're_additionallaborhours') field.value = '30.0000000000'
      if (field.key === 're_usetax') field.value = '25.1234567890'
    }
  })
  await page.locator('.draft-toolbar').getByRole('button', { name: 'Reload draft', exact: true }).click()
  await expect(page.locator('.unsaved-badge')).toContainText('Draft saved')
  await next(page)
  await next(page)
  const hours = page.locator('#request-re_additionallaborhours')
  const tax = page.locator('#request-re_usetax')
  await expect(hours).toHaveValue('30.00')
  await expect(tax).toHaveValue('25.12')
  await tax.focus()
  await expect(tax).toHaveValue('25.1234567890')
  await tax.blur()
  await expect(tax).toHaveValue('25.12')
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
  expect(fields).toContainEqual({ key: 're_usetax', value: '25.1234567890' })
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
  await page.locator('.footer-actions .button').click()
  await expect(page.locator('#customer-name')).toBeDisabled()
  await expect(page.locator('.draft-toolbar .primary')).toBeDisabled()
  await expect(page.locator('.draft-error')).toContainText('403')
  await expect(page.locator('#customer-name')).toHaveValue('Draft customer')
  expect(await page.evaluate(() => window.__draftCalls.length)).toBe(1)
  await page.evaluate(() => { window.__draftDelay = 0; window.__draftFailure = '' })
  await page.locator('.footer-actions .button').click()
  await expect(page.locator('.draft-saved')).toBeVisible()
  const calls = await page.evaluate(() => window.__draftCalls)
  expect(calls[0].id).toBe(calls[1].id)
})

test('uncertain create response recovers the same draft without duplicate creation', async ({ page }) => {
  await completeDraft(page)
  await page.evaluate(() => { window.__draftFailure = 'timeout-after-commit' })
  await page.locator('.footer-actions .button').click()
  await expect(page.locator('.draft-error')).toContainText('outcome unknown')
  await expect(page.locator('#customer-name')).toHaveValue('Draft customer')
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
  await page.locator('.footer-actions .button').click()
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
  await page.locator('.footer-actions .button').click()
  await expect(page.locator('.draft-saved')).toContainText('0000000042')
  await expect(page.getByRole('status').filter({ hasText: 'The draft is saved, but pricing is unavailable.' })).toBeVisible()
  await expect(page.locator('.draft-error')).toHaveCount(0)
  await expect(page.locator('.pricing-summary')).toContainText('Pricing is unavailable.')
  await expect(page.locator('.pricing-summary')).not.toContainText('$31,807.21')
})

for (const width of [320, 1366]) {
  test(`saved pricing summary shows server values, localization and stale state at ${width}px`, async ({ page }) => {
    await completeDraft(page, { width, height: 768 })
    const summary = page.locator('.pricing-summary')
    await expect(summary).toContainText('Save the draft to calculate pricing.')
    await page.locator('.footer-actions .button').click()
    await expect(summary).toContainText('$31,807.21')
    await expect(summary).toContainText('48.81%')
    await expect(summary).toContainText('-65,028.16%')
    await expect(summary).toContainText('-65,076.97 percentage points')
    await expect(summary).toContainText('Selling price is below cost.')
    await expect(page.locator('.draft-error')).toHaveCount(0)
    const reads = await page.evaluate(() => window.__pricingReads)
    expect(reads[0].options.select).toContain('re_actualcmii')
    expect(reads[0].options.select).not.toContain('re_customername')
    await page.locator('#customer-name').fill('Unsaved customer edit')
    await expect(summary).toContainText('Unsaved changes:')
    await expect(summary).toContainText('$31,807.21')
    await changeLanguageInSettings(page, 'fr')
    await expect(summary).toContainText('Résumé des prix et du CMII')
    await expect(summary).toContainText('Modifications non enregistrées')
    await expect(summary).toContainText(/48,81\s*%/)
    await checkLayout(page, { width, height: 768 }, 'saved French pricing summary')
    await page.locator('.form-footer > button').click()
    await expect(summary).toBeVisible()
    await expect(summary).toContainText('Résumé des prix et du CMII')
  })
}

test('pricing read failure does not claim save failure and can be retried', async ({ page }) => {
  await completeDraft(page)
  await page.evaluate(() => { window.__pricingError = 'Permission denied' })
  await page.locator('.footer-actions .button').click()
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
  await page.locator('.footer-actions .button').click()
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
  await expect(page.locator('.dashboard-stats strong')).toHaveText(['100', '20', '5', '-25.00%'])
  await expect(page.locator('.request-record')).toHaveCount(1)
  await expect(metrics.getByRole('meter')).toHaveCount(5)
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
  await expect(metrics).toContainText('No estimates for this period and market.')
  await expect(metrics.locator('.dashboard-stats strong')).toHaveText(['0', '0', '0', '—'])
  await page.locator('.market-control select').selectOption('126110000')
  await expect(metrics).toContainText('125 estimates')
  await changeLanguageInSettings(page, 'fr')
  await expect(metrics).toContainText('CMII réel moyen')
  await expect(metrics).toContainText('Equipment repair')
  await checkLayout(page, { width: 320, height: 768 }, 'French live dashboard')
  const calls = await page.evaluate(() => window.__dashboardCalls)
  expect(calls.every((c) => c.owner === '11111111-1111-1111-1111-111111111111')).toBe(true)
})

for (const theme of ['light', 'dark']) {
  test(`compact recent requests cap at five without changing full request controls: ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: theme === 'dark' ? 320 : 1440, height: 900 })
    await mockData(page, 'en', theme)
    await page.addInitScript(() => { window.__estimateRecordCount = 6 })
    await page.goto('/')
    await expect(page.locator('.recent-card .request-record')).toHaveCount(5)
    await expect(page.locator('.recent-card .request-filters')).toHaveCount(0)
    await expect(page.locator('.recent-card .request-pagination')).toHaveCount(0)
    await expect(page.locator('.user-avatar')).toHaveCSS('background-color', 'rgb(20, 80, 245)')
    const refresh = await page.getByRole('button', { name: 'Refresh', exact: true }).boundingBox()
    expect(refresh.height).toBeGreaterThanOrEqual(44)
    await checkLayout(page, page.viewportSize(), 'compact recent requests')
    await page.getByRole('button', { name: /View requests/ }).click()
    await expect(page.locator('.request-record')).toHaveCount(6)
    await expect(page.locator('.request-filters select')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled()
  })
}

test('mockup dashboard charts retain exact totals and accessible legends', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await mockData(page, 'en', 'light')
  await page.goto('/')
  await expect(page.locator('.donut-total strong')).toHaveText('125')
  await expect(page.locator('.status-legend strong')).toHaveText(['100', '20', '5'])
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
  expect(arcs).toEqual([80, 16, 4])
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
      search: 'Building', status: '126110000', market: 126110000,
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
  await expect(page.locator('#customer-name')).toBeVisible()
  await expect(page.locator('.stepper')).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await search.press('Enter')
  await expect(page.locator('.stepper')).toHaveCount(0)
  await expect(page.locator('.request-record')).toHaveCount(1)
})

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
    mode: 'dashboard', ownerId: 'user', market: 126110000, year: 2026,
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
