import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, Sprout, Globe, CloudRain, User, LogOut } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { cn } from '@/utils/cn'

interface UserData {
  email: string
  name: string
  state?: string
}

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [user, setUser] = useState<UserData | null>(null)
  const { t, language, setLanguage, languageNames, availableLanguages } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const storedUser = localStorage.getItem('kisaannavi_user')
    if (storedUser) setUser(JSON.parse(storedUser))
  }, [location])

  const handleLogout = () => {
    localStorage.removeItem('kisaannavi_user')
    setUser(null)
    setShowUserMenu(false)
    navigate('/')
  }

  const navLinks = [
    { path: '/', label: t.nav.home },
    { path: '/chat', label: t.nav.chat },
    { path: '/crop-recommendation', label: t.nav.cropRecommend },
    { path: '/fertilizer-recommendation', label: t.nav.fertilizerRecommend },
    { path: '/disease-detection', label: language === 'hi' ? 'रोग पहचान' : language === 'te' ? 'రోగ గుర్తింపు' : 'Disease Detection' },
    { path: '/weather', label: t.nav.weather, icon: CloudRain }
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <nav className="bg-linear-to-r from-green-700 to-green-600 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <div className="bg-white/20 p-2 rounded-lg">
              <Sprout className="h-6 w-6" />
            </div>
            <span className="font-bold text-xl">KisaanNavi</span>
          </Link>

          <div className="hidden lg:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  'px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-1 text-sm',
                  isActive(link.path) ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
                )}
              >
                {link.icon && <link.icon className="h-4 w-4" />}
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <button
                onClick={() => { setShowLangMenu(!showLangMenu); setShowUserMenu(false) }}
                className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <Globe className="h-4 w-4" />
                <span className="text-sm hidden sm:inline">{languageNames[language]}</span>
              </button>

              {showLangMenu && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl py-1 text-gray-800">
                  {availableLanguages.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => { setLanguage(lang); setShowLangMenu(false) }}
                      className={cn(
                        'w-full text-left px-4 py-2 hover:bg-green-50 transition-colors',
                        language === lang && 'bg-green-100 font-semibold text-green-700'
                      )}
                    >
                      {languageNames[lang]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => { setShowUserMenu(!showUserMenu); setShowLangMenu(false) }}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="text-sm hidden sm:inline">{user.name.split(' ')[0]}</span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-1 text-gray-800">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="font-semibold text-gray-800">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      {t.nav.logout}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden sm:flex items-center space-x-2">
                <Link to="/login" className="px-4 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm">
                  {t.nav.login}
                </Link>
                <Link to="/register" className="px-4 py-2 rounded-lg bg-white text-green-700 hover:bg-green-50 transition-colors text-sm font-semibold">
                  {t.nav.register}
                </Link>
              </div>
            )}

            <button onClick={() => setIsOpen(!isOpen)} className="lg:hidden p-2 rounded-lg hover:bg-white/10">
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="lg:hidden bg-green-800">
          <div className="px-4 py-3 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200',
                  isActive(link.path) ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
                )}
              >
                {link.icon && <link.icon className="h-4 w-4" />}
                {link.label}
              </Link>
            ))}

            {!user && (
              <div className="pt-2 border-t border-white/20 space-y-2">
                <Link to="/login" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/10">
                  <User className="h-4 w-4" />
                  {t.nav.login}
                </Link>
                <Link to="/register" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20">
                  {t.nav.register}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
