'use client'

import { useState, useCallback, useRef } from 'react'

export interface AttachmentMeta {
  id: string
  fileName: string
  mimeType: string
  fileSize: number
}

export interface AttachmentData {
  name: string
  mimeType: string
  base64: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: AttachmentMeta[]
}

// ------------------------------------------------------------------
// Shared SSE stream reader – extracted so append & resendFrom share it
// ------------------------------------------------------------------
async function readSSEStream(
  body: ReadableStream<Uint8Array> | null,
  onChunk: (content: string) => void,
  onDone: (data: Record<string, unknown>) => void,
  onError: (content: string) => void,
): Promise<void> {
  const reader = body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6)) as Record<string, unknown>
          if (data.type === 'chunk') {
            onChunk(data.content as string)
          } else if (data.type === 'done') {
            onDone(data)
          } else if (data.type === 'error') {
            onError(data.content as string)
          }
        } catch {
          // ignore parse errors
        }
      }
    }
  }
}

export function useChat(apiUrl: string, accessToken?: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>()

  // Ref to prevent concurrent stream calls (guard against double-send)
  const loadingRef = useRef(false)

  // Ref to the active AbortController – allows aborting an in-flight stream
  const abortRef = useRef<AbortController | null>(null)

  // ------------------------------------------------------------------
  // Shared fetch+stream pipeline – the single place we talk to POST /chat
  // Both append & resendFrom go through here, so abort covers both.
  // ------------------------------------------------------------------
  const authHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) h['Authorization'] = `Bearer ${accessToken}`
    return h
  }

  const streamResponse = useCallback(
    async (
      assistantId: string,
      body: { conversationId?: string; message: string; files?: AttachmentData[]; truncateAfterIndex?: number },
    ) => {
      const controller = new AbortController()
      abortRef.current = controller

      loadingRef.current = true
      setIsLoading(true)
      setIsStreaming(true)
      try {
        const response = await fetch(`${apiUrl}/chat`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        if (!response.ok) throw new Error('Failed to send message')

        await readSSEStream(
          response.body,
          // onChunk
          (content) => {
            setMessages((prev) => {
              const msgs = [...prev]
              const last = msgs[msgs.length - 1]
              if (last && last.role === 'assistant' && last.id === assistantId) {
                msgs[msgs.length - 1] = { ...last, content: last.content + content }
              }
              return msgs
            })
          },
          // onDone
          (data) => {
            if (data.conversationId) {
              setConversationId(data.conversationId as string)
            }
          },
          // onError
          (content) => {
            console.error('Stream error:', content)
          },
        )
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Remove the assistant placeholder if nothing streamed before abort,
          // keeping frontend & backend message arrays in sync for resend/edit.
          setMessages((prev) => {
            const target = prev.find((m) => m.id === assistantId)
            if (target && target.content === '') {
              return prev.filter((m) => m.id !== assistantId)
            }
            return prev
          })
          return
        }
        console.error('Chat error:', error)
      } finally {
        // Only clean up if we're still the active stream – a later call to
        // abortStream() or a subsequent streamResponse may have superseded us.
        if (abortRef.current === controller) {
          abortRef.current = null
          loadingRef.current = false
          setIsLoading(false)
          setIsStreaming(false)
        }
      }
    },
    [apiUrl, accessToken],
  )

  // ------------------------------------------------------------------
  // Abort the current stream (Stop button)
  // ------------------------------------------------------------------
  const abortStream = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
    loadingRef.current = false
    setIsLoading(false)
  }, [])

  // ------------------------------------------------------------------
  // Append a new message (new turn in the conversation)
  // ------------------------------------------------------------------
  const append = useCallback(
    async (content: string, files?: AttachmentData[]) => {
      if (loadingRef.current) return

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        attachments: files?.map((f) => ({
          id: crypto.randomUUID(),
          fileName: f.name,
          mimeType: f.mimeType,
          fileSize: Math.round((f.base64.length * 3) / 4),
        })),
      }

      // Assistant placeholder is created *before* the fetch so loading
      // dots show reliably while we wait for the first byte.
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
      }

      setMessages((prev) => [...prev, userMessage, assistantMessage])

      await streamResponse(assistantMessage.id, {
        conversationId,
        message: content,
        files,
      })
    },
    [conversationId, streamResponse],
  )

  // ------------------------------------------------------------------
  // Resend from an existing user message (edit & resend, or plain resend)
  //   userMessageIndex – index of the user message in the `messages` array
  //   content          – the message content to send (may differ from stored
  //                      content when the user has edited it)
  // ------------------------------------------------------------------
  const resendFrom = useCallback(
    async (userMessageIndex: number, content: string) => {
      if (loadingRef.current) return

      const assistantId = crypto.randomUUID()

      // Batch the state update: update the message content, truncate
      // everything after it, and add the assistant placeholder.
      setMessages((prev) => {
        const updated = prev.map((m, i) =>
          i === userMessageIndex ? { ...m, content } : m,
        )
        return [
          ...updated.slice(0, userMessageIndex + 1),
          { id: assistantId, role: 'assistant' as const, content: '' },
        ]
      })

      await streamResponse(assistantId, {
        conversationId,
        message: content,
        truncateAfterIndex: userMessageIndex,
      })
    },
    [conversationId, streamResponse],
  )

  // ------------------------------------------------------------------
  // Reset (new conversation)
  // ------------------------------------------------------------------
  const reset = useCallback(() => {
    setMessages([])
    setConversationId(undefined)
  }, [])

  // ------------------------------------------------------------------
  // Load an existing conversation from the server
  // ------------------------------------------------------------------
  const loadConversation = useCallback(
    async (id: string) => {
      if (id === conversationId) return
      setConversationId(id)
      setIsLoading(true)
      try {
        const response = await fetch(`${apiUrl}/conversations/${id}`, {
          headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : undefined,
        })
        if (!response.ok) throw new Error('Failed to load')
        const data = (await response.json()) as {
          messages: {
            id: string
            role: string
            content: string
            attachments?: { id: string; fileName: string; mimeType: string; fileSize: number }[]
          }[]
        }
        setMessages(
          data.messages.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            attachments: m.attachments,
          })),
        )
      } catch (error) {
        console.error('Failed to load conversation:', error)
      } finally {
        setIsLoading(false)
      }
    },
    [apiUrl, conversationId, accessToken],
  )

  return {
    messages,
    isLoading,
    isStreaming,
    append,
    resendFrom,
    abortStream,
    reset,
    loadConversation,
    conversationId,
  }
}