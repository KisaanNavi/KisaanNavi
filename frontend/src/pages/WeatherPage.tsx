import { useState, useEffect } from 'react'
import { CloudRain, Sun, Cloud, Wind, Droplets, Search, MapPin, TrendingUp, TrendingDown, Leaf, AlertTriangle, Loader2, Navigation } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { getWeatherByCoordsCached, getWeatherByLocationCached, getCurrentPosition, getDetailedLocationFromCoords, type WeatherResponse, type LocationInfo } from '@/services/api'

function getWeatherIcon(icon: string, size: string = 'h-8 w-8') {
  const iconMap: Record<string, string> = {
    '☀️': 'sun',
    '🌤️': 'cloudy', 
    '☁️': 'cloud',
    '🌫️': 'cloud',
    '🌧️': 'rain',
    '⛈️': 'rain',
    '🌨️': 'cloud'
  }
  
  const iconKey = iconMap[icon] || icon
  
  const icons: Record<string, React.ReactNode> = {
    sun: <Sun className={`${size} text-yellow-500`} />,
    cloud: <Cloud className={`${size} text-gray-500`} />,
    rain: <CloudRain className={`${size} text-blue-500`} />,
    cloudy: <Cloud className={`${size} text-gray-400`} />
  }
  return icons[iconKey] || icons.sun
}

