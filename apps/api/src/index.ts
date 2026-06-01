import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { searchRoutes } from './routes/search'

const app = Fastify({ logger: true })

// Plugins
app.register(helmet)
app.register(cors, {
  origin: ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE']
})

// Health check
app.get('/health', async () => {
  return { status: 'ok', service: 'homestack-api' }
})

// Routes
app.register(searchRoutes)

// Debug — print all registered routes on startup
app.ready(() => {
  console.log(app.printRoutes())
})

const start = async () => {
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' })
    console.log('HomeStack API running on http://localhost:3001')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()