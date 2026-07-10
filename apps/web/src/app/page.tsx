'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { PanelLeft, Sparkles, MessageSquare, ChevronDown } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { AppShell } from '@/components/layout/AppShell'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { ChatInput } from '@/components/chat/ChatInput'
import { AuthModal } from '@/components/auth/AuthModal'
import { useChat, AttachmentData } from '@/hooks/useChat'
import { useConversations } from '@/hooks/useConversations'
import { motion, AnimatePresence } from 'framer-motion'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'

function TypewriterTitle({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState(text)
  const stableRef = useRef(text)

  useEffect(() => {
    if (text === stableRef.current) return
    const prev = stableRef.current
    stableRef.current = text

    if (!text.startsWith(prev)) {
      setDisplayed(text)
      return
    }

    const newPart = text.slice(prev.length)
    let i = 0
    const interval = setInterval(() => {
      i++
      if (i <= newPart.length) {
        setDisplayed(prev + newPart.slice(0, i))
      } else {
        clearInterval(interval)
      }
    }, 25)
    return () => clearInterval(interval)
  }, [text])

  return <span>{displayed}</span>
}

export default function Home() {
  const [isDark, setIsDark] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [pendingMessage, setPendingMessage] = useState<{ text: string; files?: AttachmentData[] } | null>(null)

  const isScrolledUpRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const pendingScrollRef = useRef(false)

  // Ref to skip the layoutId animation when starting a new chat
  const skipInputLayoutAnim = useRef(false)

  const { data: session, status } = useSession()
  const accessToken = session?.apiToken

  const { messages, isLoading, isStreaming, append, reset, loadConversation, conversationId, resendFrom, abortStream } = useChat(API_URL, accessToken)
  const { conversations, fetchAll, rename, remove } = useConversations(API_URL, accessToken)
  const currentTitle = conversations.find((c) => c.id === conversationId)?.title

  // Send pending message after successful login
  useEffect(() => {
    if (status === 'authenticated' && pendingMessage) {
      setShowAuthModal(false)
      pendingScrollRef.current = true
      append(pendingMessage.text, pendingMessage.files)
      fetchAll()
      setPendingMessage(null)
    }
  }, [status, pendingMessage, append, fetchAll])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Refresh sidebar when a new conversation is created (conversationId changes)
  useEffect(() => {
    if (conversationId) {
      fetchAll()
    }
  }, [conversationId, fetchAll])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setIsDark(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Reset the skip flag once the welcome screen is mounted
  useEffect(() => {
    if (messages.length === 0) {
      skipInputLayoutAnim.current = false
    }
  }, [messages.length])

  // ------------------------------------------------------------------
  // Scroll handling
  // ------------------------------------------------------------------
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollTop // 0 = bottom with column‑reverse
    const scrolledUp = distanceFromBottom > 5
    isScrolledUpRef.current = scrolledUp
    setShowScrollButton(prev => (prev !== scrolledUp ? scrolledUp : prev))
  }, [])

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: 0, behavior: 'smooth' })
    isScrolledUpRef.current = false
    setShowScrollButton(false)
  }

  const instantScrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = 0
    isScrolledUpRef.current = false
    setShowScrollButton(false)
  }, [])

  // Effect for pending scroll (after send or conversation load)
  useEffect(() => {
    if (pendingScrollRef.current && messages.length > 0) {
      requestAnimationFrame(() => {
        instantScrollToBottom()
      })
      pendingScrollRef.current = false
    }
  }, [messages, instantScrollToBottom])

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------
  const handleNew = useCallback(async () => {
    abortStream()
    skipInputLayoutAnim.current = true   // skip layout animation
    reset()
    isScrolledUpRef.current = false
    setShowScrollButton(false)
    setSidebarOpen(false)
  }, [reset, abortStream])

  const handleSelect = useCallback(async (id: string) => {
    abortStream()
    pendingScrollRef.current = true
    isScrolledUpRef.current = false
    setShowScrollButton(false)
    await loadConversation(id)
    setSidebarOpen(false)
  }, [loadConversation, abortStream])

  const handleSend = useCallback((message: string, files?: AttachmentData[]) => {
    if (status !== 'authenticated') {
      setPendingMessage({ text: message, files })
      setShowAuthModal(true)
      return
    }
    pendingScrollRef.current = true
    append(message, files)
    fetchAll()
  }, [status, append, fetchAll])

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content)
  }, [])

  const handleResend = useCallback(
    (msgIdx: number) => {
      pendingScrollRef.current = true
      const msg = messages[msgIdx]
      if (msg?.role === 'user') {
        resendFrom(msgIdx, msg.content)
      } else if (msg?.role === 'assistant') {
        // Find the last user message before this AI message
        for (let i = msgIdx - 1; i >= 0; i--) {
          if (messages[i].role === 'user') {
            resendFrom(i, messages[i].content)
            break
          }
        }
      }
    },
    [messages, resendFrom],
  )

  const handleEditSend = useCallback(
    (msgIdx: number, newContent: string) => {
      pendingScrollRef.current = true
      resendFrom(msgIdx, newContent)
    },
    [resendFrom],
  )

  const handleDelete = useCallback(
    (id: string) => {
      remove(id)
      if (id === conversationId) {
        reset()
      }
    },
    [remove, conversationId, reset],
  )

  const handleKeyDownShortcut = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setSidebarOpen(prev => !prev)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDownShortcut)
    return () => window.removeEventListener('keydown', handleKeyDownShortcut)
  }, [handleKeyDownShortcut])

  const displayedMessages = [...messages].reverse()

  return (
    <AppShell
      sidebarOpen={sidebarOpen}
      onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      sidebar={
        <Sidebar
          conversations={conversations}
          activeId={conversationId}
          onSelect={handleSelect}
          onNew={handleNew}
          onRename={rename}
          onDelete={handleDelete}
          onClose={() => setSidebarOpen(false)}
          user={session?.user ? { name: session.user.name, email: session.user.email, image: session.user.image } : undefined}
        />
      }
    >
      <header className="relative flex h-11 items-center justify-center border-b border-border-primary bg-bg-primary px-4 md:px-6">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute left-4 md:left-6 flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          aria-label="Toggle sidebar"
        >
          <PanelLeft size={18} />
        </button>
        {currentTitle && (
          <span className="truncate text-sm font-medium text-text-primary max-w-[50%]">
            <TypewriterTitle text={currentTitle} />
          </span>
        )}
      </header>

      {/* ----- ABSOLUTE STACKING WRAPPER (prevents crossfade height squish) ----- */}
      <div className="relative flex-1 min-h-0">
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            // ----- WELCOME SCREEN (centered input, slide‑down animation) -----
            <motion.div
              key="welcome"
              className="absolute inset-0 flex flex-col items-center justify-center px-4 gap-8"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex flex-col items-center text-center">
                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="text-2xl font-semibold text-text-primary mb-2"
                >
                  How can I help you?
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 }}
                  className="text-sm text-text-tertiary max-w-md leading-relaxed"
                >
                  Start a conversation by typing a message below.
                  I can help with coding, writing, analysis, and more.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="mt-8 grid grid-cols-2 gap-3 max-w-md w-full"
                >
                  {[
                    { icon: <MessageSquare size={16} />, text: 'Explain quantum computing' },
                    { icon: <MessageSquare size={16} />, text: 'Write a Python script' },
                    { icon: <MessageSquare size={16} />, text: 'Summarize an article' },
                    { icon: <MessageSquare size={16} />, text: 'Debug my code' },
                  ].map((suggestion, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSend(suggestion.text)}
                      className="flex items-center gap-2 rounded-xl border border-border-primary bg-bg-secondary p-3 text-left text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary hover:border-accent/30 transition-colors"
                    >
                      <span className="shrink-0 text-accent">{suggestion.icon}</span>
                      <span className="truncate">{suggestion.text}</span>
                    </motion.button>
                  ))}
                </motion.div>
              </div>

              {/* Layout‑animated input wrapper – skip if coming from old conversation */}
              <motion.div
                layoutId={skipInputLayoutAnim.current ? undefined : "chat-input-wrapper"}
                className="w-full max-w-3xl"
              >
                <ChatInput onSend={handleSend} isLoading={isLoading} isStreaming={isStreaming} onStop={abortStream} />
              </motion.div>
            </motion.div>
          ) : (
            // ----- CHAT VIEW (input always at bottom) -----
            <motion.div
              key="chat"
              className="absolute inset-0 flex flex-col min-h-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 min-h-0 overflow-y-auto scroll-smooth flex flex-col-reverse pb-32"
              >
                <div ref={contentRef} className="flex flex-col-reverse">
                  {displayedMessages.map((msg, i) => {
                    const actualIndex = messages.length - 1 - i
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChatMessage
                          role={msg.role}
                          content={msg.content}
                          attachments={msg.attachments}
                          isLoading={isLoading && i === 0 && msg.role === 'assistant'}
                          messageIndex={actualIndex}
                          onCopy={handleCopy}
                          onResend={handleResend}
                          onEditSend={handleEditSend}
                          isActionsDisabled={isLoading}
                        />
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 z-20">
                <div className="bg-bg-primary">
                  <motion.div
                    layoutId={skipInputLayoutAnim.current ? undefined : "chat-input-wrapper"}
                    className="w-full"
                  >
                    <ChatInput onSend={handleSend} isLoading={isLoading} isStreaming={isStreaming} onStop={abortStream} />
                  </motion.div>
                </div>
                <AnimatePresence>
                  {showScrollButton && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: 10 }}
                      onClick={scrollToBottom}
                      className="fixed bottom-28 z-30 flex h-9 w-9 items-center justify-center rounded-full shadow-lg border border-border-primary hover:bg-bg-tertiary dark:hover:bg-bg-elevated transition-colors"
                      style={{
                        right: 'max(22px,calc((100vw - 832px) / 2 + 38px))',
                        backgroundColor: isDark ? '#000' : '#fff',
                        color: isDark ? '#fff' : '#000',
                      }}
                    >
                      <ChevronDown size={14} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AuthModal open={showAuthModal} onClose={() => { setShowAuthModal(false); setPendingMessage(null) }} />
    </AppShell>
  )
}