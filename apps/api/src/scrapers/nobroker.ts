import { getJson } from 'serpapi'
import { normalizeProperty } from '../normalizer/normalize'
import { ExtractedProperty } from '../session/sessionStore'
import { SearchParams } from '../orchestrator/searchOrchestrator'

const LISTING_PATTERNS = [
  /\/property\/sale\/[^/]+\/[^/]+-nb\d+/i,
]
const PROJECT_PATTERNS = [/\/new-projects\//i, /\/project-details\//i]

function scoreUrl(url: string): number {
  for (const p of LISTING_PATTERNS) if (p.test(url)) return 0
  for (const p of PROJECT_PATTERNS) if (p.test(url)) return 1
  // /property/sale/ with 4+ path segments is still a listing-ish  
  if (/\/property\/sale\//i.test(url) && (url.split('/').length >= 6)) return 0
  return 2
}

export async function searchNoBroker(
  params: SearchParams & { resolvedUrl?: string }
): Promise<ExtractedProperty[]> {
  const { query, city, bhk } = params
  const API_KEY = process.env.SERPAPI_KEY

  if (!API_KEY) {
    console.warn('[nobroker] Missing SERPAPI_KEY — skipping')
    return []
  }

  const bhkPart = bhk && bhk !== 'Any' ? `${bhk} BHK` : ''
  const action = params.intent === 'rent' ? 'property for rent' : 'property for sale'
  const searchQuery = `${query} ${action} ${city} site:nobroker.in`.trim()
  console.log('[nobroker] SerpAPI query:', searchQuery)

  try {
    const data = await getJson({
      engine: 'google',
      q: searchQuery,
      api_key: API_KEY,
      num: 8,
      gl: 'in',
      hl: 'en',
    })

    const organic: any[] = data.organic_results || []
    const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)

    if (organic.length === 0) {
      console.log('[nobroker] No SerpAPI results')
      return []
    }

    const sorted = [...organic].sort((a, b) => scoreUrl(a.link) - scoreUrl(b.link))

    // Filter obvious false positives
    const filtered = sorted.filter(r => {
      const textToSearch = ((r.title || '') + ' ' + (r.snippet || '')).toLowerCase()
      const matchedTokens = queryTokens.filter(token => textToSearch.includes(token)).length
      return matchedTokens >= Math.ceil(queryTokens.length * 0.8) // high accuracy threshold
    })

    console.log(`[nobroker] ${sorted.length} results -> ${filtered.length} after token filtering`)

    const results: ExtractedProperty[] = filtered.map(r => {
      const titleBhkMatch = (r.title || '').match(/(\d)\s*BHK/i)
      const titleBhk = titleBhkMatch ? `${titleBhkMatch[1]} BHK` : (bhkPart || '')

      const snippetPriceMatch = (r.snippet || '').match(/[₹]?\s*([\d.]+)\s*(Cr|Lac|L)\b/i)
      const priceDisplay = snippetPriceMatch
        ? `₹${snippetPriceMatch[1]} ${snippetPriceMatch[2]}`
        : ''

      const areaMatch = (r.snippet || '').match(/([\d,]+)\s*sq\.?\s*ft/i)
      const areaDisplay = areaMatch ? `${areaMatch[1]} sq.ft` : ''

      return normalizeProperty({
        title: r.title || 'NoBroker Listing',
        price: priceDisplay,
        bhk: titleBhk,
        area: areaDisplay,
        locality: city,
        city,
        url: r.link || '',
      }, 'nobroker')
    })

    console.log(`[nobroker] Returning ${results.length} results`)
    return results

  } catch (err: any) {
    console.error('[nobroker] SerpAPI error:', err?.message || err)
    return []
  }
}