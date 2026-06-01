import { chromium } from 'playwright'
import { normalizeProperty } from '../normalizer/normalize'
import { NormalizedProperty } from '../session/sessionStore'
import { SearchParams } from '../orchestrator/searchOrchestrator'

export async function searchNoBroker(
  params: SearchParams & { resolvedUrl?: string }
): Promise<NormalizedProperty[]> {
  const { query, city, resolvedUrl } = params
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
  const results: NormalizedProperty[] = []

  try {
    const url = resolvedUrl || `https://www.nobroker.in/property/sale/${city.toLowerCase()}/?searchParam=${encodeURIComponent(query)}`
    console.log('[nobroker] URL:', url)

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(5000)

    const data = await page.evaluate(() => {
      const projectTitle = document.title.split(' -')[0].split('|')[0].trim()

      const configs: Array<{ bhk: string; price: string; area: string; url: string }> = []
      const seen = new Set<string>()

      // Real selectors from DOM inspection:
      // "text-xl font-bold text-[#333333]" → price like "₹85 L"
      // "text-[#363636] text-base font-semibold" → "3, 4 BHK"
      // "text-lg font-semibold text-[#363636] w-[70%]" → listing title with BHK

      // Individual listings on project page
      const listingTitles = Array.from(document.querySelectorAll('[class*="text-lg"][class*="font-semibold"][class*="text-[#363636]"]'))
        .filter(el => el.textContent?.includes('BHK'))

      const listingPrices = Array.from(document.querySelectorAll('[class*="text-xl"][class*="font-bold"][class*="text-[#333333]"]'))

      const count = Math.min(listingTitles.length, listingPrices.length, 5)

      for (let i = 0; i < count; i++) {
        const titleText = listingTitles[i]?.textContent?.trim() || ''
        const priceText = listingPrices[i]?.textContent?.trim() || ''
        const bhkMatch = titleText.match(/(\d)\s*BHK/)
        const key = `${titleText}-${priceText}`

        if (!seen.has(key)) {
          seen.add(key)
          const anchor = listingTitles[i]?.closest('a') as HTMLAnchorElement
          configs.push({
            bhk: bhkMatch ? bhkMatch[1] : '',
            price: priceText,
            area: '',
            url: anchor?.href || window.location.href
          })
        }
      }

      // Fallback: get project-level BHK config
      if (configs.length === 0) {
        const projectBhk = document.querySelector('[class*="text-[#363636]"][class*="font-semibold"][class*="w-full"]')
        const projectPrice = document.querySelector('[class*="text-xl"][class*="font-bold"]')

        if (projectBhk || projectPrice) {
          configs.push({
            bhk: projectBhk?.textContent?.trim().match(/(\d)/)?.[1] || '',
            price: projectPrice?.textContent?.trim() || '',
            area: '',
            url: window.location.href
          })
        }
      }

      const locality = document.querySelector('[class*="text-[13px]"][class*="text-gray"]')
        ?.textContent?.trim() || ''

      return { projectTitle, configs, locality }
    })

    console.log(`[nobroker] Project: ${data.projectTitle}, Configs: ${data.configs.length}`)

    for (const config of data.configs) {
      results.push(normalizeProperty({
        title: `${data.projectTitle}${config.bhk ? ` — ${config.bhk} BHK` : ''}`,
        price: config.price,
        area: config.area,
        locality: data.locality,
        city,
        url: config.url
      }, 'nobroker'))
    }

    if (results.length === 0) {
      results.push(normalizeProperty({
        title: data.projectTitle,
        price: '',
        area: '',
        locality: data.locality,
        city,
        url: resolvedUrl || ''
      }, 'nobroker'))
    }

  } catch (err) {
    console.error('[nobroker] Error:', err)
  } finally {
    await browser.close()
  }

  return results
}