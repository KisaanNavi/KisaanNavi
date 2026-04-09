import { useLanguage } from '@/contexts/LanguageContext'

export function Footer() {
  const { t } = useLanguage()

  return (
    <footer className="bg-green-800 text-green-100 border-t border-green-700">
      <div className="max-w-7xl mx-auto px-4 py-2 text-xs sm:text-sm text-center">
        <span className="font-semibold text-white">KisaanNavi</span>
        <span className="mx-2">|</span>
        <span>{t.footer.tagline}</span>
        <span className="mx-2">|</span>
        <span>(c) 2025</span>
      </div>
    </footer>
  )
}
