import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

const SESSION_TTL = 60 * 30 // 30 minutes

export interface ReviewMetric {
  label: string
  mentions: number
  type: 'pro' | 'con'
}

export interface PropertyReviews {
  placeId?: string
  rating: number | null
  reviewCount: number | null
  pros: ReviewMetric[]
  cons: ReviewMetric[]
  summary?: string
  reviewsUrl: string
}

export interface ExtractedProperty {
  id: string
  source: 'magicbricks' | '99acres' | 'nobroker'
  url: string
  urlType: 'listing' | 'project' | 'search' | 'ad'
  title: string
  price: number | null
  priceDisplay: string
  bhk: string
  areaSqft: number | null
  areaDisplay: string
  locality: string
  city: string
  createdAt: string
  validationStatus: string
  validationScore: number
}

export interface PropertySource {
  platform: 'magicbricks' | '99acres' | 'nobroker'
  url: string
  urlType: 'listing' | 'project' | 'search' | 'ad'
  price: number | null
  priceDisplay: string
}

export interface NormalizedProperty {
  id: string // Canonical ID
  title: string
  locality: string
  city: string
  bhk: string
  areaSqft: number | null
  areaDisplay: string

  sources: PropertySource[]
  bestPrice: number | null
  bestPriceDisplay: string

  relevanceScore: number
  rankExplanation?: string

  createdAt: string
  updatedAt: string
}

export interface SearchSession {
  sessionId: string
  query: string
  status: 'pending' | 'running' | 'complete' | 'error'
  results: NormalizedProperty[]
  reviews?: PropertyReviews
  startedAt: string
  completedAt?: string
  error?: string
}

export const sessionStore = {
  async create(sessionId: string, query: string): Promise<void> {
    const session: SearchSession = {
      sessionId,
      query,
      status: 'pending',
      results: [],
      startedAt: new Date().toISOString()
    }
    await redis.setex(`session:${sessionId}`, SESSION_TTL, JSON.stringify(session))
  },

  async get(sessionId: string): Promise<SearchSession | null> {
    const data = await redis.get(`session:${sessionId}`)
    return data ? JSON.parse(data) : null
  },

  async updateStatus(sessionId: string, status: SearchSession['status']): Promise<void> {
    const session = await sessionStore.get(sessionId)
    if (!session) return
    session.status = status
    if (status === 'complete' || status === 'error') {
      session.completedAt = new Date().toISOString()
    }
    await redis.setex(`session:${sessionId}`, SESSION_TTL, JSON.stringify(session))
  },

  async appendResults(sessionId: string, newResults: NormalizedProperty[]): Promise<void> {
    const session = await sessionStore.get(sessionId)
    if (!session) return

    // For V2, orchestrator will deduplicate before calling appendResults.
    // Here we just merge canonical IDs.
    const existingIds = new Set(session.results.map(r => r.id))
    const unique = newResults.filter(r => !existingIds.has(r.id))

    session.results = [...session.results, ...unique]
    await redis.setex(`session:${sessionId}`, SESSION_TTL, JSON.stringify(session))
  },

  async setReviews(sessionId: string, reviews: PropertyReviews): Promise<void> {
    const session = await sessionStore.get(sessionId)
    if (!session) return
    session.reviews = reviews
    await redis.setex(`session:${sessionId}`, SESSION_TTL, JSON.stringify(session))
  },

  async setError(sessionId: string, error: string): Promise<void> {
    const session = await sessionStore.get(sessionId)
    if (!session) return
    session.status = 'error'
    session.error = error
    session.completedAt = new Date().toISOString()
    await redis.setex(`session:${sessionId}`, SESSION_TTL, JSON.stringify(session))
  }
}