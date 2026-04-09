import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { MessageSquare, Sprout, FlaskConical, ArrowRight, Wheat, Sun, Cloud, CloudRain, Stethoscope } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

export function HomePage() {
  const { t, language } = useLanguage()
  const [userName, setUserName] = useState<string>('')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('kisaannavi_user')
      if (stored) {
        const user = JSON.parse(stored)
        setUserName(user?.name || '')
      }
    } catch {
      setUserName('')
    }
  }, [])

  const features = [
    { icon: Sprout, ...t.features.crop, color: 'bg-green-500', link: '/crop-recommendation' },
    { icon: FlaskConical, ...t.features.fertilizer, color: 'bg-blue-500', link: '/fertilizer-recommendation' },
    {
      icon: Stethoscope,
      title: language === 'hi' ? 'रोग पहचान' : language === 'te' ? 'రోగ గుర్తింపు' : 'Disease Detection',
      description: language === 'hi'
        ? 'पत्ती की तस्वीर से संभावित रोग पहचानें और तुरंत फील्ड-लेवल सलाह देखें।'
        : language === 'te'
          ? 'ఆకు చిత్రంతో సంభావ్య రోగాన్ని గుర్తించి వెంటనే చిట్కాలు పొందండి.'
          : 'Analyze leaf images to detect likely crop diseases and get quick field guidance.',
      color: 'bg-emerald-600',
      link: '/disease-detection'
    },
    { icon: MessageSquare, ...t.features.chat, color: 'bg-purple-500', link: '/chat' }
  ]

  return (
    <div className="min-h-screen">
      <section className="relative bg-linear-to-br from-green-600 via-green-500 to-emerald-600 text-white overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-yellow-400/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-green-300/20 rounded-full blur-3xl" />
          <Wheat className="absolute top-20 left-10 h-32 w-32 text-white/10" />
          <Sun className="absolute top-16 right-20 h-24 w-24 text-yellow-300/20" />
          <Cloud className="absolute bottom-20 right-10 h-20 w-20 text-white/10" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 py-20 sm:py-28">
          <div className="text-center">
            <div className="inline-flex items-center space-x-3 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-full mb-8">
              <Sprout className="h-8 w-8" />
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold">{t.hero.title}</h1>
            </div>

            <h2 className="text-xl sm:text-2xl lg:text-3xl font-medium mb-6 text-green-100">
              {t.hero.subtitle}
            </h2>

            <p className="max-w-2xl mx-auto text-lg text-green-100 mb-10">
              {t.hero.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
              <Link
                to="/chat"
                className="group flex items-center justify-center space-x-2 bg-white text-green-700 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-green-50 transition-all shadow-lg hover:shadow-xl hover:scale-105"
              >
                <MessageSquare className="h-5 w-5" />
                <span>{t.hero.startChat}</span>
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                to="/crop-recommendation"
                className="flex items-center justify-center space-x-2 bg-green-800/50 backdrop-blur-sm text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-green-800/70 transition-all border border-white/20"
              >
                <Sprout className="h-5 w-5" />
                <span>{t.hero.exploreCrop}</span>
              </Link>

              <Link
                to="/fertilizer-recommendation"
                className="flex items-center justify-center space-x-2 bg-blue-700/60 backdrop-blur-sm text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700/80 transition-all border border-white/20"
              >
                <FlaskConical className="h-5 w-5" />
                <span>{t.nav.fertilizerRecommend}</span>
              </Link>

              <Link
                to="/disease-detection"
                className="flex items-center justify-center space-x-2 bg-emerald-800/60 backdrop-blur-sm text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-emerald-800/80 transition-all border border-white/20"
              >
                <Stethoscope className="h-5 w-5" />
                <span>{language === 'hi' ? 'रोग पहचान' : language === 'te' ? 'రోగ గుర్తింపు' : 'Disease Detection'}</span>
              </Link>
            </div>            {userName && (
              <div className="mt-6 text-green-100 text-lg">
                Welcome {userName}
              </div>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              fill="#f9fafb"
            />
          </svg>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-800 mb-4">
            {t.features.title}
          </h2>
          <div className="w-24 h-1 bg-green-500 mx-auto mb-12 rounded-full" />

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Link key={index} to={feature.link}>
                  <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border border-gray-100 h-full">
                    <div className={`${feature.color} w-16 h-16 rounded-xl flex items-center justify-center mb-6 shadow-lg`}>
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-3">{feature.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-16 bg-linear-to-r from-blue-500 to-cyan-500 text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                <CloudRain className="h-10 w-10" />
                <h2 className="text-3xl font-bold">{t.weather.title}</h2>
              </div>
              <p className="text-blue-100 text-lg max-w-lg">{t.weather.subtitle}</p>
            </div>
            <Link
              to="/weather"
              className="flex items-center space-x-2 bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-blue-50 transition-all shadow-lg"
            >
              <span>{t.weather.sevenDay}</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 bg-linear-to-r from-amber-500 to-orange-500 text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">3+</div>
              <div className="text-amber-100">Languages Supported</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">30+</div>
              <div className="text-amber-100">Crops Covered</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">28</div>
              <div className="text-amber-100">Indian States</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">100%</div>
              <div className="text-amber-100">Free to Use</div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-800 mb-4">How It Works</h2>
          <div className="w-24 h-1 bg-green-500 mx-auto mb-12 rounded-full" />

          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-4">
            {[
              { step: 1, title: 'Enter Details', desc: 'Provide soil and climate info' },
              { step: 2, title: 'AI Analysis', desc: 'Our ML models analyze your data' },
              { step: 3, title: 'Get Results', desc: 'Receive personalized recommendations' }
            ].map((item, index) => (
              <div key={item.step} className="flex items-center">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-2xl font-bold mx-auto mb-3">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-gray-800">{item.title}</h3>
                  <p className="text-gray-500 text-sm">{item.desc}</p>
                </div>
                {index < 2 && <ArrowRight className="hidden md:block h-8 w-8 text-green-300 mx-4" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-linear-to-br from-green-700 to-green-800 text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Ready to Transform Your Farming?</h2>
          <p className="text-green-100 text-lg mb-8">
            Start chatting with KisaanNavi now and get AI-powered farming advice in your language.
          </p>
          <Link
            to="/chat"
            className="inline-flex items-center space-x-2 bg-white text-green-700 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-green-50 transition-all shadow-lg hover:shadow-xl"
          >
            <MessageSquare className="h-5 w-5" />
            <span>{t.hero.startChat}</span>
          </Link>
        </div>
      </section>
    </div>
  )
}