export function WeatherPage() {
  const { t, language } = useLanguage()
  const [location, setLocation] = useState('')
  const [weather, setWeather] = useState<WeatherResponse | null>(null)
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [usedCachedResult, setUsedCachedResult] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load user's registered state/district from localStorage.
  // Do not auto-use live geolocation unless user taps detect button.
  useEffect(() => {
    const storedUser = localStorage.getItem('kisaannavi_user')
    if (storedUser) {
      const user = JSON.parse(storedUser)
      if (user.state) {
        const registeredLocation = user.district ? `${user.district}, ${user.state}` : user.state
        setLocation(registeredLocation)
        void fetchWeatherBySearch(registeredLocation)
      }
    }
  }, [])

  const fetchWeatherBySearch = async (query: string) => {
    if (!query.trim()) return

    setLoading(true)
    setUsedCachedResult(false)
    setError(null)

    try {
      const response = await getWeatherByLocationCached(query)
      setWeather(response.data)
      setLocationInfo(null)
      setUsedCachedResult(response.fromCache)
    } catch (err) {
      console.error('Search error:', err)
      setError('Could not search location. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const detectLocation = async () => {
    setGeoLoading(true)
    setUsedCachedResult(false)
    setError(null)
    
    try {
      const position = await getCurrentPosition()
      const { latitude, longitude } = position.coords
      
      // Get location name from coordinates
      const locInfo = await getDetailedLocationFromCoords(latitude, longitude)
      setLocationInfo(locInfo)
      setLocation(locInfo.displayName)
      
      // Fetch weather for this location
      await fetchWeatherByCoords(latitude, longitude, locInfo.displayName)
    } catch (err) {
      console.error('Geolocation error:', err)
      // Fallback to search-based weather
      if (location) {
        // Use the stored location
        setError('Could not detect location. Using saved location.')
      } else {
        setError('Please enable location access or search for a location.')
      }
    } finally {
      setGeoLoading(false)
    }
  }

  const fetchWeatherByCoords = async (lat: number, lon: number, name: string) => {
    setLoading(true)
    setUsedCachedResult(false)
    setError(null)
    
    try {
      const response = await getWeatherByCoordsCached(lat, lon, name)
      setWeather(response.data)
      setUsedCachedResult(response.fromCache)
    } catch (err) {
      console.error('Weather fetch error:', err)
      setError('Could not fetch weather data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetchWeatherBySearch(location)
  }

  const advisoryStyles = {
    success: { bg: 'bg-green-50 border-green-200', text: 'text-green-800', icon: 'text-green-600' },
    warning: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-800', icon: 'text-yellow-600' },
    info: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: 'text-blue-600' },
    danger: { bg: 'bg-red-50 border-red-200', text: 'text-red-800', icon: 'text-red-600' }
  }

  const localizeCondition = (condition: string) => {
    if (language === 'en') return condition
    const hi: Record<string, string> = {
      'Mainly clear': 'मुख्यतः साफ',
      'Overcast': 'घना बादल',
      'Partly cloudy': 'आंशिक बादल',
      'Cloudy': 'बादल छाए',
      'Rain': 'बारिश'
    }
    const te: Record<string, string> = {
      'Mainly clear': 'ముఖ్యంగా స్వచ్ఛంగా',
      'Overcast': 'మేఘావృతం',
      'Partly cloudy': 'పాక్షిక మేఘావృతం',
      'Cloudy': 'మేఘావృతం',
      'Rain': 'వర్షం'
    }
    return (language === 'hi' ? hi : te)[condition] || condition
  }

  const localizeAdvisoryTitle = (title: string) => {
    if (language === 'en') return title
    const hi: Record<string, string> = { 'Good Conditions': 'अनुकूल परिस्थितियां' }
    const te: Record<string, string> = { 'Good Conditions': 'అనుకూల పరిస్థితులు' }
    return (language === 'hi' ? hi : te)[title] || title
  }

  const localizeAdvisoryMessage = (message: string) => {
    if (language === 'en') return message
    const hi: Record<string, string> = {
      'Weather conditions are favorable for farming activities.': 'मौसम की स्थिति खेती के कामों के लिए अनुकूल है।'
    }
    const te: Record<string, string> = {
      'Weather conditions are favorable for farming activities.': 'వ్యవసాయ పనులకు వాతావరణ పరిస్థితులు అనుకూలంగా ఉన్నాయి.'
    }
    return (language === 'hi' ? hi : te)[message] || message
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-cyan-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <CloudRain className="h-10 w-10 text-blue-600" />
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">{t.weather.title}</h1>
          </div>
          <p className="text-gray-600 max-w-xl mx-auto">{t.weather.subtitle}</p>
        </div>

        {/* Search and Detect Location */}
        <div className="max-w-xl mx-auto mb-8">
          <form onSubmit={handleSearch} className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t.weather.enterLocation}
              className="w-full pl-12 pr-36 py-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-lg text-lg"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
              <button 
                type="button"
                onClick={detectLocation}
                disabled={geoLoading}
                className="bg-green-100 text-green-700 px-3 py-2 rounded-lg hover:bg-green-200 transition-colors flex items-center gap-1"
                title="Detect my location"
              >
                {geoLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4" />
                )}
              </button>
              <button 
                type="submit" 
                disabled={loading} 
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {t.weather.search}
              </button>
            </div>
          </form>
          
          {locationInfo && (
            <div className="mt-2 text-sm text-gray-500 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Detected: {locationInfo.city && `${locationInfo.city}, `}{locationInfo.district && `${locationInfo.district}, `}{locationInfo.state}
            </div>
          )}
        </div>

        {error && (
          <div className="max-w-xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        {usedCachedResult && (
          <div className="max-w-xl mx-auto mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {language === 'hi'
              ? 'ऑफलाइन या नेटवर्क समस्या के कारण कैश की गई मौसम सलाह दिखाई जा रही है।'
              : language === 'te'
                ? 'ఆఫ్లైన్ లేదా నెట్‌వర్క్ సమస్య కారణంగా క్యాష్ చేసిన వాతావరణ సలహా చూపిస్తున్నాం.'
                : 'Showing cached weather advisory because you are offline or the network request failed.'}
          </div>
        )}

        {loading || geoLoading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
            <p className="mt-4 text-gray-600">{geoLoading ? 'Detecting location...' : t.common.loading}</p>
          </div>
        ) : weather ? (
          <>
            {/* Current Weather Card */}
            <div className="bg-linear-to-br from-blue-600 to-blue-700 rounded-3xl p-8 text-white shadow-2xl mb-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left">
                  <div className="flex items-center gap-2 text-blue-200 mb-2">
                    <MapPin className="h-5 w-5" />
                    <span className="text-lg">{weather.location}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {getWeatherIcon(weather.current.icon, 'h-20 w-20')}
                    <div>
                      <div className="text-6xl font-bold">{Math.round(weather.current.temperature)}°C</div>
                      <div className="text-blue-200">{localizeCondition(weather.current.condition)}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <Droplets className="h-6 w-6 mx-auto mb-2 text-blue-200" />
                    <div className="text-xl font-bold">{weather.current.humidity}%</div>
                    <div className="text-sm text-blue-200">{t.weather.humidity}</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <Wind className="h-6 w-6 mx-auto mb-2 text-blue-200" />
                    <div className="text-xl font-bold">{weather.current.wind_speed}</div>
                    <div className="text-sm text-blue-200">km/h</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                    <CloudRain className="h-6 w-6 mx-auto mb-2 text-blue-200" />
                    <div className="text-xl font-bold">{weather.current.precipitation} mm</div>
                    <div className="text-sm text-blue-200">{t.weather.rainfall}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 7-Day Forecast */}
            <div className="bg-white rounded-2xl p-6 shadow-lg mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-blue-600" />
                {t.weather.sevenDay}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
                {weather.forecast.map((day, index) => (
                  <div key={index} className={`text-center p-4 rounded-xl ${index === 0 ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50'}`}>
                    <div className="font-semibold text-gray-800 mb-2">{day.day}</div>
                    {getWeatherIcon(day.icon, 'h-10 w-10 mx-auto')}
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <span className="flex items-center text-red-500">
                        <TrendingUp className="h-3 w-3 mr-1" />{Math.round(day.temp_max)}°
                      </span>
                      <span className="flex items-center text-blue-500">
                        <TrendingDown className="h-3 w-3 mr-1" />{Math.round(day.temp_min)}°
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-center text-blue-600">
                      <Droplets className="h-3 w-3 mr-1" />
                      <span className="text-sm">{day.rain_chance}%</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{localizeCondition(day.condition)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Farming Advisories */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Leaf className="h-6 w-6 text-green-600" />
                {t.weather.cropAdvisory}
              </h2>
              <div className="space-y-4">
                {weather.advisories.map((item, index) => {
                  const styleKey = item.type as keyof typeof advisoryStyles
                  const style = advisoryStyles[styleKey] || advisoryStyles.info
                  return (
                    <div key={index} className={`p-4 rounded-xl flex items-start gap-3 border ${style.bg}`}>
                      <AlertTriangle className={`h-5 w-5 mt-0.5 shrink-0 ${style.icon}`} />
                      <div>
                        <p className={`font-semibold ${style.text}`}>{localizeAdvisoryTitle(item.title)}</p>
                        <p className={style.text}>{localizeAdvisoryMessage(item.message)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>
          </>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
            <CloudRain className="h-24 w-24 text-blue-200 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Weather Data</h3>
            <p className="text-gray-500">Click "Detect Location" or search for a city to see weather</p>
          </div>
        )}
      </div>
    </div>
  )
}

