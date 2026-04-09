import { useState, useCallback, useEffect, useRef } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'error'

interface UseVoiceInputReturn {
  isListening: boolean
  status: VoiceStatus
  transcript: string
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
  isSupported: boolean
  error: string | null
  clearError: () => void
}

const languageCodes: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN'
}

export function useVoiceInput(): UseVoiceInputReturn {
  const { language } = useLanguage()
  const [isListening, setIsListening] = useState(false)
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const finalTranscriptRef = useRef('')
  const statusRef = useRef<VoiceStatus>('idle')

  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const setStatusSafe = useCallback((next: VoiceStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  useEffect(() => {
    if (!isSupported) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognitionInstance = new SpeechRecognitionAPI()

    recognitionInstance.continuous = true
    recognitionInstance.interimResults = true
    recognitionInstance.lang = languageCodes[language] || 'en-IN'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognitionInstance.onresult = (event: any) => {
      let finalChunk = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptText = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalChunk += `${transcriptText} `
        } else {
          interimTranscript += transcriptText
        }
      }

      if (finalChunk) {
        finalTranscriptRef.current += finalChunk
      }

      const fullTranscript = `${finalTranscriptRef.current} ${interimTranscript}`
        .replace(/\s+/g, ' ')
        .trim()

      setTranscript(fullTranscript)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognitionInstance.onerror = (event: any) => {
      setError(event?.error || 'unknown')
      setIsListening(false)
      setStatusSafe('error')
    }

    recognitionInstance.onend = () => {
      setIsListening(false)
      if (statusRef.current !== 'error') {
        setStatusSafe('idle')
      }
    }

    recognitionRef.current = recognitionInstance

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [isSupported, language, setStatusSafe])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('unsupported')
      setStatusSafe('error')
      return
    }
    if (isListening) return

    setError(null)
    setStatusSafe('processing')
    finalTranscriptRef.current = ''
    setTranscript('')
    
    try {
      recognitionRef.current.start()
      setIsListening(true)
      setStatusSafe('listening')
    } catch (err) {
      console.error('Speech recognition error:', err)
      const code = err instanceof DOMException && err.name === 'InvalidStateError'
        ? 'already-started'
        : 'start-failed'
      setError(code)
      setIsListening(false)
      setStatusSafe('error')
    }
  }, [isListening, setStatusSafe])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return

    setStatusSafe('processing')
    try {
      recognitionRef.current.stop()
    } catch {
      setStatusSafe('idle')
    }
    setIsListening(false)
  }, [setStatusSafe])

  const resetTranscript = useCallback(() => {
    finalTranscriptRef.current = ''
    setTranscript('')
  }, [])

  const clearError = useCallback(() => {
    setError(null)
    if (statusRef.current === 'error') {
      setStatusSafe('idle')
    }
  }, [setStatusSafe])

  return {
    isListening,
    status,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error,
    clearError
  }
}
