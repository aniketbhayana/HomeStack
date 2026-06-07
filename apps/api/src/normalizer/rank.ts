import { NormalizedProperty } from '../session/sessionStore'
import { calculateStringSimilarity } from './dedupe'

export function rankListings(
  query: string,
  city: string,
  listings: NormalizedProperty[]
): NormalizedProperty[] {

  const queryTokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 2)

  return listings
    .map(property => {
      let score = 0

      const titleLower = property.title.toLowerCase()

      const matchedTokens = queryTokens.filter(
        token => titleLower.includes(token)
      ).length

      score += matchedTokens * 10

      score += calculateStringSimilarity(
        query,
        property.title
      ) * 20

      if (property.areaSqft) score += 5

      if (property.price) score += 5

      return {
        ...property,
        rankingScore: score
      }
    })
    .sort(
      (a: any, b: any) =>
        b.rankingScore - a.rankingScore
    )
}