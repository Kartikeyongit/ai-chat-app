'use client'

import { useState, useCallback } from 'react'

interface Conversation {
  id: string
  title: string
  updatedAt: string
  _count?: { messages: number }
}

export function useConversations(apiUrl: string, accessToken?: string) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)

  const headers = (): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) h['Authorization'] = `Bearer ${accessToken}`
    return h
  }

  const fetchAll = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/conversations`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setConversations(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [apiUrl, accessToken])

  const create = useCallback(async (title?: string) => {
    if (!accessToken) return
    try {
      const res = await fetch(`${apiUrl}/conversations`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ title }),
      })
      if (!res.ok) throw new Error('Failed to create')
      const data = await res.json()
      setConversations((prev) => [data, ...prev])
      return data
    } catch (err) {
      console.error(err)
    }
  }, [apiUrl, accessToken])

  const rename = useCallback(async (id: string, title: string) => {
    if (!accessToken) return
    try {
      await fetch(`${apiUrl}/conversations/${id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ title }),
      })
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c))
      )
    } catch (err) {
      console.error(err)
    }
  }, [apiUrl, accessToken])

  const remove = useCallback(async (id: string) => {
    if (!accessToken) return
    try {
      await fetch(`${apiUrl}/conversations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      })
      setConversations((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      console.error(err)
    }
  }, [apiUrl, accessToken])

  return { conversations, loading, fetchAll, create, rename, remove }
}
