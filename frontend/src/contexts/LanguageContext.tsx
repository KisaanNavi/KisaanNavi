import React, { createContext, useContext, useState, useCallback } from 'react'
import { translations, Language, languageNames } from '@/data/translations'

type TranslationType = typeof translations.en

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: TranslationType
  languageNames: typeof languageNames
  availableLanguages: Language[]
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('kisaannavi-lang')
    if (saved === 'en' || saved === 'hi' || saved === 'te') return saved
    return 'en'
  })

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('kisaannavi-lang', lang)
  }, [])

  const t = translations[language]
  const availableLanguages: Language[] = ['en', 'hi', 'te']

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        languageNames,
        availableLanguages
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
