import { NormalizedProperty } from '../session/sessionStore'
import { calculateStringSimilarity } from './dedupe'

export function rankListings(query: string, city: string, canonicals: NormalizedProperty[]): NormalizedProperty[] {
    // Extract budget logic from query (naive implementation for Phase 5)
    // e.g. "under 2.5 cr", "50 lacs"
    let budgetTarget: number | null = null
    const budgetMatch = query.match(/(?:under|below|max)\s*([\d.]+)\s*(cr|lacs?|l)/i) || query.match(/([\d.]+)\s*(cr|lacs?|l)/i)
    if (budgetMatch) {
        const val = parseFloat(budgetMatch[1])
        if (budgetMatch[2].toLowerCase() === 'cr') budgetTarget = val * 10000000
        if (budgetMatch[2].toLowerCase().startsWith('l')) budgetTarget = val * 100000
    }

    // Parse out BHK goal
    let bhkTarget = ''
    const bMatch = query.match(/(\d)\s*bhk/i)
    if (bMatch) bhkTarget = `${bMatch[1]} BHK`

    const qName = query.toLowerCase()

    for (const c of canonicals) {
        let score = 0
        const explanations: string[] = []

        // 1. Exact Project Match / Name match
        const titleSim = calculateStringSimilarity(query, c.title)
        if (titleSim > 0.8) {
            score += 10
            explanations.push('Exact project match (+10)')
        } else if (titleSim > 0.4) {
            score += 3
            explanations.push('Partial title match (+3)')
        }

        // 2. Locality Match
        const locSim = calculateStringSimilarity(query, c.locality)
        if (locSim > 0.6 || qName.includes(c.locality.toLowerCase())) {
            score += 3
            explanations.push('Locality match (+3)')
        }

        // 3. BHK Match
        if (bhkTarget && c.bhk === bhkTarget) {
            score += 5
            explanations.push('BHK match (+5)')
        }

        // 4. Budget Match (Penalty if over, bonus if near)
        if (budgetTarget && c.bestPrice !== null) {
            if (c.bestPrice <= budgetTarget) {
                score += 3
                explanations.push('Within budget (+3)')
            } else {
                score -= 2
                explanations.push('Over budget (-2)')
            }
        }

        // 5. Listing Completeness & Sources 
        // +1 for every source platform holding this canonical item
        score += c.sources.length
        explanations.push(`${c.sources.length} platforms verifying this listing (+${c.sources.length})`)

        if (c.areaSqft) {
            score += 1
            explanations.push('Area data present (+1)')
        }

        // 6. Prefer direct listings over ad/project
        const directCount = c.sources.filter(s => s.urlType === 'listing').length
        if (directCount > 0) {
            score += 2 * directCount
            explanations.push(`Direct unit listings (+${2 * directCount})`)
        }

        c.relevanceScore = parseFloat(score.toFixed(2))
        c.rankExplanation = explanations.join('\n')
    }

    // Sort descending by score
    return canonicals.sort((a, b) => b.relevanceScore - a.relevanceScore)
}
