'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface UseSpeechRecognitionReturn {
  isSupported: boolean
  isListening: boolean
  isSpeaking: boolean
  transcript: string
  error: string | null
  start: () => void
  stop: () => void
  abort: () => void
  reset: () => void
}

const SILENCE_TIMEOUT = 2000

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isSupported, setIsSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const finalizedTextRef = useRef('')
  const lastFinalizedIndexRef = useRef(-1)
  const interimTextRef = useRef('')
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasSpeakingRef = useRef(false)

  useEffect(() => {
    setIsSupported(
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
    )
  }, [])

  const clearSilenceTimer = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
  }

  const start = useCallback(() => {
    if (!isSupported || isListening) return

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionAPI) return

    clearSilenceTimer()
    wasSpeakingRef.current = false
    finalizedTextRef.current = ''
    lastFinalizedIndexRef.current = -1
    interimTextRef.current = ''

    const recognition = new SpeechRecognitionAPI() as SpeechRecognition
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let hasInterim = false
      for (let i = lastFinalizedIndexRef.current + 1; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          if (finalizedTextRef.current) finalizedTextRef.current += ' '
          finalizedTextRef.current += result[0].transcript
          lastFinalizedIndexRef.current = i
        } else {
          hasInterim = true
          interimTextRef.current = result[0].transcript
        }
      }
      if (!hasInterim) interimTextRef.current = ''

      if (hasInterim) {
        clearSilenceTimer()
      } else if (wasSpeakingRef.current && !silenceTimeoutRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          silenceTimeoutRef.current = null
          stop()
        }, SILENCE_TIMEOUT)
      }
      wasSpeakingRef.current = hasInterim
      setIsSpeaking(hasInterim)
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('SpeechRecognition error:', event.error, event.message)
      if (event.error === 'aborted') return

      const messages: Record<string, string> = {
        'not-allowed': 'Microphone access denied. Allow microphone access in your browser settings.',
        'service-not-allowed': 'Microphone access blocked by browser. Check your site permissions in Chrome settings.',
        'no-speech': 'No speech detected. Please try again.',
        'audio-capture': 'No microphone found. Please connect a microphone.',
        'network': 'Network error. Check your connection and try again.',
        'language-not-allowed': 'Language not supported by speech recognition.',
        'bad-grammar': 'Speech recognition grammar error.',
      }

      setError(messages[event.error] || `Speech recognition error: ${event.error}. Please try again.`)
      setIsListening(false)
      recognitionRef.current = null
    }

    try {
      recognition.start()
    } catch {
      setError('Microphone access denied. Allow microphone access in your browser settings.')
      setIsListening(false)
      recognitionRef.current = null
      return
    }
    recognitionRef.current = recognition
    setIsListening(true)
    setIsSpeaking(true)
    setTranscript('')
    setError(null)
  }, [isSupported, isListening])

  const stop = useCallback(() => {
    clearSilenceTimer()
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
    setIsSpeaking(false)
    const finalized = finalizedTextRef.current
    const interim = interimTextRef.current
    const text = finalized + (finalized && interim ? ' ' : '') + interim
    setTranscript(text || finalized)
    finalizedTextRef.current = ''
    interimTextRef.current = ''
    lastFinalizedIndexRef.current = -1
  }, [])

  const abort = useCallback(() => {
    clearSilenceTimer()
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
    setIsSpeaking(false)
    setTranscript('')
    setError(null)
    finalizedTextRef.current = ''
    interimTextRef.current = ''
    lastFinalizedIndexRef.current = -1
  }, [])

  const reset = useCallback(() => {
    clearSilenceTimer()
    setTranscript('')
    setError(null)
    finalizedTextRef.current = ''
    interimTextRef.current = ''
    lastFinalizedIndexRef.current = -1
  }, [])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      clearSilenceTimer()
    }
  }, [])

  return { isSupported, isListening, isSpeaking, transcript, error, start, stop, abort, reset }
}
