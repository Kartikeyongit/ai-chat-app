import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.warn('GEMINI_API_KEY not set. Chat will return mock responses.')
}

export const genAI = new GoogleGenerativeAI(apiKey || 'mock')

export async function generateConversationTitle(
  userMessage: string,
): Promise<string | null> {
  if (!apiKey || apiKey === 'mock') return null
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' })
    const prompt = `Generate a very concise title (5-8 words max) for a conversation that starts with this user message. Return ONLY the title, no quotes, no prefix.

User: ${userMessage.slice(0, 500)}`

    const result = await model.generateContent(prompt)
    const title = result.response.text().trim()
    return title.replace(/^["']|["']$/g, '').slice(0, 100) || null
  } catch (error) {
    console.error('Title generation error:', error)
    return null
  }
}
