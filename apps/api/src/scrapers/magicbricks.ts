import { chromium } from 'playwright'
import { normalizeProperty } from '../normalizer/normalize'
import { ExtractedProperty } from '../session/sessionStore'
import { SearchParams } from '../orchestrator/searchOrchestrator'

export async function searchMagicBricks(
  params: SearchParams & { resolvedUrl?: string }
): Promise<ExtractedProperty[]> {
  const { query, city, bhk } = params
  console.log('[magicbricks] Launching browser...')

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { 'Accept-Language': 'en-IN,en;q=0.9' }
  })

  const page = await context.newPage()
  const results: ExtractedProperty[] = []

  try {
    // Always use search results page — individual cards link to real /propertyDetails/ URLs
    const bedroomParam = bhk && bhk !== 'Any' ? `&bedroom=${bhk}` : ''
    const url = `https://www.magicbricks.com/property-for-sale/residential-real-estate?cityName=${encodeURIComponent(city)}&textsearch=${encodeURIComponent(query)}${bedroomParam}`
    console.log('[magicbricks] Search URL:', url)

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(5000)

    const listings = await page.evaluate(() => {
      const results: Array<{ title: string; price: string; bhk: string; area: string; locality: string; url: string }> = []

      // MagicBricks search result cards — each card is .mb-srp__card
      const cards = Array.from(document.querySelectorAll('.mb-srp__card, [class*="mb-srp__card"]')).slice(0, 8)

      for (const card of cards) {
        // Title + detail URL — the card title link goes to /propertyDetails/
        const titleEl = card.querySelector('.mb-srp__card--title, [class*="mb-srp__card--title"]') as HTMLAnchorElement | null
        const linkEl = card.querySelector('a[href*="propertyDetails"], a[href*="magicbricks.com"]') as HTMLAnchorElement | null

        const title = titleEl?.textContent?.trim() || ''
        let href = linkEl?.href || (titleEl as HTMLAnchorElement)?.href || ''
        // Ensure absolute URL
        if (href && !href.startsWith('http')) href = `https://www.magicbricks.com${href}`

        // Price
        const priceEl = card.querySelector('.mb-srp__card--price__amount, [class*="card--price"]')
        const price = priceEl?.textContent?.trim() || ''

        // BHK / area from summary list items
        const summaryItems = Array.from(card.querySelectorAll('.mb-srp__card--summary__list-item, [class*="card--summary"]'))
        let bhk = ''
        let area = ''
        for (const item of summaryItems) {
          const text = item.textContent?.trim() || ''
          if (/BHK/i.test(text)) bhk = text
          if (/sq\.?ft|sqft/i.test(text)) area = text
        }

        // Locality
        const localityEl = card.querySelector('.mb-srp__card--locality, [class*="card--locality"], [class*="location"]')
        const locality = localityEl?.textContent?.trim() || ''

        if (title && href && href.includes('magicbricks.com')) {
          results.push({ title, price, bhk, area, locality, url: href })
        }
      }

      // Fallback: find any propertyDetails links on the page
      if (results.length === 0) {
        const detailLinks = Array.from(
          document.querySelectorAll('a[href*="propertyDetails"]')
        ) as HTMLAnchorElement[]

        for (const link of detailLinks.slice(0, 6)) {
          const parent = link.closest('[class*="card"], [class*="listing"], li, article') || link.parentElement
          const priceEl = parent?.querySelector('[class*="price"], [class*="Price"]')
          const title = link.textContent?.trim() || parent?.querySelector('[class*="title"]')?.textContent?.trim() || ''
          let href = link.href
          if (!href.startsWith('http')) href = `https://www.magicbricks.com${href}`

          if (href.includes('propertyDetails')) {
            results.push({
              title: title || 'MagicBricks Listing',
              price: priceEl?.textContent?.trim() || '',
              bhk: '', area: '', locality: '',
              url: href
            })
          }
        }
      }

      return results
    })

    console.log(`[magicbricks] Extracted ${listings.length} listings`)

    for (const l of listings) {
      results.push(normalizeProperty({
        title: l.title,
        price: l.price,
        bhk: l.bhk,
        area: l.area,
        locality: l.locality,
        city,
        url: l.url
      }, 'magicbricks'))
    }

  } catch (err) {
    console.error('[magicbricks] Error:', err)
  } finally {
    await browser.close()
  }

  return results
}