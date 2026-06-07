import { FastifyInstance } from 'fastify'
import { v4 as uuid } from 'uuid'
import { sessionStore } from '../session/sessionStore'
import { runSearch, getSearchUrls, SearchParams } from '../orchestrator/searchOrchestrator'

export async function searchRoutes(app: FastifyInstance) {
  app.post('/v1/search', async (request, reply) => {
    try {
      const {
        query,
        city = 'Bangalore',
        bhk,
        intent = 'buy',
      } = request.body as {
        query: string
        city?: string
        bhk?: string
        intent?: 'buy' | 'rent'
      }

      if (!query || query.trim().length < 2) {
        return reply.status(400).send({
          error: 'Query too short',
        })
      }

      const params: SearchParams = {
        query: query.trim(),
        city: city.trim() || 'Bangalore',
        bhk: bhk || undefined,
        intent,
      }

      const sessionId = uuid()

      const searchUrls = await getSearchUrls(params)

      await sessionStore.create(sessionId, params.query)

      // Run in background
      runSearch(sessionId, params)

      return {
        sessionId,
        query: params.query,
        searchUrls,
      }
    } catch (err) {
      console.error('Search route error:', err)
      return reply.status(500).send({
        error: String(err),
      })
    }
  })

  app.get('/v1/search/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as {
      sessionId: string
    }

    const session = await sessionStore.get(sessionId)

    if (!session) {
      return reply.status(404).send({
        error: 'Session not found or expired',
      })
    }

    return session
  })
}