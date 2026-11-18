import { test, expect } from '@playwright/test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

for (const template of ['email.html', 'email.fr.html']) {
  for (const width of [320, 1366]) {
    test(`${template} review layout fits ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(pathToFileURL(resolve(template)).href)
      await page.evaluate(() => {
        const values = {
          EstimateNumber: '0000000069', CustomerName: 'Example customer',
          OpportunityName: 'Modernization project', SiteDescription: 'Example site location',
          ContactEmail: `${'long-contact-'.repeat(12)}@example.invalid`,
          TotalSellingPrice: '21,004.90', SuggestedSellingPrice: '21,004.90',
          TotalTrueCost: '7,330.48', CurrencyCode: 'CAD',
        }
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        const nodes = []
        while (walker.nextNode()) nodes.push(walker.currentNode)
        for (const node of nodes) {
          node.textContent = node.textContent.replace(/\{\{(\w+)\}\}/g,
            (_, key) => values[key] ?? 'Example value')
        }
      })
      const layout = await page.evaluate(() => {
        const [first, second] = document.querySelectorAll('.email-column')
        const content = document.querySelector('.email-content')
        return {
          viewport: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          contentWidth: content.getBoundingClientRect().width,
          headerColor: getComputedStyle(document.querySelector('td[bgcolor="#1450f5"]')).backgroundColor,
          sectionColor: getComputedStyle(document.querySelector('h2')).backgroundColor,
          priceColor: getComputedStyle(document.querySelector('td[bgcolor="#0c42d9"]')).backgroundColor,
          priceTextColor: getComputedStyle(document.querySelector('td[bgcolor="#0c42d9"] p')).color,
          summaryColors: [...document.querySelectorAll('.email-column > div')].slice(0, 4)
            .map(element => getComputedStyle(element).backgroundColor),
          priceAccent: getComputedStyle(document.querySelector('td[bgcolor="#0c42d9"]')).borderLeftColor,
          first: { x: first.getBoundingClientRect().x, y: first.getBoundingClientRect().y },
          second: { x: second.getBoundingClientRect().x, y: second.getBoundingClientRect().y },
          detailField: (() => {
            const label = [...document.querySelectorAll('td.email-column > span')]
              .find(element => element.nextElementSibling?.tagName === 'BR')
            const value = label?.parentElement.querySelector('strong')
            return label && value ? {
              labelY: label.getBoundingClientRect().top, valueY: value.getBoundingClientRect().top,
            } : null
          })(),
        }
      })
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport)
      expect(layout.headerColor).toBe('rgb(20, 80, 245)')
      expect(layout.sectionColor).toBe('rgb(231, 240, 255)')
      expect(layout.priceColor).toBe('rgb(12, 66, 217)')
      expect(layout.priceTextColor).toBe('rgb(255, 255, 255)')
      expect(layout.summaryColors).toEqual(['rgb(210, 245, 255)', 'rgb(243, 238, 230)',
        'rgb(170, 225, 200)', 'rgb(255, 205, 215)'])
      expect(layout.priceAccent).toBe('rgb(255, 225, 65)')
      expect(layout.detailField).not.toBeNull()
      expect(layout.detailField.valueY).toBeGreaterThan(layout.detailField.labelY)
      if (width > 600) {
        expect(layout.contentWidth).toBeGreaterThan(layout.viewport * 0.9)
        expect(layout.second.x).toBeGreaterThan(layout.first.x)
        expect(layout.second.y).toBe(layout.first.y)
      } else {
        expect(layout.second.y).toBeGreaterThan(layout.first.y)
        expect(Math.abs(layout.second.x - layout.first.x)).toBeLessThan(1)
      }
    })
  }
}
