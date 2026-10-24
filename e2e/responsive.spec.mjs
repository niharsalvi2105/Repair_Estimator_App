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
  await page.route('**/src/data/sessionRepository.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export async function loadSession() { return {
      displayName:'Responsive Test User', userId:'11111111-1111-1111-1111-111111111111',
      role:'admin', canReadEstimates:true, canStartEstimate:true, developmentAdminOverride:true
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
        re_market:126110000, _re_country_value:'test-country'
      }] }
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
        ${state === 'error' ? "throw new Error('Representative permission or connection failure for responsive testing.')" : ''}
        return {records:${state === 'empty' ? '[]' : `[{
          re_repairestimateid:'test-estimate',re_name:'RE-TEST-0001',
          re_estimatename:'Request with a long name / Demande avec un nom long',
          re_customername:'Customer / Client avec un long nom représentatif',
          re_buildingname:'Building / Immeuble avec un long nom représentatif',
          re_estimatestatus:126110000,createdon:'2026-01-01T12:00:00Z'
        }]`},skipToken:options.skipToken ? undefined : 'next-page'}
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
      headerTargetsAccessible: [...document.querySelectorAll('header select')].every((el) => {
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
      await expect(page.locator('#request-re_sellprice')).toHaveValue('1500')
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
