import { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'

interface UseTextToSpeechReturn {
  isSpeaking: boolean
  isSupported: boolean
  error: string | null
  speak: (text: string) => void
  stop: () => void
  clearError: () => void
}

const languageCodes: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN'
}

function pickVoiceForLanguage(langCode: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  const normalized = langCode.toLowerCase()
  const base = normalized.split('-')[0]

  return (
    voices.find((voice) => voice.lang.toLowerCase() === normalized) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith(base)) ||
    null
  )
}

export function useTextToSpeech(): UseTextToSpeechReturn {
  const { language } = useLanguage()
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window

  useEffect(() => {
    if (!isSupported) return
    window.speechSynthesis.getVoices()
  }, [isSupported])

  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel()
      }
    }
  }, [isSupported])

  const stop = useCallback(() => {
    if (!isSupported) return
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [isSupported])

  const speak = useCallback((text: string) => {
    const normalizedText = text.replace(/\s+/g, ' ').trim()
    if (!normalizedText) return

    if (!isSupported) {
      setError('unsupported')
      return
    }

    setError(null)
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(normalizedText)
    const languageCode = languageCodes[language] || 'en-IN'
    utterance.lang = languageCode

    const selectedVoice = pickVoiceForLanguage(languageCode)
    if (selectedVoice) {
      utterance.voice = selectedVoice
    }

    utterance.rate = 1
    utterance.pitch = 1
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => {
      setIsSpeaking(false)
      setError('synthesis-failed')
    }

    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }, [isSupported, language])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    isSpeaking,
    isSupported,
    error,
    speak,
    stop,
    clearError
  }
}
