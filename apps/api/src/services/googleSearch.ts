import { getJson } from 'serpapi'

interface SearchResult {
  title: string
  url: string
  snippet: string
}

export async function findProjectUrl(
  query: string,
  site: string
): Promise<SearchResult | null> {
  const API_KEY = process.env.SERPAPI_KEY

  if (!API_KEY) {
    console.warn('[serpapi] Missing SERPAPI_KEY — skipping search')
    return null
  }

  try {
    const searchQuery = `${query} site:${site}`
    console.log(`[serpapi] Searching: "${searchQuery}"`)

    const data = await getJson({
      engine: 'google',
      q: searchQuery,
      api_key: API_KEY,
      num: 3,
      gl: 'in',
      hl: 'en',
    })

    const results = data.organic_results
    if (!results || results.length === 0) {
      console.log(`[serpapi] No results for ${site}`)
      return null
    }

    const top = results[0]
    console.log(`[serpapi] Found for ${site}: ${top.link}`)
    return {
      title: top.title || '',
      url: top.link || '',
      snippet: top.snippet || '',
    }
  } catch (err: any) {
    console.error(`[serpapi] Error for ${site}:`, err?.message || err)
    return null
  }
}

export async function findAllPortalUrls(query: string, city: string) {
  const fullQuery = `${query} ${city}`
  console.log(`[serpapi] Finding URLs for: "${fullQuery}"`)

  const [magicbricks, acres99, nobroker, housing] = await Promise.all([
    findProjectUrl(fullQuery, 'magicbricks.com'),
    findProjectUrl(fullQuery, '99acres.com'),
    findProjectUrl(fullQuery, 'nobroker.in'),
    findProjectUrl(fullQuery, 'housing.com'),
  ])

  console.log('[serpapi] Results:', {
    magicbricks: magicbricks?.url || 'not found',
    acres99: acres99?.url || 'not found',
    nobroker: nobroker?.url || 'not found',
    housing: housing?.url || 'not found',
  })

  return { magicbricks, acres99, nobroker, housing }
}