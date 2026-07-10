'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { ArrowUp, Square, Mic, MicOff, Paperclip, X, FileText, Image } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { AttachmentData } from '@/hooks/useChat'

interface SelectedFile {
  name: string
  mimeType: string
  base64: string
  size: number
}

interface ChatInputProps {
  onSend: (message: string, files?: AttachmentData[]) => void
  isLoading: boolean
  onStop?: () => void
  isStreaming?: boolean
}

export function ChatInput({ onSend, isLoading, onStop, isStreaming }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    isSupported,
    isListening,
    isSpeaking,
    transcript,
    error,
    start,
    abort,
    reset,
  } = useSpeechRecognition()

  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (error) {
      setToast(error)
      const t = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(t)
    }
  }, [error])

  useEffect(() => {
    if (!isListening && transcript) {
      setInput(transcript)
      reset()
    }
  }, [transcript, isListening, reset])

  const autoResize = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }

  useEffect(() => {
    autoResize()
  }, [input])

  const handleSend = () => {
    if ((!input.trim() && selectedFiles.length === 0) || isLoading) return
    setIsSending(true)
    reset()
    onSend(input.trim(), selectedFiles.length > 0 ? selectedFiles : undefined)
    setInput('')
    setSelectedFiles([])
    setTimeout(() => setIsSending(false), 300)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.split(',')[1] ?? result
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList) return

    const maxSize = 7 * 1024 * 1024
    const newFiles: SelectedFile[] = []

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      if (file.size > maxSize) {
        setToast(`File "${file.name}" exceeds 7 MB limit`)
        continue
      }
      const base64 = await fileToBase64(file)
      newFiles.push({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64,
        size: file.size,
      })
    }

    setSelectedFiles((prev) => [...prev, ...newFiles].slice(0, 5))
    e.target.value = ''
  }

  const handleMic = () => {
    if (isListening) {
      abort()
    } else {
      start()
    }
  }

  return (
    <div className="flex flex-col items-center px-4 pb-5 md:px-8">
      <div className="relative flex w-full max-w-[798px] items-end gap-1 rounded-2xl bg-bg-primary border border-border-primary shadow-lg shadow-black/5 dark:shadow-black/20 focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20 focus-within:shadow-lg focus-within:shadow-accent/5 transition-all duration-200">
        {isListening ? (
          <div className="flex flex-1 items-center gap-3 px-5 py-3.5 min-h-[48px]">
            <div className="flex items-center gap-[3px] h-4" aria-hidden="true">
              {[6, 12, 18, 12, 6].map((h, i) => (
                <span
                  key={i}
                  className="w-[3px] bg-accent rounded-full animate-[wave_0.8s_ease-in-out_infinite]"
                  style={{
                    height: `${h}px`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
            <span className="text-sm text-text-tertiary select-none">
              Listening...
            </span>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 px-5 pt-3">
                {selectedFiles.map((file, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 rounded-lg bg-bg-tertiary px-2.5 py-1 text-xs text-text-secondary"
                  >
                    {file.mimeType.startsWith('image/') ? <Image size={12} /> : <FileText size={12} />}
                    <span className="max-w-[120px] truncate">{file.name}</span>
                    <button
                      onClick={() => setSelectedFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="ml-0.5 text-text-tertiary hover:text-text-primary"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={selectedFiles.length > 0 ? 'Add a message or send files directly...' : 'Ask anything...'}
              rows={1}
              className="flex-1 resize-none bg-transparent px-5 py-3.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none max-h-[200px]"
            />
          </div>
        )}

        <div className="flex items-center gap-1 pr-2 pb-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming || isLoading}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-90',
              selectedFiles.length > 0
                ? 'text-accent'
                : 'text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary',
              (isStreaming || isLoading) && 'opacity-40 cursor-not-allowed',
            )}
            aria-label="Attach files"
            title="Attach files (max 5, up to 7 MB each)"
          >
            <Paperclip size={16} />
          </button>
          {isSupported && (
            <button
              onClick={handleMic}
              disabled={isStreaming || isLoading}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-90',
                isListening
                  ? 'bg-accent text-accent-text animate-pulse shadow-sm shadow-accent/20'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary',
                (isStreaming || isLoading) && 'opacity-40 cursor-not-allowed',
              )}
              aria-label={
                isListening ? 'Cancel voice input' : 'Start voice input'
              }
              title={
                isStreaming
                  ? 'Voice input unavailable while streaming'
                  : isListening
                    ? 'Cancel voice input'
                    : 'Start voice input'
              }
            >
              {isListening ? <Mic size={16} /> : <MicOff size={16} />}
            </button>
          )}

          {isStreaming ? (
            <button
              onClick={onStop}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-white hover:bg-red-600 transition-all active:scale-90"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={(!input.trim() && selectedFiles.length === 0) || isSending}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-3xl transition-all active:scale-90',
                  input.trim() || selectedFiles.length > 0
                    ? 'bg-accent text-accent-text hover:bg-accent-hover shadow-sm shadow-accent/20'
                    : 'bg-bg-elevated text-text-tertiary'
                )}
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="relative mt-2.5 w-full max-w-3xl">
        {toast && (
          <p className="text-center text-xs text-destructive animate-[slide-up_0.2s_ease-out]">
            {toast}
          </p>
        )}
        {!toast && !isListening && (
          <p className="text-center text-xs text-text-tertiary">
            AI responses are generated. Verify important information.
          </p>
        )}
        {isListening && (
          <p className="text-center text-xs text-accent animate-pulse">
            Auto-stops after silence
          </p>
        )}
      </div>
    </div>
  )
}
