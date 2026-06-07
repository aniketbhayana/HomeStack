import { ExtractedProperty, NormalizedProperty } from '../session/sessionStore'

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
    const seenUrls = new Set<string>()

    for (const prop of valids) {
        if (!prop.url || seenUrls.has(prop.url)) continue
        seenUrls.add(prop.url)

        const bhkMatch = prop.bhk.match(/(\d+)/)
        const bhkNum = bhkMatch ? parseInt(bhkMatch[1], 10) : null

        canonicals.push({
            id: prop.id,
            source: prop.source,
            title: prop.title,
            price: prop.price,
            priceDisplay: prop.priceDisplay,
            bhk: bhkNum,
            areaSqft: prop.areaSqft,
            locality: prop.locality,
            city: prop.city,
            url: prop.url,
            urlType: prop.urlType,
            amenities: []
        })
    }

    return canonicals
}
