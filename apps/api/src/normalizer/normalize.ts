import { ExtractedProperty } from '../session/sessionStore'
import { classifyUrl } from './validate'

export function normalizeProperty(
  raw: any,
  source: 'magicbricks' | '99acres' | 'nobroker'
): ExtractedProperty {
  const url = raw.url || ''
  const urlType = classifyUrl(url, source)

  return {
    id: `${source}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    source,
    title: raw.title || '',
    price: parsePrice(raw.price),
    priceDisplay: raw.price || 'Price on Request',
    bhk: parseBhk(raw.bhk || raw.title),
    areaSqft: parseArea(raw.area),
    areaDisplay: raw.area || '',
    locality: raw.locality || raw.city || '',
    city: raw.city || '',
    url,
    urlType,
    createdAt: new Date().toISOString(),
    validationStatus: 'pending',
    validationScore: 0
  }
}

function parsePrice(priceStr: string | undefined | null): number | null {
  if (!priceStr) return null
  const cleaned = priceStr.toLowerCase().replace(/,/g, '').trim()
  const match = cleaned.match(/([\d.]+)\s*(cr|lacs?|l)/)
  if (!match) return null

  const val = parseFloat(match[1])
  if (isNaN(val)) return null

  if (match[2] === 'cr') return val * 10000000
  if (match[2].startsWith('l')) return val * 100000
  return val
}

function parseBhk(text: string | undefined): string {
  if (!text) return ''
  const match = text.match(/(\d)\s*BHK/i)
  return match ? `${match[1]} BHK` : ''
}

function parseArea(text: string | undefined): number | null {
  if (!text) return null
  const match = text.match(/([\d,]+)\s*sq/i)
  if (!match) return null
  return parseInt(match[1].replace(/,/g, ''), 10) || null
}