import { getJson } from 'serpapi'
import { normalizeProperty } from '../normalizer/normalize'
import { ExtractedProperty } from '../session/sessionStore'
import { SearchParams } from '../orchestrator/searchOrchestrator'

const LISTING_PATTERNS = [
  /\/detail\//i,
  /[a-z0-9-]+-\d{6,}(\.html)?$/i,
]
const PROJECT_PATTERNS = [/\/project\//i, /\/new-project\//i, /\/projects\//i]

function scoreUrl(url: string): number {
  for (const p of LISTING_PATTERNS) if (p.test(url)) return 0
  for (const p of PROJECT_PATTERNS) if (p.test(url)) return 1
  return 2
}

export async function search99Acres(
  params: SearchParams & { resolvedUrl?: string }
): Promise<ExtractedProperty[]> {
  const { query, city, bhk } = params
  const API_KEY = process.env.SERPAPI_KEY

  if (!API_KEY) {
    console.warn('[99acres] Missing SERPAPI_KEY — skipping')
    return []
  }

  const bhkPart = bhk && bhk !== 'Any' ? `${bhk} BHK` : ''
  const action = params.intent === 'rent' ? 'flat for rent' : 'flat for sale'
  const searchQuery = `${query} ${action} ${city} site:99acres.com`.trim()
  console.log('[99acres] SerpAPI query:', searchQuery)

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
      console.log('[99acres] No SerpAPI results')
      return []
    }

    const sorted = [...organic].sort((a, b) => scoreUrl(a.link) - scoreUrl(b.link))

    // Filter obvious false positives
    const filtered = sorted.filter(r => {
      const textToSearch = ((r.title || '') + ' ' + (r.snippet || '')).toLowerCase()
      const matchedTokens = queryTokens.filter(token => textToSearch.includes(token)).length
      return matchedTokens >= Math.ceil(queryTokens.length * 0.8) // high accuracy threshold
    })

    console.log(`[99acres] ${sorted.length} results -> ${filtered.length} after token filtering`)

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
        title: r.title || '99Acres Listing',
        price: priceDisplay,
        bhk: titleBhk,
        area: areaDisplay,
        locality: city,
        city,
        url: r.link || '',
      }, '99acres')
    })

    console.log(`[99acres] Returning ${results.length} results`)
    return results

  } catch (err: any) {
    console.error('[99acres] SerpAPI error:', err?.message || err)
    return []
  }
}