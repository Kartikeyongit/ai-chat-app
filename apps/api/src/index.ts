import Fastify from 'fastify'
import cors from '@fastify/cors'
import { chatRoutes } from './routes/chat'
import { conversationRoutes } from './routes/conversations'
import { authRoutes } from './routes/auth'
import { verifyToken } from './services/auth'

const PORT = parseInt(process.env.PORT || '4000', 10)
const HOST = process.env.HOST || '0.0.0.0'

async function main() {
  const app = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 })

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  })

  // Auth middleware — verify JWT on all /api/* routes except /auth/*
  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/health' || request.url.startsWith('/api/auth/')) return

    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const userId = await verifyToken(authHeader.slice(7))
    if (!userId) {
      return reply.status(401).send({ error: 'Invalid token' })
    }

    request.userId = userId
  })

  await app.register(authRoutes, { prefix: '/api' })
  await app.register(chatRoutes, { prefix: '/api' })
  await app.register(conversationRoutes, { prefix: '/api' })

  app.get('/health', async () => ({ status: 'ok' }))

  try {
    await app.listen({ port: PORT, host: HOST })
    console.log(`Server running at http://${HOST}:${PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
