import { ExtractedProperty } from '../session/sessionStore'

const KNOWN_DOMAINS: Record<string, string> = {
  magicbricks: 'magicbricks.com',
  '99acres': '99acres.com',
  nobroker: 'nobroker.in',
}

const INVALID_TITLES = [
  'access denied',
  'property',
  'just a moment',
  'please wait',
  'error',
  '404',
  'not found',
  'captcha',
]

/**
 * Classifies a URL as 'listing' (individual unit page), 'project' (developer project page),
 * 'ad', or 'search' (generic search results or fallback).
 */
export function classifyUrl(url: string, source: ExtractedProperty['source']): ExtractedProperty['urlType'] {
  if (!url) return 'search'

  try {
    const u = new URL(url)
    const path = u.pathname.toLowerCase()

    if (source === 'magicbricks') {
      if (/\/propertyDetails\//i.test(path)) return 'listing'
      if (/pr\d{6,}\.html/i.test(path)) return 'listing'
      if (/\/property\/residential-for-sale\//i.test(path)) return 'listing'
      if (/\/projects\//i.test(path) || /\/new-projects\//i.test(path)) return 'project'
      if (/\/property-for-sale\//i.test(path)) return 'search'
    }

    if (source === '99acres') {
      if (/\/detail\//i.test(path)) return 'listing'
      if (/\/[a-z0-9-]+-\d{6,}(\.html)?/i.test(path)) return 'listing'
      if (/\/project\//i.test(path) || /\/new-project\//i.test(path) || /\/projects\//i.test(path)) return 'project'
      if (/\/search\/|\/buy\/|\/rent\//i.test(path)) return 'search'
    }

    if (source === 'nobroker') {
      if (/\/property\/sale\/[^/]+\/[a-z0-9-]+-nb\d+/i.test(path)) return 'listing'
      if (/\/property\/sale\/[^/]+\/[^/]+-nb\d+/i.test(path)) return 'listing'
      if (/\/new-projects\//i.test(path) || /\/project-details\//i.test(path)) return 'project'
      if (/\/property\/sale\//i.test(path) && path.split('/').length >= 5) return 'listing'
    }
  } catch {
    // invalid URL
  }

  // If we can't identify it as a valid listing/project/search, we classify it as an ad or fallback search
  return 'ad'
}

/**
 * Calculates completeness validation score (0 to 1).
 */
export function validateProperty(p: ExtractedProperty): ExtractedProperty {
  const urlType = classifyUrl(p.url, p.source)
  p.urlType = urlType

  let score = 0
  const reasons: string[] = []

  // Heavy penalties for structural issues
  const titleLower = p.title.toLowerCase()
  const hasBadTitle = INVALID_TITLES.some(bad => titleLower.includes(bad))

  const expectedDomain = KNOWN_DOMAINS[p.source]
  const hasBadDomain = expectedDomain && p.url && !p.url.includes(expectedDomain)

  if (hasBadTitle || p.title.length < 5 || !p.url || hasBadDomain || urlType === 'ad' || urlType === 'search') {
    p.validationStatus = 'rejected'
    p.validationScore = 0
    return p
  }

  // Assign metadata completeness score
  if (p.price !== null && p.price > 0) score += 0.4
  else reasons.push('missing_price')

  if (p.areaSqft && p.areaSqft > 0) score += 0.3
  else reasons.push('missing_area')

  if (p.bhk && p.bhk.length > 0) score += 0.2
  else reasons.push('missing_bhk')

  if (urlType === 'listing') score += 0.1
  else reasons.push('not_direct_listing')

  // Strict mode: if missing price AND missing area, completely reject
  if (p.price === null && p.areaSqft === null) {
    p.validationStatus = 'rejected'
    p.validationScore = 0
    return p
  }

  p.validationScore = parseFloat(score.toFixed(2))
  p.validationStatus = p.validationScore >= 0.7 ? 'valid' : 'warning'

  return p
}