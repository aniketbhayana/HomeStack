import { getJson } from 'serpapi'
import { PropertyReviews, ReviewMetric } from '../session/sessionStore'

// Keyword buckets for simple sentiment classification
const PRO_KEYWORDS: Record<string, string> = {
    'good connectivity': 'connectivity|metro|highway|road|transport|commute',
    'spacious rooms': 'spacious|big rooms|large rooms|well-spaced',
    'premium amenities': 'amenities|clubhouse|gym|pool|swimming|garden|park',
    'reputed builder': 'reputed|trusted|quality|sobha|prestige|brigade|godrej|tata',
    'great views': 'views|view|greenery|lake|hill|garden view',
    'good security': 'security|cctv|guard|gated|safe|safety',
    'peaceful locality': 'peaceful|quiet|serene|calm|green|nature',
    'good investment': 'investment|appreciation|returns|value|resale',
    'good maintenance': 'maintenance|well maintained|clean|neat|tidy',
    'ample parking': 'parking|car park|two-wheeler',
}

const CON_KEYWORDS: Record<string, string> = {
    'possession delays': 'delay|delayed|late delivery|overdue|pending possession',
    'maintenance issues': 'poor maintenance|poorly maintained|dirty|garbage|stink|unclean',
    'traffic congestion': 'traffic|congestion|jammed|jam|signal',
    'parking issues': 'no parking|insufficient parking|parking problem',
    'water shortage': 'water problem|water issue|tanker|no water',
    'expensive': 'expensive|overpriced|costly|high price',
    'small rooms': 'small rooms|tiny|cramped|compact',
    'noisy': 'noisy|loud|too much noise',
    'poor lift service': 'lift problem|lift breaks|elevator issue',
    'power cuts': 'power cut|power failure|outage|no electricity',
}

function countMentions(text: string, bucket: Record<string, string>, type: 'pro' | 'con'): ReviewMetric[] {
    const lower = text.toLowerCase()
    const metrics: ReviewMetric[] = []

    for (const [label, pattern] of Object.entries(bucket)) {
        const regex = new RegExp(`\\b(${pattern})\\b`, 'gi')
        const matches = text.match(regex)
        if (matches && matches.length > 0) {
            metrics.push({ label, mentions: matches.length, type })
        }
    }

    // Sort descending by mentions
    return metrics.sort((a, b) => b.mentions - a.mentions)
}

export async function fetchPropertyReviews(
    query: string,
    city: string
): Promise<PropertyReviews> {
    const empty: PropertyReviews = {
        rating: null,
        reviewCount: null,
        pros: [],
        cons: [],
        reviewsUrl: `https://www.google.com/search?q=${encodeURIComponent(`${query} apartment complex ${city}`)}`
    }

    const API_KEY = process.env.SERPAPI_KEY
    if (!API_KEY) {
        console.warn('[reviews] Missing SERPAPI_KEY')
        return empty
    }

    try {
        // Add `apartment complex` to geofence Google Entity mapping and avoid builder corporate offices
        const searchQuery = `${query} apartment complex ${city}`
        console.log(`[reviews] Fetching Google Knowledge Graph for: "${searchQuery}"`)

        // Use standard Google search to get the knowledge graph card on the right hand side
        const searchData = await getJson({
            engine: 'google',
            q: searchQuery,
            api_key: API_KEY,
            hl: 'en',
            gl: 'in',
        })

        const kp = searchData.knowledge_graph
        if (!kp) {
            console.log('[reviews] No Knowledge Graph found (no right-hand card)')
            return empty
        }

        const rating: number | null = kp.rating ? parseFloat(kp.rating) : null
        const reviewCount: number | null = kp.review_count ? parseInt(String(kp.review_count).replace(/,/g, '')) : null
        const reviewsUrl: string = kp.reviews_link || empty.reviewsUrl

        // Sometimes the knowledge graph includes user reviews directly
        const userReviews = kp.user_reviews || []
        let allReviewText = userReviews.map((r: any) => r.snippet || r.summary || '').join(' ')

        // Also look at organic results snippets for NoBroker / MagicBricks / Google Maps reviews
        const organic = searchData.organic_results || []
        for (const link of organic) {
            const u = link.link || ''
            if (u.includes('nobroker.in') || u.includes('magicbricks.com') || u.includes('google.com/maps')) {
                allReviewText += ' ' + (link.snippet || '')
            }
        }

        const pros = countMentions(allReviewText, PRO_KEYWORDS, 'pro')
        const cons = countMentions(allReviewText, CON_KEYWORDS, 'con')

        return {
            placeId: kp.kgmid || undefined,
            rating,
            reviewCount,
            pros: pros.slice(0, 5),
            cons: cons.slice(0, 5),
            reviewsUrl,
        }

    } catch (err: any) {
        console.error('[reviews] Error:', err?.message || err)
        return empty
    }
}
