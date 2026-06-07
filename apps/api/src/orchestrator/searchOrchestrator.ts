import { sessionStore } from '../session/sessionStore'
import { searchMagicBricks } from '../scrapers/magicbricks'
import { search99Acres } from '../scrapers/99acres'
import { searchNoBroker } from '../scrapers/nobroker'
import { fetchPropertyReviews } from '../scrapers/reviews'
import { validateProperty } from '../normalizer/validate'
import { deduplicateListings } from '../normalizer/dedupe'
import { rankListings } from '../normalizer/rank'
import { findAllPortalUrls } from '../services/googleSearch'
export interface SearchParams {
  query: string
  city: string
  bhk?: string
  intent?: 'buy' | 'rent'
}

export async function runSearchJob(sessionId: string, params: SearchParams) {
  try {
    await sessionStore.updateStatus(sessionId, 'running')
    console.log(`[orchestrator] Session ${sessionId} started for`, params)

    // PHASE 2: Query Expansion
    // Run exact match + broad match queries in parallel to increase recall
    const baseQuery = `${params.query} ${params.city}`
    const broadQuery = params.query.replace(/[\d\.]+\s*(cr|lacs?|l)/i, '').replace(/\b(?:under|max|near|in)\b/gi, '').trim()

    // 1. Run Scrapers concurrently 
    console.log(`[orchestrator] Launching parallel scrapers...`)

    const scraperPromises = [
      searchMagicBricks({ ...params }),
      search99Acres({ ...params }),
      searchNoBroker({ ...params }),
    ]

    if (broadQuery && broadQuery !== params.query) {
      console.log(`[orchestrator] Launching expansion query: ${broadQuery}`)
      scraperPromises.push(searchMagicBricks({ query: broadQuery, city: params.city, bhk: 'Any' }))
      scraperPromises.push(search99Acres({ query: broadQuery, city: params.city, bhk: 'Any' }))
    }

    const [reviewsResult, ...scraperResults] = await Promise.allSettled([
      fetchPropertyReviews(params.query, params.city),
      ...scraperPromises
    ])

    // Handle extraction
    let allExtracted: any[] = []

    for (const res of scraperResults) {
      if (res.status === 'fulfilled' && res.value) {
        allExtracted = allExtracted.concat(res.value)
      }
    }

    console.log(`[orchestrator] Extracted total ${allExtracted.length} unvalidated results`)

    // Pipeline
    // 1. Validate
    const validated = allExtracted.map(p => validateProperty(p))

    // 2. Deduplicate into Canonical Format
    const canonicals = deduplicateListings(validated)

    // 3. Rank Canonical Items
    const ranked = rankListings(params.query, params.city, canonicals)

    // Append to Session 
    await sessionStore.appendResults(sessionId, ranked)

    if (reviewsResult.status === 'fulfilled' && reviewsResult.value) {
      await sessionStore.setReviews(sessionId, reviewsResult.value)
       console.log('[reviews] saved to session')
    }
    
    await sessionStore.updateStatus(sessionId, 'complete')
    console.log(`[orchestrator] Session ${sessionId} complete. Saved ${ranked.length} canonical results.`)

  } catch (err: any) {
    console.error(`[orchestrator] Session ${sessionId} failed:`, err)
    await sessionStore.setError(sessionId, err.message)
  }
}

// Aliases for backward-compat with search.ts route
export const runSearch = runSearchJob

/**
 * Returns direct portal search URLs for immediate display on the frontend.
 * Called before scrapers run so user can open tabs immediately.
 */

export async function getSearchUrls(
  params: SearchParams
): Promise<Record<string, string>> {

  const results = await findAllPortalUrls(
    params.query,
    params.city
  )

  return {
    magicbricks: results.magicbricks?.url || '',
    acres99: results.acres99?.url || '',
    nobroker: results.nobroker?.url || '',
    maps: `https://www.google.com/maps/search/${encodeURIComponent(`${params.query} ${params.city}`)}`,
  }
}