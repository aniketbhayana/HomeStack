import { chromium } from 'playwright'
import { normalizeProperty } from '../normalizer/normalize'
import { NormalizedProperty } from '../session/sessionStore'

export async function searchNoBroker(query: string): Promise<NormalizedProperty[]> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  })

  const page = await context.newPage()
  const results: NormalizedProperty[] = []

  try {
    const searchUrl = `https://www.nobroker.in/property/sale/bangalore/?searchParam=${encodeURIComponent(query)}`
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForSelector('.top-area-data', { timeout: 10000 }).catch(() => {})

    const rawListings = await page.evaluate(() => {
      const cards = document.querySelectorAll('.top-area-data')
      const extracted: any[] = []

      cards.forEach((card, i) => {
        if (i >= 5) return
        extracted.push({
          title: card.querySelector('.prop-heading')?.textContent?.trim() || '',
          price: card.querySelector('.price-sp')?.textContent?.trim() || '',
          area: card.querySelector('.prop-area')?.textContent?.trim() || '',
          locality: card.querySelector('.loc-name')?.textContent?.trim() || '',
          url: (card.closest('a') as HTMLAnchorElement)?.href || '',
          imageUrl: (card.querySelector('img') as HTMLImageElement)?.src || ''
        })
      })

      return extracted
    })

    for (const raw of rawListings) {
      results.push(normalizeProperty({ ...raw, city: 'Bengaluru' }, 'nobroker'))
    }

  } catch (err) {
    console.error('NoBroker scraper error:', err)
  } finally {
    await browser.close()
  }

  return results
}