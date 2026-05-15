import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

const SESSION_TTL = 60 * 30 // 30 minutes

export interface SearchSession {
  sessionId: string
  query: string
  status: 'pending' | 'running' | 'complete' | 'error'
  results: NormalizedProperty[]
  startedAt: string
  completedAt?: string
  error?: string
}

export interface NormalizedProperty {
  id: string
  source: 'magicbricks' | '99acres' | 'nobroker' | 'housing'
  title: string
  price: number | null
  priceDisplay: string
  bhk: number | null
  areaSqft: number | null
  locality: string
  city: string
  url: string
  imageUrl?: string
  amenities: string[]
  rating?: number
  postedBy?: string
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
    // Deduplicate by title + price
    const existing = new Set(session.results.map(r => `${r.title}-${r.price}`))
    const unique = newResults.filter(r => !existing.has(`${r.title}-${r.price}`))
    session.results = [...session.results, ...unique]
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