import { chromium } from 'playwright'
import { normalizeProperty } from '../normalizer/normalize'
import { ExtractedProperty } from '../session/sessionStore'
import { SearchParams } from '../orchestrator/searchOrchestrator'

export async function search99Acres(
  params: SearchParams & { resolvedUrl?: string }
): Promise<ExtractedProperty[]> {
  const { query, city, bhk } = params
  console.log('[99acres] Launching browser...')

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
    // Target search results page — individual listing cards link to /detail/ pages
    const citySlug = city.toLowerCase().replace(/\s+/g, '-')
    const bedroomParam = bhk && bhk !== 'Any' ? `&bedroom=${bhk}` : ''
    const url = `https://www.99acres.com/search/property/buy/${citySlug}?searchQ=${encodeURIComponent(query)}${bedroomParam}`
    console.log('[99acres] Search URL:', url)

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(5000)

    const listings = await page.evaluate(() => {
      const results: Array<{ title: string; price: string; bhk: string; area: string; locality: string; url: string }> = []

      // 99acres search result cards — individual property tiles
      // Each tile has an anchor linking to /detail/... or a full property URL
      const cards = Array.from(document.querySelectorAll(
        '[class*="srpTuple__"], [class*="SrpTuple"], [class*="card__"], [data-tracking-id*="property"]'
      )).slice(0, 8)

      for (const card of cards) {
        // Find the detail link — 99acres uses /detail/ URLs for individual properties
        const linkEl = (
          card.querySelector('a[href*="/detail/"]') ||
          card.querySelector('a[href*="99acres.com"]') ||
          card.querySelector('a[href*="/property"]')
        ) as HTMLAnchorElement | null

        if (!linkEl) continue
        let href = linkEl.href || ''
        if (href && !href.startsWith('http')) href = `https://www.99acres.com${href}`
        if (!href || !href.includes('99acres.com')) continue

        // Title
        const titleEl = card.querySelector(
          '[class*="title"], [class*="Title"], [class*="heading"], h2, h3'
        )
        const title = titleEl?.textContent?.trim() || linkEl.textContent?.trim() || ''

        // Price
        const priceEl = card.querySelector(
          '[class*="price"], [class*="Price"], [class*="amount"]'
        )
        const price = priceEl?.textContent?.trim() || ''

        // BHK / area — look in summary/info sections
        let bhk = '', area = ''
        const infoEls = Array.from(card.querySelectorAll(
          '[class*="bedroom"], [class*="Bedroom"], [class*="bhk"], [class*="area"], [class*="size"]'
        ))
        for (const el of infoEls) {
          const text = el.textContent?.trim() || ''
          if (/BHK/i.test(text) && !bhk) bhk = text
          if (/sq\.?ft|sqft/i.test(text) && !area) area = text
        }

        // Try combined summary text
        const summaryEl = card.querySelector('[class*="summary"], [class*="config"]')
        if (summaryEl && !bhk) {
          const t = summaryEl.textContent || ''
          const bm = t.match(/(\d)\s*BHK/)
          if (bm) bhk = `${bm[1]} BHK`
          const am = t.match(/([\d,]+)\s*sq\.?ft/i)
          if (am) area = `${am[1]} sq.ft`
        }

        // Locality
        const localityEl = card.querySelector(
          '[class*="locality"], [class*="location"], [class*="address"]'
        )
        const locality = localityEl?.textContent?.trim() || ''

        results.push({ title: title || '99Acres Listing', price, bhk, area, locality, url: href })
      }

      // Fallback: collect all /detail/ links on the page
      if (results.length === 0) {
        const detailLinks = Array.from(
          document.querySelectorAll('a[href*="/detail/"]')
        ) as HTMLAnchorElement[]

        const seen = new Set<string>()
        for (const link of detailLinks.slice(0, 6)) {
          let href = link.href
          if (!href.startsWith('http')) href = `https://www.99acres.com${href}`
          if (seen.has(href)) continue
          seen.add(href)

          const parent = link.closest('[class*="card"], [class*="tuple"], li') || link.parentElement
          const priceEl = parent?.querySelector('[class*="price"]')
          results.push({
            title: link.textContent?.trim() || '99Acres Listing',
            price: priceEl?.textContent?.trim() || '',
            bhk: '', area: '', locality: '',
            url: href
          })
        }
      }

      return results
    })

    console.log(`[99acres] Extracted ${listings.length} listings`)

    for (const l of listings) {
      results.push(normalizeProperty({
        title: l.title,
        price: l.price,
        bhk: l.bhk,
        area: l.area,
        locality: l.locality,
        city,
        url: l.url
      }, '99acres'))
    }

  } catch (err) {
    console.error('[99acres] Error:', err)
  } finally {
    await browser.close()
  }

  return results
}