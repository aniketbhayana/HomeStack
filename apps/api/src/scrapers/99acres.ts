import { chromium } from 'playwright'
import { normalizeProperty } from '../normalizer/normalize'
import { NormalizedProperty } from '../session/sessionStore'
import { SearchParams } from '../orchestrator/searchOrchestrator'

export async function search99Acres(
  params: SearchParams & { resolvedUrl?: string }
): Promise<NormalizedProperty[]> {
  const { query, city, resolvedUrl } = params
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
  const results: NormalizedProperty[] = []

  try {
    const url = resolvedUrl || `https://www.99acres.com/search/property/buy/${city.toLowerCase()}?searchQ=${encodeURIComponent(query)}`
    console.log('[99acres] URL:', url)

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(4000)

    const data = await page.evaluate(() => {
      const projectTitle = document.title.split(' -')[0].trim()
      const configs: Array<{ bhk: string; price: string; area: string; url: string }> = []

      // Real selectors from DOM inspection:
      // configurationCards__configurationCardsSubHeading → "3 BHK Apartment"
      // configurationCards__cardPriceHeading → "₹ 2.9 Cr"
      // configurationCards__configBandLabel → "3 BHK"

      const cards = Array.from(document.querySelectorAll('[class*="configurationCards__config"]'))
        .filter(el => !el.className.includes('Heading') && !el.className.includes('Label'))

      // Try config cards first
      const priceHeadings = Array.from(document.querySelectorAll('[class*="configurationCards__cardPriceHeading"]'))
      const bhkHeadings = Array.from(document.querySelectorAll('[class*="configurationCards__configurationCardsSubHeading"]'))

      const count = Math.min(priceHeadings.length, bhkHeadings.length, 5)

      for (let i = 0; i < count; i++) {
        const bhkText = bhkHeadings[i]?.textContent?.trim() || ''
        const priceText = priceHeadings[i]?.textContent?.trim() || ''
        const bhkMatch = bhkText.match(/(\d)\s*BHK/)

        configs.push({
          bhk: bhkMatch ? bhkMatch[1] : '',
          price: priceText,
          area: bhkText.replace(/\d+\s*BHK\s*/, '').trim(),
          url: window.location.href
        })
      }

      // Fallback: get from main price heading
      if (configs.length === 0) {
        const mainPrice = document.querySelector('[class*="configurationCards__configurationCardsHeading"]')
        const mainBhk = document.querySelector('[class*="configBandLabel"]')
        if (mainPrice || mainBhk) {
          configs.push({
            bhk: mainBhk?.textContent?.trim().match(/(\d)/)?.[1] || '',
            price: mainPrice?.textContent?.trim() || '',
            area: '',
            url: window.location.href
          })
        }
      }

      // Get locality from page
      const localityEl = document.querySelector('[class*="cd__txtPtC"]') 
        || document.querySelector('[class*="location"]')
      const locality = localityEl?.textContent?.trim().slice(0, 60) || ''

      return { projectTitle, configs, locality }
    })

    console.log(`[99acres] Project: ${data.projectTitle}, Configs: ${data.configs.length}`)

    for (const config of data.configs) {
      results.push(normalizeProperty({
        title: `${data.projectTitle}${config.bhk ? ` — ${config.bhk} BHK` : ''}`,
        price: config.price,
        area: config.area,
        locality: data.locality,
        city,
        url: config.url
      }, '99acres'))
    }

    if (results.length === 0) {
      results.push(normalizeProperty({
        title: data.projectTitle,
        price: '',
        area: '',
        locality: data.locality,
        city,
        url: resolvedUrl || ''
      }, '99acres'))
    }

  } catch (err) {
    console.error('[99acres] Error:', err)
  } finally {
    await browser.close()
  }

  return results
}