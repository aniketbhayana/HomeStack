import { ExtractedProperty, NormalizedProperty, PropertySource } from '../session/sessionStore'

// Simple string similarity (Jaccard-like approach)
export function calculateStringSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0
    const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '')
    const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '')

    if (s1 === s2) return 1.0
    if (s1.includes(s2) || s2.includes(s1)) return 0.8 // high sub-match

    const pairs1 = getBigrams(s1)
    const pairs2 = getBigrams(s2)
    const union = pairs1.length + pairs2.length
    if (union === 0) return 0

    let hits = 0
    for (const x of pairs1) {
        for (let i = 0; i < pairs2.length; i++) {
            if (x === pairs2[i]) {
                hits++
                pairs2.splice(i, 1)
                break
            }
        }
    }
    return (2.0 * hits) / union
}

function getBigrams(str: string): string[] {
    const bigrams: string[] = []
    for (let i = 0; i < str.length - 1; i++) {
        bigrams.push(str.slice(i, i + 2))
    }
    return bigrams
}

export function deduplicateListings(extracted: ExtractedProperty[]): NormalizedProperty[] {
    // Only process valid listings/projects 
    const valids = extracted.filter(e => e.validationStatus !== 'rejected')

    const canonicals: NormalizedProperty[] = []

    for (const prop of valids) {
        let matched = false

        // Attempt to merge with an existing canonical property
        for (const c of canonicals) {
            if (isMatch(c, prop)) {
                mergeIntoCanonical(c, prop)
                matched = true
                break
            }
        }

        // If no match, create a new canonical property
        if (!matched) {
            canonicals.push(createCanonical(prop))
        }
    }

    // Set best prices for each canonical property
    for (const c of canonicals) {
        let minPrice: number | null = null
        let bestDisplay = 'Price on Request'
        for (const s of c.sources) {
            if (s.price !== null && (minPrice === null || s.price < minPrice)) {
                minPrice = s.price
                bestDisplay = s.priceDisplay
            }
        }
        c.bestPrice = minPrice
        c.bestPriceDisplay = bestDisplay
    }

    return canonicals
}

function isMatch(canonical: NormalizedProperty, prop: ExtractedProperty): boolean {
    // 1. Must be same BHK
    if (canonical.bhk !== prop.bhk) return false

    // 2. Must be highly similar title OR locality
    const titleSim = calculateStringSimilarity(canonical.title, prop.title)
    const locSim = calculateStringSimilarity(canonical.locality, prop.locality)
    if (titleSim < 0.6 && locSim < 0.6) return false

    // 3. Price delta must be within 6% (or one is completely missing price)
    if (canonical.bestPrice !== null && prop.price !== null) {
        const delta = Math.abs(canonical.bestPrice - prop.price)
        const pct = delta / canonical.bestPrice
        if (pct > 0.06) return false
    }

    return true
}

function createCanonical(prop: ExtractedProperty): NormalizedProperty {
    const sourceObj: PropertySource = {
        platform: prop.source,
        url: prop.url,
        urlType: prop.urlType,
        price: prop.price,
        priceDisplay: prop.priceDisplay
    }

    return {
        id: `C-${prop.id}`,
        title: prop.title,
        locality: prop.locality,
        city: prop.city,
        bhk: prop.bhk,
        areaSqft: prop.areaSqft,
        areaDisplay: prop.areaDisplay,
        sources: [sourceObj],
        bestPrice: prop.price,
        bestPriceDisplay: prop.priceDisplay,
        relevanceScore: 0,
        createdAt: prop.createdAt,
        updatedAt: new Date().toISOString()
    }
}

function mergeIntoCanonical(canonical: NormalizedProperty, prop: ExtractedProperty) {
    // if this platform is already tracked (e.g. 2 magicbricks links mapped to same property), skip or keep the better urlType
    const existingSourceIdx = canonical.sources.findIndex(s => s.platform === prop.source)

    const sourceObj: PropertySource = {
        platform: prop.source,
        url: prop.url,
        urlType: prop.urlType,
        price: prop.price,
        priceDisplay: prop.priceDisplay
    }

    if (existingSourceIdx >= 0) {
        // If the new one is a listing but old is project, swap them
        if (prop.urlType === 'listing' && canonical.sources[existingSourceIdx].urlType !== 'listing') {
            canonical.sources[existingSourceIdx] = sourceObj
        }
    } else {
        canonical.sources.push(sourceObj)
    }

    // Update canonical metadata if new one has better info
    if (!canonical.areaSqft && prop.areaSqft) {
        canonical.areaSqft = prop.areaSqft
        canonical.areaDisplay = prop.areaDisplay
    }
}
