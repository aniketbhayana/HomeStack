import { sessionStore } from '../session/sessionStore'
import { searchMagicBricks } from '../scrapers/magicbricks'
import { searchNoBroker } from '../scrapers/nobroker'
import { findAllPortalUrls } from '../services/googleSearch'
import { search99Acres } from '../scrapers/99acres'

export interface SearchParams {
  query: string
  city: string
  bhk?: string
}

// Fallback URLs if Google search fails
function getFallbackUrls(params: SearchParams) {
  const { query, city, bhk } = params
  const encoded = encodeURIComponent(query)
  const cityLower = city.toLowerCase()
  const bhkParam = bhk ? `&bedroom=${bhk}` : ''

  return {
    magicbricks: `https://www.magicbricks.com/property-for-sale/residential-real-estate?cityName=${city}&textsearch=${encoded}${bhkParam}`,
    acres99: `https://www.99acres.com/search/property/buy/${cityLower}?searchQ=${encoded}`,
    nobroker: `https://www.nobroker.in/property/sale/${cityLower}/?searchParam=${encoded}`,
    housing: `https://housing.com/in/buy/${cityLower}?q=${encoded}`,
    maps: `https://www.google.com/maps/search/${encoded}+${encodeURIComponent(city)}`,
  }
}

export async function getSearchUrls(params: SearchParams) {
  const { query, city } = params

  console.log('[orchestrator] Finding portal URLs via Google...')
  const portalResults = await findAllPortalUrls(query, city)
  const fallbacks = getFallbackUrls(params)

  // Use Google-found URL if available, fall back to generic search URL
  return {
    magicbricks: portalResults.magicbricks?.url || fallbacks.magicbricks,
    acres99: portalResults.acres99?.url || fallbacks.acres99,
    nobroker: portalResults.nobroker?.url || fallbacks.nobroker,
    housing: portalResults.housing?.url || fallbacks.housing,
    maps: fallbacks.maps,
  }
}

export async function runSearch(sessionId: string, params: SearchParams): Promise<void> {
  console.log(`[orchestrator] Starting: "${params.query}" ${params.city} ${params.bhk || 'any BHK'}`)

  try {
    await sessionStore.updateStatus(sessionId, 'running')

    // Get real portal URLs from Google first
    const { query, city } = params
    const portalResults = await findAllPortalUrls(query, city)

    // Use discovered URLs for scraping, fall back to generic if not found
    const fallbacks = getFallbackUrls(params)
    const mbUrl = portalResults.magicbricks?.url || fallbacks.magicbricks
    const nbUrl = portalResults.nobroker?.url || fallbacks.nobroker

    console.log('[orchestrator] MagicBricks URL:', mbUrl)
    console.log('[orchestrator] NoBroker URL:', nbUrl)

    const scraperJobs = [
      searchMagicBricks({ ...params, resolvedUrl: mbUrl })
        .then(async results => {
          console.log(`[magicbricks] Got ${results.length} results`)
          if (results.length > 0) await sessionStore.appendResults(sessionId, results)
        })
        .catch(err => console.error('[magicbricks] Failed:', err.message)),

      searchNoBroker({ ...params, resolvedUrl: nbUrl })
        .then(async results => {
          console.log(`[nobroker] Got ${results.length} results`)
          if (results.length > 0) await sessionStore.appendResults(sessionId, results)
        })
        .catch(err => console.error('[nobroker] Failed:', err.message)),

        search99Acres({ ...params, resolvedUrl: portalResults.acres99?.url || fallbacks.acres99 })
  .then(async results => {
    console.log(`[99acres] Got ${results.length} results`)
    if (results.length > 0) await sessionStore.appendResults(sessionId, results)
  })
  .catch(err => console.error('[99acres] Failed:', err.message)),
    ]

    await Promise.allSettled(scraperJobs)
    console.log(`[orchestrator] Done — session: ${sessionId}`)
    await sessionStore.updateStatus(sessionId, 'complete')

  } catch (err) {
    console.error('[orchestrator] Fatal:', err)
    await sessionStore.setError(sessionId, String(err))
  }
}