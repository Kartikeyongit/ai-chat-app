export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: Message[]
}

export interface AttachmentData {
  name: string
  mimeType: string
  base64: string
}

export interface AttachmentMeta {
  id: string
  fileName: string
  mimeType: string
  fileSize: number
}

export interface ChatRequest {
  conversationId?: string
  message: string
  files?: AttachmentData[]
}

export interface ChatResponse {
  conversationId: string
  message: Message
}

export interface CreateConversationRequest {
  title?: string
  firstMessage?: string
}
