import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../services/prisma.js'

export async function conversationRoutes(app: FastifyInstance) {
  // List all conversations
  app.get('/conversations', async (req: FastifyRequest, reply: FastifyReply) => {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    })
    return reply.send(conversations)
  })

  // Get a single conversation with messages
  app.get('/conversations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' }, include: { attachments: true } } },
    })
    if (!conversation) {
      return reply.status(404).send({ error: 'Conversation not found' })
    }
    return reply.send(conversation)
  })

  // Create a new conversation
  app.post('/conversations', async (req: FastifyRequest, reply: FastifyReply) => {
    const { title } = req.body as { title?: string }
    const conversation = await prisma.conversation.create({
      data: {
        userId: req.userId,
        title: title || 'New conversation',
      },
    })
    return reply.status(201).send(conversation)
  })

  // Update conversation title
  app.patch('/conversations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const { title } = req.body as { title: string }
    const conversation = await prisma.conversation.update({
      where: { id },
      data: { title },
    })
    return reply.send(conversation)
  })

  // Delete conversation
  app.delete('/conversations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    await prisma.conversation.delete({ where: { id } })
    return reply.status(204).send()
  })
}
