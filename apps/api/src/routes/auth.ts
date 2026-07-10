import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../services/prisma'
import { hash, compare } from 'bcryptjs'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
})

const oauthSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
  image: z.string().optional(),
  provider: z.string(),
  providerAccountId: z.string(),
})

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input' })
    }

    const { email, password } = parsed.data
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.password) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const valid = await compare(password, user.password)
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    })
  })

  app.post('/auth/register', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input' })
    }

    const { email, password, name } = parsed.data
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return reply.status(409).send({ error: 'Email already in use' })
    }

    const hashed = await hash(password, 12)
    const user = await prisma.user.create({
      data: { email, name: name || email.split('@')[0], password: hashed },
    })

    return reply.status(201).send({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    })
  })

  app.post('/auth/oauth', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = oauthSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input' })
    }

    const { email, name, image } = parsed.data
    if (!email) {
      return reply.status(400).send({ error: 'Email is required' })
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: { name: name || undefined, image: image || undefined },
      create: { email, name: name || email.split('@')[0], image },
    })

    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    })
  })
}
