import { NormalizedProperty } from '../session/sessionStore'
import { v4 as uuid } from 'uuid'

// Extracts a number from messy price strings
// "₹ 45.5 L" → 4550000
// "2.1 Cr" → 21000000
export function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[₹,\s]/g, '').toLowerCase()

  const crore = cleaned.match(/([\d.]+)\s*cr/)
  if (crore) return Math.round(parseFloat(crore[1]) * 10000000)

  const lakh = cleaned.match(/([\d.]+)\s*l/)
  if (lakh) return Math.round(parseFloat(lakh[1]) * 100000)

  const plain = cleaned.match(/[\d.]+/)
  if (plain) return Math.round(parseFloat(plain[0]))

  return null
}

// "3 BHK" → 3, "2BHK" → 2
export function parseBHK(raw: string | null | undefined): number | null {
  if (!raw) return null
  const match = raw.match(/(\d+)\s*bhk/i)
  return match ? parseInt(match[1]) : null
}

// "1200 sq.ft" → 1200
export function parseArea(raw: string | null | undefined): number | null {
  if (!raw) return null
  const match = raw.match(/([\d,]+)\s*(sq\.?\s*ft|sqft)/i)
  if (match) return parseInt(match[1].replace(/,/g, ''))
  return null
}

export function formatPrice(price: number | null): string {
  if (!price) return 'Price on request'
  if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`
  if (price >= 100000) return `₹${(price / 100000).toFixed(1)} L`
  return `₹${price.toLocaleString('en-IN')}`
}

export function normalizeProperty(
  raw: Record<string, any>,
  source: NormalizedProperty['source']
): NormalizedProperty {
  const price = parsePrice(raw.price)
  return {
    id: uuid(),
    source,
    title: (raw.title || 'Property').trim(),
    price,
    priceDisplay: formatPrice(price),
    bhk: parseBHK(raw.bhk || raw.title),
    areaSqft: parseArea(raw.area),
    locality: (raw.locality || raw.location || '').trim(),
    city: (raw.city || '').trim(),
    url: raw.url || '',
    imageUrl: raw.imageUrl,
    amenities: Array.isArray(raw.amenities) ? raw.amenities : [],
    rating: raw.rating ? parseFloat(raw.rating) : undefined,
    postedBy: raw.postedBy
  }
}