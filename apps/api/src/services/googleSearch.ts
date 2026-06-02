import { getJson } from 'serpapi'

interface SearchResult {
  title: string
  url: string
  snippet: string
}

/** Returns the best URL from results — prefers listing-level pages over project/search pages */
function pickBestUrl(
  results: any[],
  listingPatterns: RegExp[],
  projectPatterns: RegExp[]
): SearchResult | null {
  if (!results || results.length === 0) return null

  // Score each result: 0 = listing, 1 = project, 2 = search
  function score(link: string): number {
    for (const pat of listingPatterns) if (pat.test(link)) return 0
    for (const pat of projectPatterns) if (pat.test(link)) return 1
    return 2
  }

  const ranked = [...results].sort((a, b) => score(a.link) - score(b.link))
  const top = ranked[0]
  return { title: top.title || '', url: top.link || '', snippet: top.snippet || '' }
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
      num: 5, // fetch more so we can rank them
      gl: 'in',
      hl: 'en',
    })

    const results = data.organic_results
    if (!results || results.length === 0) {
      console.log(`[serpapi] No results for ${site}`)
      return null
    }

    // Define listing / project patterns per portal
    const listingPatterns: Record<string, RegExp[]> = {
      'magicbricks.com': [
        /\/property\/residential-for-sale\//i,
        /pr\d{6,}\.html/i,
      ],
      '99acres.com': [
        /\/detail\//i,
        /[a-z0-9-]+-\d{6,}(\.html)?/i,
      ],
      'nobroker.in': [
        /\/property\/sale\/[^/]+\/[^/]+-nb\d+/i,
      ],
    }

    const projectPatterns: Record<string, RegExp[]> = {
      'magicbricks.com': [/\/projects\//i, /\/new-projects\//i],
      '99acres.com': [/\/project\//i, /\/new-project\//i],
      'nobroker.in': [/\/new-projects\//i, /\/project-details\//i],
    }

    const lPat = listingPatterns[site] || []
    const pPat = projectPatterns[site] || []

    const best = pickBestUrl(results, lPat, pPat)
    if (best) {
      console.log(`[serpapi] Best for ${site}: ${best.url}`)
    }
    return best

  } catch (err: any) {
    console.error(`[serpapi] Error for ${site}:`, err?.message || err)
    return null
  }
}

export async function findAllPortalUrls(
  query: string,
  city: string,
  bhk?: string
) {
  const bhkPart = bhk && bhk !== 'Any' ? `${bhk}BHK` : ''
  const listingQuery = `${query} ${bhkPart} apartment for sale ${city}`.trim()
  const projectQuery = `${query} ${city}`

  console.log(`[serpapi] Listing query: "${listingQuery}"`)
  console.log(`[serpapi] Project query: "${projectQuery}"`)

  const [magicbricks, acres99, nobroker] = await Promise.all([
    findProjectUrl(listingQuery, 'magicbricks.com'),
    findProjectUrl(listingQuery, '99acres.com'),
    findProjectUrl(projectQuery, 'nobroker.in'),
  ])

  console.log('[serpapi] Results:', {
    magicbricks: magicbricks?.url || 'not found',
    acres99: acres99?.url || 'not found',
    nobroker: nobroker?.url || 'not found',
  })

  return { magicbricks, acres99, nobroker }
}