'use client'

import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Copy, Check, Pencil, RefreshCw, FileText, Image } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'

interface AttachmentMeta {
  id: string
  fileName: string
  mimeType: string
  fileSize: number
}

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  attachments?: AttachmentMeta[]
  isLoading?: boolean
  messageIndex: number
  onCopy?: (content: string) => void
  onResend?: (messageIndex: number) => void
  onEditSend?: (messageIndex: number, newContent: string) => void
  isActionsDisabled?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ------------------------------------------------------------------
// Smooth streaming reveal – decouples display speed from network chunks
// ------------------------------------------------------------------
function useSmoothStream(content: string, isStreaming: boolean) {
  const [displayed, setDisplayed] = useState(content)
  const displayedRef = useRef(displayed)
  displayedRef.current = displayed

  useEffect(() => {
    if (content.length < displayedRef.current.length) {
      setDisplayed(content)
      return
    }
    if (displayedRef.current.length >= content.length) return

    let raf: number
    const tick = () => {
      const current = displayedRef.current
      if (current.length >= content.length) return

      const remaining = content.length - current.length
      const step = remaining > 40 ? Math.ceil(remaining / 8) : remaining > 10 ? 3 : 1
      const next = content.slice(0, current.length + step)
      setDisplayed(next)

      if (next.length < content.length) {
        raf = requestAnimationFrame(tick)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [content])

  useEffect(() => {
    if (!isStreaming) setDisplayed(content)
  }, [isStreaming, content])

  return displayed
}

// ------------------------------------------------------------------
// Copy button with "Copied!" feedback
// ------------------------------------------------------------------
function CopyButton({ onCopy, content }: { onCopy: (content: string) => void; content: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    onCopy(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [onCopy, content])

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
    >
      {copied ? (
        <>
          <Check size={12} />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy size={12} />
          <span>Copy</span>
        </>
      )}
    </button>
  )
}

// ------------------------------------------------------------------
// Code block with copy button
// ------------------------------------------------------------------
function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const language = className?.match(/language-(\w+)/)?.[1] || ''
  const preRef = useRef<HTMLPreElement>(null)

  const copyCode = () => {
    const code = preRef.current?.textContent || ''
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group/code my-3">
      {language && (
        <div className="flex items-center justify-between rounded-t-xl bg-bg-elevated border-x border-t border-border-primary px-4 py-1.5">
          <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">{language}</span>
        </div>
      )}
      <pre
        ref={preRef}
        className={cn(
          'bg-bg-tertiary border border-border-primary overflow-x-auto text-sm',
          language ? 'rounded-b-xl rounded-t-none' : 'rounded-xl'
        )}
      >
        <code className={cn('p-4 block', className)}>{children}</code>
      </pre>
      <button
        onClick={copyCode}
        className="absolute top-3 right-3 p-1.5 rounded-lg bg-bg-elevated border border-border-primary opacity-0 group-hover/code:opacity-100 transition-all duration-150 text-text-tertiary hover:text-text-primary hover:border-accent/30"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  )
}

// ------------------------------------------------------------------
// Action bar – shared component for bottom placement
// ------------------------------------------------------------------
function ActionBar({
  role,
  content,
  messageIndex,
  onCopy,
  onResend,
  onEdit,
  isDisabled,
}: {
  role: 'user' | 'assistant'
  content: string
  messageIndex: number
  onCopy?: (content: string) => void
  onResend?: (messageIndex: number) => void
  onEdit?: () => void
  isDisabled: boolean | undefined
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-0.5 mt-1 opacity-0 group-hover/message:opacity-100 transition-opacity duration-150',
        role === 'user' ? 'justify-end' : 'justify-start',
      )}
    >
      {onCopy && (
        <CopyButton onCopy={onCopy} content={content} />
      )}
      {role === 'user' && onEdit && (
        <button
          onClick={onEdit}
          disabled={isDisabled}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-40"
        >
          <Pencil size={12} />
          <span>Edit</span>
        </button>
      )}
      {role === 'assistant' && onResend && (
        <button
          onClick={() => onResend(messageIndex)}
          disabled={isDisabled}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} />
          <span>Resend</span>
        </button>
      )}
    </div>
  )
}

