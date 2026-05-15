import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'

const app = Fastify({ logger: true })

// Security headers
app.register(helmet)

// Allow frontend (localhost:3000) to talk to this server
app.register(cors, {
  origin: ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE']
})

// Health check — tells you the server is alive
app.get('/health', async () => {
  return { status: 'ok', service: 'homestack-api' }
})

// Our first real endpoint — returns fake properties for now
app.get('/v1/properties', async () => {
  return {
    total: 2,
    results: [
      {
        id: '1',
        title: 'Spacious 2BHK in Koramangala',
        bhk: 2,
        priceTotal: 6500000,
        areaSqft: 1100,
        locality: 'Koramangala',
        city: 'Bengaluru',
        fitScore: 87,
        commuteMinutes: 22
      },
      {
        id: '2',
        title: 'Modern 3BHK in Indiranagar',
        bhk: 3,
        priceTotal: 9200000,
        areaSqft: 1450,
        locality: 'Indiranagar',
        city: 'Bengaluru',
        fitScore: 74,
        commuteMinutes: 35
      }
    ]
  }
})

// Start the server
const start = async () => {
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' })
    console.log('API running on http://localhost:3001')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()