import { getJson } from 'serpapi'
import { PropertyReviews, ReviewMetric } from '../session/sessionStore'

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

const CON_KEYWORDS = {
  'traffic issues':
    'traffic|congestion|jam|road|approach road',

  'maintenance issues':
    'maintenance|dirty|unclean|garbage|stink',

  'water issues':
    'water problem|water shortage|tanker',

  'high cost':
    'expensive|overpriced|high rent|costly',

  'noise issues':
    'noise|noisy|loud',

  'construction delays':
    'delay|delayed|possession',

  'parking issues':
    'parking problem|no parking|insufficient parking',

  'security concerns':
    'unsafe|security issue|theft',

    'deposit issues':
'deposit|refund|owner|greedy',

'lake smell':
'smell|odour|odor|sewage|lake',

'high rent':
'rent may range|high rent|expensive rent',

'poor roads':
'approach road|bad road'
}

function countMentions(
  text: string,
  bucket: Record<string, string>,
  type: 'pro' | 'con'
): ReviewMetric[] {
  const lower = text.toLowerCase()
  const metrics: ReviewMetric[] = []

  for (const [label, pattern] of Object.entries(bucket)) {
    const regex = new RegExp(`\\b(${pattern})\\b`, 'gi')
    const matches = lower.match(regex)

    if (matches && matches.length > 0) {
      metrics.push({
        label,
        mentions: matches.length,
        type,
      })
    }
  }

  return metrics.sort((a, b) => b.mentions - a.mentions)
}

async function fetchGoogleReviews(placeId: string) {
  return getJson({
    engine: 'google_maps_reviews',
    place_id: placeId,
    api_key: process.env.SERPAPI_KEY,
    hl: 'en',
  })
}

export async function fetchPropertyReviews(
  query: string,
  city: string
): Promise<PropertyReviews> {
  const empty: PropertyReviews = {
    projectName: query,
    rating: null,
    reviewCount: null,
    pros: [],
    cons: [],
    reviewsUrl: `https://www.google.com/search?q=${encodeURIComponent(
      `${query} apartment complex ${city}`
    )}`,
  }

  const API_KEY = process.env.SERPAPI_KEY

  if (!API_KEY) {
    console.warn('[reviews] Missing SERPAPI_KEY')
    return empty
  }

  try {
    const searchQueries = [
      `${query} reviews ${city}`,
      `${query} apartment complex ${city}`,
      `${query} google reviews`,
    ]

    let searchData: any = null

    for (const q of searchQueries) {
      console.log(`[reviews] Trying: "${q}"`)

      const result = await getJson({
        engine: 'google',
        q,
        api_key: API_KEY,
        hl: 'en',
        gl: 'in',
      })

      if (result.knowledge_graph) {
        searchData = result

        console.log(
          `[reviews] Knowledge Graph found for: "${q}"`
        )

        break
      }
    }

    if (!searchData) {
      console.log('[reviews] No Knowledge Graph found')
      return empty
    }

    const kp = searchData.knowledge_graph

    console.log(
      '[reviews] FULL KG:',
      JSON.stringify(kp, null, 2)
    )

    const rating =
      kp.rating != null
        ? parseFloat(String(kp.rating))
        : null

    const reviewCount =
      kp.review_count != null
        ? parseInt(
            String(kp.review_count).replace(/,/g, ''),
            10
          )
        : null

    const reviewsUrl =
      kp.reviews ||
      kp.reviews_link ||
      empty.reviewsUrl

    const placeId: string | undefined =
      kp.place_id

    let allReviewText = ''
          let reviewData: any = null
    if (placeId) {
      console.log(
        `[reviews] Fetching Google reviews for placeId: ${placeId}`
      )

      reviewData = await fetchGoogleReviews(
        placeId
      )

      console.log(
  '[reviews] reviewData keys:',
  Object.keys(reviewData)
)
console.log(
  JSON.stringify(reviewData, null, 2)
)

      const reviews = reviewData.reviews || []

      console.log(
        `[reviews] Retrieved ${reviews.length} review snippets`
      )

      allReviewText = reviews
        .map((r: any) => r.snippet || '')
        .join(' ')
    }

    // Fallback
    if (!allReviewText) {
      const organic =
        searchData.organic_results || []

      for (const link of organic) {
        const u = link.link || ''

        if (
          u.includes('nobroker.in') ||
          u.includes('magicbricks.com') ||
          u.includes('google.com/maps')
        ) {
          allReviewText +=
            ' ' + (link.snippet || '')
        }
      }
    }

    const pros = countMentions(
      allReviewText,
      PRO_KEYWORDS,
      'pro'
    )

    const cons = countMentions(
      allReviewText,
      CON_KEYWORDS,
      'con'
    )


    console.log(
      '[reviews] Pros:',
      pros.map(
        p => `${p.label} (${p.mentions})`
      )
    )

    console.log(
      '[reviews] Cons:',
      cons.map(
        c => `${c.label} (${c.mentions})`
      )
    )

    const topics =
  (reviewData.topics || []).map((t: any) => ({
    keyword: t.keyword,
    mentions: t.mentions,
  }))

    return {
      projectName: query,
      placeId,
      rating,
      reviewCount,
      pros: pros.slice(0, 5),
      cons: cons.slice(0, 5),
      reviewsUrl,
      topics,
    }
  } catch (err: any) {
    console.error(
      '[reviews] Error:',
      err?.message || err
    )

    return empty
  }
}