// ------------------------------------------------------------------
// Edit mode – inline textarea with Cancel / Send
// ------------------------------------------------------------------
function EditMode({
  initialContent,
  onCancel,
  onSend,
  messageIndex,
}: {
  initialContent: string
  onCancel: () => void
  onSend: (messageIndex: number, newContent: string) => void
  messageIndex: number
}) {
  const [value, setValue] = useState(initialContent)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
      ta.focus()
      ta.setSelectionRange(ta.value.length, ta.value.length)
    }
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim()) onSend(messageIndex, value.trim())
    }
    if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        rows={1}
        className="w-full resize-none rounded-xl border border-border-primary bg-bg-secondary px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 max-h-[200px]"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1 text-xs font-medium text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => value.trim() && onSend(messageIndex, value.trim())}
          disabled={!value.trim()}
          className="rounded-lg px-3 py-1 text-xs font-medium text-accent-text bg-accent hover:bg-accent-hover transition-colors disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// ChatMessage component
// ------------------------------------------------------------------
export function ChatMessage({
  role,
  content,
  attachments,
  isLoading,
  messageIndex,
  onCopy,
  onResend,
  onEditSend,
  isActionsDisabled,
}: ChatMessageProps) {
  const [editing, setEditing] = useState(false)
  const displayedContent = useSmoothStream(content, role === 'assistant' && !!isLoading)

  // Switch away from edit mode when stream starts editing the same message
  useEffect(() => {
    if (isLoading) setEditing(false)
  }, [isLoading])

  const handleEdit = useCallback(() => {
    if (!isActionsDisabled) setEditing(true)
  }, [isActionsDisabled])

  const handleCancel = useCallback(() => {
    setEditing(false)
  }, [])

  const handleEditSend = useCallback(
    (idx: number, newContent: string) => {
      setEditing(false)
      onEditSend?.(idx, newContent)
    },
    [onEditSend],
  )

  // ------------------------------------------------------------------
  // User message
  // ------------------------------------------------------------------
  if (role === 'user') {
    return (
      <div className="group/message px-4 py-2 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-end">
          {editing ? (
            <EditMode
              initialContent={content}
              onCancel={handleCancel}
              onSend={handleEditSend}
              messageIndex={messageIndex}
            />
          ) : (
            <>
              <div className="max-w-[75%] rounded-2xl bg-accent px-4 py-2.5">
                {attachments && attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs text-accent-text/80"
                      >
                        {att.mimeType.startsWith('image/') ? <Image size={12} /> : <FileText size={12} />}
                        <span className="max-w-[120px] truncate">{att.fileName}</span>
                        <span className="opacity-60">({formatFileSize(att.fileSize)})</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="whitespace-pre-wrap text-sm text-accent-text">{content}</p>
              </div>
              <ActionBar
                role="user"
                content={content}
                messageIndex={messageIndex}
                onCopy={onCopy}
                onEdit={handleEdit}
                isDisabled={!!isActionsDisabled || isLoading || editing}
              />
            </>
          )}
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Assistant message
  // ------------------------------------------------------------------
  return (
    <div className="group/message px-4 py-2 md:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Loading dots – only when waiting for the first byte */}
        {isLoading && !displayedContent && (
          <div className="flex gap-1.5 py-2">
            <span className="h-2 w-2 rounded-full bg-accent/60 animate-[pulse-dot_1.4s_ease-in-out_infinite]" />
            <span className="h-2 w-2 rounded-full bg-accent/60 animate-[pulse-dot_1.4s_ease-in-out_0.2s_infinite]" />
            <span className="h-2 w-2 rounded-full bg-accent/60 animate-[pulse-dot_1.4s_ease-in-out_0.4s_infinite]" />
          </div>
        )}

        {/* Displayed content with smooth reveal */}
        {displayedContent && (
          <div className="prose prose-sm dark:prose-invert max-w-none text-text-secondary leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                pre: ({ children }) => {
                  const codeChildren = (children as any)?.props?.children
                  const className = (children as any)?.props?.className
                  return <CodeBlock className={className}>{codeChildren}</CodeBlock>
                },
                code: ({ children, className, ...props }) => {
                  if (className) {
                    return <>{children}</>
                  }
                  return (
                    <code
                      {...props}
                      className="bg-bg-tertiary px-1.5 py-0.5 rounded text-sm text-accent"
                    >
                      {children}
                    </code>
                  )
                },
                a: ({ children, ...props }) => (
                  <a {...props} className="text-accent hover:text-accent-hover underline underline-offset-2">
                    {children}
                  </a>
                ),
              }}
            >
              {displayedContent}
            </ReactMarkdown>

            {/* Blinking cursor while stream is still catching up */}
            {isLoading && displayedContent.length < content.length && (
              <span className="inline-block w-[2px] h-4 bg-accent/70 ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        )}

        <ActionBar
          role="assistant"
          content={content}
          messageIndex={messageIndex}
          onCopy={onCopy}
          onResend={onResend}
          isDisabled={!!isActionsDisabled || isLoading}
        />
      </div>
    </div>
  )
}