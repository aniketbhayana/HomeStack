import { chromium } from 'playwright'
import { normalizeProperty } from '../normalizer/normalize'
import { ExtractedProperty } from '../session/sessionStore'
import { SearchParams } from '../orchestrator/searchOrchestrator'

export async function searchNoBroker(
  params: SearchParams & { resolvedUrl?: string }
): Promise<ExtractedProperty[]> {
  const { query, city, bhk } = params
  console.log('[nobroker] Launching browser...')

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  })

  const page = await context.newPage()
  const results: ExtractedProperty[] = []

  try {
    // Target search results page directly
    const bedroomParam = bhk && bhk !== 'Any' ? `&bedroom=${bhk}` : ''
    const url = `https://www.nobroker.in/property/sale/${city.toLowerCase()}/?searchParam=${encodeURIComponent(query)}${bedroomParam}`
    console.log('[nobroker] Search URL:', url)

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(5000)

    const listings = await page.evaluate(() => {
      const results: Array<{ title: string; price: string; bhk: string; area: string; locality: string; url: string }> = []

      // NoBroker listing cards
      const cards = Array.from(document.querySelectorAll(
        '[class*="bg-white"][class*="rounded-md"][class*="shadow-default"], article, .prop-card'
      )).slice(0, 8)

      for (const card of cards) {
        // Individual listing links on NoBroker look like:
        // /property/sale/bangalore/sobha-carnation/some-slug-nb12345
        const linkEl = card.querySelector('a[href*="/property/sale/"]') as HTMLAnchorElement | null
        if (!linkEl) continue

        let href = linkEl.href || ''
        if (href && !href.startsWith('http')) href = `https://www.nobroker.in${href}`

        // Title
        const titleEl = card.querySelector('h2, [class*="font-semibold"][class*="text-[#363636]"]')
        const title = titleEl?.textContent?.trim() || linkEl.textContent?.trim() || ''

        // Price — "text-xl font-bold text-[#333333]" or similar
        const priceEls = Array.from(card.querySelectorAll('[class*="font-bold"], [class*="text-xl"]'))
        let price = ''
        for (const p of priceEls) {
          const t = p.textContent?.trim() || ''
          if (/₹|Lacs|Cr/i.test(t)) price = t
        }

        // BHK + Area
        let bhk = '', area = ''
        const textNodes = (card as HTMLElement).innerText.split('\n')
        for (const t of textNodes) {
          if (/BHK/i.test(t) && !bhk) bhk = t.trim()
          if (/sq\.?ft/i.test(t) && !area) area = t.trim()
        }

        // Locality
        const localityEl = card.querySelector('[class*="text-[13px]"][class*="text-gray"]')
        const locality = localityEl?.textContent?.trim() || ''

        if (href && href.includes('nobroker.in')) {
          results.push({ title: title || 'NoBroker Listing', price, bhk, area, locality, url: href })
        }
      }

      // Fallback
      if (results.length === 0) {
        const fallbacks = Array.from(document.querySelectorAll('a[href*="/property/sale/"]')) as HTMLAnchorElement[]
        const seen = new Set()
        for (const f of fallbacks.slice(0, 6)) {
          if (seen.has(f.href)) continue
          seen.add(f.href)
          let href = f.href
          if (!href.startsWith('http')) href = `https://www.nobroker.in${href}`
          results.push({
            title: f.textContent?.trim() || 'NoBroker Listing',
            price: '', bhk: '', area: '', locality: '',
            url: href
          })
        }
      }

      return results
    })

    console.log(`[nobroker] Extracted ${listings.length} listings`)

    for (const l of listings) {
      results.push(normalizeProperty({
        title: l.title,
        price: l.price,
        bhk: l.bhk,
        area: l.area,
        locality: l.locality,
        city,
        url: l.url
      }, 'nobroker'))
    }

  } catch (err) {
    console.error('[nobroker] Error:', err)
  } finally {
    await browser.close()
  }

  return results
}