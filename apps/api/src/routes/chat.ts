import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../services/prisma.js'
import { genAI, generateConversationTitle } from '../services/gemini.js'
import { z } from 'zod'

const chatSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string(),
  files: z.array(z.object({
    name: z.string().min(1),
    mimeType: z.string().min(1),
    base64: z.string().min(1),
  })).max(5).optional(),
  truncateAfterIndex: z.number().int().nonnegative().optional(),
})

function generateFallbackTitle(message: string): string {
  let cleaned = message
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .trim()

  if (!cleaned) cleaned = message.trim()
  if (cleaned.length <= 80) return cleaned

  const truncated = cleaned.slice(0, 80)
  const lastPeriod = truncated.lastIndexOf('.')
  const lastQuestion = truncated.lastIndexOf('?')
  const lastExclamation = truncated.lastIndexOf('!')
  const lastBoundary = Math.max(lastPeriod, lastQuestion, lastExclamation)
  if (lastBoundary > 20) {
    return cleaned.slice(0, lastBoundary + 1)
  }

  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > 20) {
    return cleaned.slice(0, lastSpace) + '...'
  }

  return cleaned.slice(0, 80) + '...'
}

export async function chatRoutes(app: FastifyInstance) {
  app.post('/chat', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = chatSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() })
    }

    const { conversationId, message, files, truncateAfterIndex } = parsed.data
    const userId = req.userId

    let conversation
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: 'asc' }, include: { attachments: true } } },
      })
      if (!conversation) {
        return reply.status(404).send({ error: 'Conversation not found' })
      }

      if (truncateAfterIndex !== undefined) {
        // Resend/edit flow: delete messages after the given index, update the
        // message content in-place, then let the assistant response come next.
        const msgs = conversation.messages
        if (truncateAfterIndex < msgs.length - 1) {
          const toDelete = msgs.slice(truncateAfterIndex + 1)
          await prisma.message.deleteMany({
            where: { id: { in: toDelete.map((m) => m.id) } },
          })
        }
        if (msgs[truncateAfterIndex]?.content !== message) {
          await prisma.message.update({
            where: { id: msgs[truncateAfterIndex].id },
            data: { content: message },
          })
        }
        // Re-fetch so history passed to Gemini is accurate
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        conversation = (await prisma.conversation.findUnique({
          where: { id: conversationId },
          include: { messages: { orderBy: { createdAt: 'asc' }, include: { attachments: true } } },
        }))!
      } else {
        // Normal append: persist the user message
        const userMsg = await prisma.message.create({
          data: {
            role: 'user',
            content: message,
            conversationId: conversation.id,
          },
        })
        if (files && files.length > 0) {
          await prisma.attachment.createMany({
            data: files.map((f) => ({
              messageId: userMsg.id,
              fileName: f.name,
              mimeType: f.mimeType,
              fileSize: Math.round((f.base64.length * 3) / 4),
              base64: f.base64,
            })),
          })
        }
      }
    } else {
      const aiTitle = await generateConversationTitle(message)
      conversation = await prisma.conversation.create({
        data: {
          userId,
          title: aiTitle || generateFallbackTitle(message),
          messages: {
            create: { role: 'user', content: message },
          },
        },
        include: { messages: { orderBy: { createdAt: 'asc' }, include: { attachments: true } } },
      })
      const userMsg = conversation.messages[0]
      if (files && files.length > 0 && userMsg) {
        await prisma.attachment.createMany({
          data: files.map((f) => ({
            messageId: userMsg.id,
            fileName: f.name,
            mimeType: f.mimeType,
            fileSize: Math.round((f.base64.length * 3) / 4),
            base64: f.base64,
          })),
        })
      }
    }

    const assistantMessageId = crypto.randomUUID()

    // Set SSE headers
    reply.hijack()
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })

    // Immediate abort detection – must be registered before any async work
    let aborted = false
    reply.raw.on('close', () => { aborted = true })

    // Safe write helper – guards every write against a destroyed connection
    const safeWrite = (data: string) => {
      if (!aborted) {
        try { reply.raw.write(data) } catch { aborted = true }
      }
    }

    if (!process.env.GEMINI_API_KEY) {
      const fileInfo = files?.length
        ? `\n\nYou also uploaded ${files.length} file(s): ${files.map((f) => f.name).join(', ')}.\n\nIn mock mode, file content is not processed. Set \`GEMINI_API_KEY\` to get real AI responses with file analysis.`
        : ''
      const mockText = `Hello! I'm a demo AI assistant. You said: "${message}"${fileInfo}`

      // First-token latency: simulate real AI thinking
      const firstTokenDelay = parseInt(process.env.MOCK_DELAY || '600', 10)
      await new Promise<void>((r) => setTimeout(r, firstTokenDelay))

      // Stream at a natural pace: word-by-word with variable timing
      const baseDelay = parseInt(process.env.MOCK_SPEED || '35', 10)
      const words = mockText.split(/(\s+)/)
      let sentContent = ''
      for (const word of words) {
        if (aborted) break
        if (!word) continue
        sentContent += word
        const jitter = Math.random() * 40
        safeWrite(
          `data: ${JSON.stringify({ type: 'chunk', content: word, messageId: assistantMessageId })}\n\n`
        )
        await new Promise((r) => setTimeout(r, baseDelay + jitter))
      }

      if (sentContent) {
        await prisma.message.create({
          data: {
            role: 'assistant',
            content: sentContent,
            conversationId: conversation.id,
          },
        })
      }

      if (!aborted) {
        safeWrite(
          `data: ${JSON.stringify({ type: 'done', messageId: assistantMessageId, conversationId: conversation.id })}\n\n`
        )
      }
      try { if (!reply.raw.destroyed) reply.raw.end() } catch { /* ignore */ }
      return
    }

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' })

      const history = conversation.messages.slice(0, -1).map((m) => {
        const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [
          { text: m.content },
        ]
        const atts = (m as { attachments?: { fileName: string; mimeType: string; base64: string }[] }).attachments
        if (atts && atts.length > 0) {
          for (const att of atts) {
            parts.push({ inlineData: { mimeType: att.mimeType, data: att.base64 } })
          }
        }
        return {
          role: m.role === 'assistant' ? 'model' as const : 'user' as const,
          parts,
        }
      })

      const currentParts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [
        { text: message },
      ]
      if (files && files.length > 0) {
        for (const file of files) {
          currentParts.push({ inlineData: { mimeType: file.mimeType, data: file.base64 } })
        }
      }

      const chat = model.startChat({ history })
      const result = await chat.sendMessageStream(currentParts)

      let fullContent = ''
      for await (const chunk of result.stream) {
        if (aborted) break
        const text = chunk.text()
        if (text) {
          fullContent += text
          safeWrite(
            `data: ${JSON.stringify({ type: 'chunk', content: text, messageId: assistantMessageId })}\n\n`
          )
        }
      }

      if (fullContent) {
        await prisma.message.create({
          data: {
            role: 'assistant',
            content: fullContent,
            conversationId: conversation.id,
          },
        })
      }

      if (!aborted) {
        safeWrite(
          `data: ${JSON.stringify({ type: 'done', messageId: assistantMessageId, conversationId: conversation.id })}\n\n`
        )
      }
    } catch (error) {
      console.error('Gemini API error:', error)
      safeWrite(
        `data: ${JSON.stringify({ type: 'error', content: 'Failed to get AI response' })}\n\n`
      )
    }

    try { if (!reply.raw.destroyed) reply.raw.end() } catch { /* ignore */ }
  })
}
