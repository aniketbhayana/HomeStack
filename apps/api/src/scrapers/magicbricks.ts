import { chromium } from 'playwright'
import { normalizeProperty } from '../normalizer/normalize'
import { NormalizedProperty } from '../session/sessionStore'
import { SearchParams } from '../orchestrator/searchOrchestrator'

export async function searchMagicBricks(
  params: SearchParams & { resolvedUrl?: string }
): Promise<NormalizedProperty[]> {
  const { query, city, resolvedUrl } = params
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
  const results: NormalizedProperty[] = []

  try {
    const url = resolvedUrl || `https://www.magicbricks.com/property-for-sale/residential-real-estate?cityName=${city}&textsearch=${encodeURIComponent(query)}`
    console.log('[magicbricks] URL:', url)

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(4000)

    const data = await page.evaluate(() => {
      // Project page selectors — from real DOM inspection
      const projectTitle = document.title
        .replace(' in ', ' — ')
        .replace(': Price, Brochure, Floor Plan, Reviews', '')
        .trim()

      // Get BHK configs from project page
      const bhkCards = Array.from(document.querySelectorAll('.pdp__prop__card__bhk'))
      const configs: Array<{ bhk: string; area: string; price: string; url: string }> = []

      bhkCards.forEach((card: Element) => {
        const text = card.textContent?.trim() || ''
        // "3 BHK Flat 1300 sq.ft" pattern
        const bhkMatch = text.match(/(\d)\s*BHK/)
        const areaMatch = text.match(/([\d,]+)\s*sq\.?ft/i)

        // Find price near this card
        const parent = card.closest('[class*="pdp__prop"]') || card.parentElement
        const priceEl = parent?.querySelector('.rupees, [class*="price"], [class*="Price"]')
        const priceText = priceEl?.textContent?.trim() || ''

        // Find link
        const anchor = parent?.querySelector('a') as HTMLAnchorElement
        const href = anchor?.href || window.location.href

        if (bhkMatch) {
          configs.push({
            bhk: bhkMatch[1],
            area: areaMatch ? areaMatch[1].replace(',', '') : '',
            price: priceText,
            url: href
          })
        }
      })

      // Fallback: extract from page title + overview section
      if (configs.length === 0) {
        const overviewBhk = document.querySelector('.pdp__prop--bhk')
        const bhkText = overviewBhk?.textContent?.trim() || ''
        const bhkMatch = bhkText.match(/(\d)\s*BHK/)

        // Get price from overview
        const priceEls = Array.from(document.querySelectorAll('.rupees'))
        const prices = priceEls
          .map(el => el.parentElement?.textContent?.trim() || '')
          .filter(t => t.includes('Cr') || t.includes('L'))
          .slice(0, 3)

        if (bhkMatch || prices.length > 0) {
          configs.push({
            bhk: bhkMatch ? bhkMatch[1] : '',
            area: '',
            price: prices[0] || '',
            url: window.location.href
          })
        }
      }

      return {
        projectTitle,
        locality: document.querySelector('[class*="pdp__loc"]')?.textContent?.trim() || '',
        configs: configs.slice(0, 5)
      }
    })

    console.log(`[magicbricks] Project: ${data.projectTitle}, Configs: ${data.configs.length}`)

    // Create one result per BHK configuration
    if (data.configs.length > 0) {
      for (const config of data.configs) {
        results.push(normalizeProperty({
          title: `${data.projectTitle}${config.bhk ? ` — ${config.bhk} BHK` : ''}`,
          price: config.price,
          area: config.area ? `${config.area} sqft` : '',
          locality: data.locality,
          city,
          url: config.url || resolvedUrl || ''
        }, 'magicbricks'))
      }
    } else {
      // At minimum return the project itself
      results.push(normalizeProperty({
        title: data.projectTitle,
        price: '',
        area: '',
        locality: data.locality,
        city,
        url: resolvedUrl || ''
      }, 'magicbricks'))
    }

  } catch (err) {
    console.error('[magicbricks] Error:', err)
  } finally {
    await browser.close()
  }

  return results
}