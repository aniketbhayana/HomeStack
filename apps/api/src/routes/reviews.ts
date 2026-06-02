import { FastifyInstance } from 'fastify'
import { fetchPropertyReviews } from '../scrapers/reviews'

export async function reviewsRoutes(app: FastifyInstance) {
    app.get('/v1/reviews', async (request, reply) => {
        try {
            const { query, city = 'Bangalore' } = request.query as {
                query?: string
                city?: string
            }

            if (!query || query.trim().length < 2) {
                return reply.status(400).send({ error: 'Query too short' })
            }

            const reviews = await fetchPropertyReviews(query.trim(), city.trim())
            return reviews

        } catch (err) {
            console.error('[reviews route] Error:', err)
            return reply.status(500).send({ error: String(err) })
        }
    })
}
