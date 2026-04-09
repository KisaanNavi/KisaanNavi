import { useState, useEffect } from 'react'
import { Sprout, Loader2, ThermometerSun, Droplets, FlaskConical, MapPin, Calendar, Navigation, AlertCircle } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { 
  getStates, 
  getDistricts, 
  getSoilData, 
  getCropRecommendationsCached,
  getCurrentPosition,
  getDetailedLocationFromCoords,
  getWeatherByCoordsCached,
  type SoilData,
  type CropRecommendation
} from '@/services/api'
import { FeedbackWidget } from '@/components/FeedbackWidget'
import { rankRecommendations } from '@/utils/recommendationRanking'
import { cn } from '@/utils/cn'

interface FormData {
  nitrogen: string
  phosphorus: string
  potassium: string
  temperature: string
  humidity: string
  ph: string
  rainfall: string
  state: string
  district: string
  season: string
}

function pickTopRecommendations(crops: CropRecommendation[]): CropRecommendation[] {
  return rankRecommendations(crops, {
    getId: (item) => item.name,
    getScore: (item) => item.confidence
  }).shortlisted
}

export function CropRecommendationPage() {
  const { t, language } = useLanguage()
  const ui = language === 'hi'
    ? {
        soilAnalysis: 'मिट्टी विश्लेषण',
        note: 'नोट',
        noteText: 'ये सुझाव जिला-स्तरीय मिट्टी डेटा और स्थानीय परिस्थितियों पर आधारित हैं। बेहतर परिणाम के लिए स्थानीय कृषि विज्ञान केंद्र से मिट्टी जांच कराएं।',
        selectLocation: 'अपना स्थान चुनें',
        selectLocationText: 'राज्य और जिला चुनें, या "Detect Location" का उपयोग करें। हम सटीक सुझाव के लिए जिला मिट्टी डेटा का उपयोग करेंगे।'
      }
    : language === 'te'
      ? {
          soilAnalysis: 'నేల విశ్లేషణ',
          note: 'గమనిక',
          noteText: 'ఈ సూచనలు జిల్లా నేల డేటా మరియు స్థానిక పరిస్థితులపై ఆధారపడి ఉంటాయి. మెరుగైన ఫలితాల కోసం స్థానిక కృషి విజ్ఞాన కేంద్రంలో నేల పరీక్ష చేయించండి.',
          selectLocation: 'మీ స్థానం ఎంచుకోండి',
          selectLocationText: 'రాష్ట్రం మరియు జిల్లా ఎంచుకోండి లేదా "Detect Location" ఉపయోగించండి. కచ్చితమైన సూచనల కోసం జిల్లా నేల డేటాను ఉపయోగిస్తాము.'
        }
      : {
          soilAnalysis: 'Soil Analysis',
          note: 'Note',
          noteText: 'These recommendations are based on district soil data and local conditions. For best results, consider getting a soil test from your local Krishi Vigyan Kendra.',
          selectLocation: 'Select Your Location',
          selectLocationText: 'Choose your state and district, or use "Detect Location" to auto-fill. We will use district soil data for accurate recommendations.'
        }

  const localizeCropText = (text?: string) => {
    if (!text || language === 'en') return text
    const hi: Record<string, string> = {
      'Consult local calendar': 'स्थानीय कृषि कैलेंडर देखें',
      'Medium': 'मध्यम',
      'High': 'अधिक',
      'Low': 'कम'
    }
    const te: Record<string, string> = {
      'Consult local calendar': 'స్థానిక వ్యవసాయ క్యాలెండర్ చూడండి',
      'Medium': 'మధ్యస్థం',
      'High': 'అధికం',
      'Low': 'తక్కువ'
    }
    return (language === 'hi' ? hi : te)[text] || text
  }
  const [formData, setFormData] = useState<FormData>({
    nitrogen: '', phosphorus: '', potassium: '',
    temperature: '', humidity: '', ph: '',
    rainfall: '', state: '', district: '', season: ''
  })
  const [states, setStates] = useState<string[]>([])
  const [districts, setDistricts] = useState<string[]>([])
  const [recommendations, setRecommendations] = useState<CropRecommendation[]>([])
  const [soilInfo, setSoilInfo] = useState<SoilData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStates, setLoadingStates] = useState(true)
  const [loadingDistricts, setLoadingDistricts] = useState(false)
  const [detectingLocation, setDetectingLocation] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [usedCachedResult, setUsedCachedResult] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const normalizePlace = (value: string) =>
    value.toLowerCase().replace(/district/g, '').replace(/\s+/g, ' ').trim()

  // Load states on mount and user data
  useEffect(() => {
    loadStates()
    loadUserData()
  }, [])

  const loadStates = async () => {
    try {
      const response = await getStates()
      setStates(response.states)
    } catch (err) {
      console.error('Failed to load states:', err)
      // Fallback states
      setStates([
        'Andhra Pradesh', 'Bihar', 'Gujarat', 'Haryana', 'Karnataka',
        'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Punjab', 'Rajasthan',
        'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'West Bengal'
      ])
    } finally {
      setLoadingStates(false)
    }
  }

  const loadUserData = () => {
    try {
      const stored = localStorage.getItem('kisaannavi_user')
      if (stored) {
        const user = JSON.parse(stored)
        if (user.state) {
          setFormData(prev => ({ ...prev, state: user.state }))
          loadDistricts(user.state)
        }
        if (user.district) {
          setFormData(prev => ({ ...prev, district: user.district }))
        }
      }
    } catch {
      console.error('Failed to load user data')
    }
  }

  const loadDistricts = async (state: string): Promise<string[]> => {
    if (!state) {
      setDistricts([])
      return []
    }
    
    setLoadingDistricts(true)
    try {
      const response = await getDistricts(state)
      setDistricts(response.districts)
      return response.districts
    } catch {
      setDistricts([])
      return []
    } finally {
      setLoadingDistricts(false)
    }
  }

  const loadSoilData = async (state: string, district: string) => {
    if (!state || !district) return
    
    try {
      const response = await getSoilData(state, district)
      const soil = response.soil_data
      
      // Auto-fill NPK values from soil data
      setFormData(prev => ({
        ...prev,
        nitrogen: String(soil.nitrogen || ''),
        phosphorus: String(soil.phosphorus || ''),
        potassium: String(soil.potassium || ''),
        ph: String(soil.ph || '')
      }))
      
      setSoilInfo(soil)
    } catch {
      console.log('Soil data not available for this district')
    }
  }

  const detectLocation = async () => {
    setDetectingLocation(true)
    setError(null)
    
    try {
      const position = await getCurrentPosition()
      const { latitude, longitude } = position.coords
      const locInfo = await getDetailedLocationFromCoords(latitude, longitude)
      
      // Update form with detected location
      if (locInfo.state) {
        const matchedState = states.find(s => 
          s.toLowerCase().includes(locInfo.state.toLowerCase()) ||
          locInfo.state.toLowerCase().includes(s.toLowerCase())
        )
        
        if (matchedState) {
          setFormData(prev => ({ ...prev, state: matchedState }))
          const districtOptions = await loadDistricts(matchedState)
          
          const detectedArea = locInfo.district || locInfo.city
          if (detectedArea) {
            const matchedDistrict = districtOptions.find(d =>
              normalizePlace(d) === normalizePlace(detectedArea) ||
              normalizePlace(d).includes(normalizePlace(detectedArea)) ||
              normalizePlace(detectedArea).includes(normalizePlace(d))
            )

            if (matchedDistrict) {
              setFormData(prev => ({ ...prev, district: matchedDistrict }))
              await loadSoilData(matchedState, matchedDistrict)
            } else if (districtOptions.length > 0) {
              setFormData(prev => ({ ...prev, district: districtOptions[0] }))
              await loadSoilData(matchedState, districtOptions[0])
            }
          } else if (districtOptions.length > 0) {
            setFormData(prev => ({ ...prev, district: districtOptions[0] }))
            await loadSoilData(matchedState, districtOptions[0])
          }
        } else {
          // State not present in dataset list (e.g., Delhi). Add it dynamically.
          const detectedState = locInfo.state
          if (detectedState) {
            setStates(prev => prev.includes(detectedState) ? prev : [...prev, detectedState])
            setFormData(prev => ({ ...prev, state: detectedState, district: '' }))

            const districtOptions = await loadDistricts(detectedState)

            if (districtOptions.length > 0) {
              setFormData(prev => ({ ...prev, district: districtOptions[0] }))
              await loadSoilData(detectedState, districtOptions[0])
            } else {
              setDistricts([])
              setFormData(prev => ({ ...prev, district: '' }))
            }
          }
        }
      }

      const weatherResponse = await getWeatherByCoordsCached(latitude, longitude, locInfo.displayName)
      const weather = weatherResponse.data
      setFormData(prev => ({
        ...prev,
        temperature: String(weather.current.temperature ?? ''),
        humidity: String(weather.current.humidity ?? '')
      }))
    } catch (err) {
      setError('Could not detect location. Please select manually.')
    } finally {
      setDetectingLocation(false)
    }
  }

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    if (name === 'state') {
      setFormData(prev => ({ ...prev, district: '' }))
      setDistricts([])
      await loadDistricts(value)
    }
    
    if (name === 'district' && formData.state) {
      await loadSoilData(formData.state, value)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.state || !formData.district) {
      setError('Please select state and district')
      return
    }
    
    setIsLoading(true)
    setShowResults(false)
    setUsedCachedResult(false)
    setError(null)

    try {
      const response = await getCropRecommendationsCached({
        state: formData.state,
        district: formData.district,
        season: formData.season || undefined
      })

      setRecommendations(pickTopRecommendations(response.data.crops))
      setSoilInfo(response.data.soil_info)
      setUsedCachedResult(response.fromCache)
      setShowResults(true)
    } catch (err) {
      console.error('Recommendation error:', err)
      setError('Could not get recommendations. Please check if the backend server is running.')
      
      // Fallback to mock recommendations
      setRecommendations(pickTopRecommendations([
        { name: 'Rice', confidence: 85, suitable: true, season: 'Kharif', duration: '120-150 days', water_requirement: 'High' },
        { name: 'Wheat', confidence: 78, suitable: true, season: 'Rabi', duration: '120-140 days', water_requirement: 'Medium' },
        { name: 'Maize', confidence: 72, suitable: true, season: 'Kharif/Rabi', duration: '90-120 days', water_requirement: 'Medium' }
      ]))
      setShowResults(true)
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass = "w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors"

  return (
    <div className="min-h-screen bg-linear-to-b from-green-50 to-white py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4">
            <Sprout className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">{t.cropRec.title}</h1>
          <p className="text-gray-600 max-w-xl mx-auto">{t.cropRec.subtitle}</p>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-100">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Location Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="flex items-center space-x-2 text-lg font-semibold text-gray-800">
                    <MapPin className="h-5 w-5 text-red-500" />
                    <span>Location</span>
                  </h3>
                  <button
                    type="button"
                    onClick={detectLocation}
                    disabled={detectingLocation}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                  >
                    {detectingLocation ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Navigation className="h-4 w-4" />
                    )}
                    Detect Location
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.cropRec.state} *</label>
                    <select 
                      name="state" 
                      value={formData.state} 
                      onChange={handleChange} 
                      className={inputClass} 
                      required
                      disabled={loadingStates}
                    >
                      <option value="">Select State</option>
                      {states.map(state => <option key={state} value={state}>{state}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">District *</label>
                    <select 
                      name="district" 
                      value={formData.district} 
                      onChange={handleChange} 
                      className={inputClass}
                      required
                      disabled={loadingDistricts || !formData.state}
                    >
                      <option value="">{loadingDistricts ? 'Loading...' : 'Select District'}</option>
                      {districts.map(district => <option key={district} value={district}>{district}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Season Selection */}
              <div>
                <h3 className="flex items-center space-x-2 text-lg font-semibold text-gray-800 mb-4">
                  <Calendar className="h-5 w-5 text-orange-500" />
                  <span>{t.cropRec.season}</span>
                </h3>
                <select name="season" value={formData.season} onChange={handleChange} className={inputClass}>
                  <option value="">All Seasons</option>
                  <option value="kharif">{t.cropRec.seasons.kharif}</option>
                  <option value="rabi">{t.cropRec.seasons.rabi}</option>
                  <option value="zaid">{t.cropRec.seasons.zaid}</option>
                </select>
              </div>

              {/* Soil Nutrients (Auto-filled or Manual) */}
              <div>
                <h3 className="flex items-center space-x-2 text-lg font-semibold text-gray-800 mb-4">
                  <FlaskConical className="h-5 w-5 text-green-600" />
                  <span>Soil Nutrients (NPK)</span>
                  {soilInfo && <span className="text-sm font-normal text-green-600">(Auto-filled from district data)</span>}
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.cropRec.nitrogen}</label>
                    <input 
                      type="number" 
                      name="nitrogen" 
                      value={formData.nitrogen} 
                      onChange={handleChange} 
                      placeholder="0-140" 
                      className={inputClass} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.cropRec.phosphorus}</label>
                    <input 
                      type="number" 
                      name="phosphorus" 
                      value={formData.phosphorus} 
                      onChange={handleChange} 
                      placeholder="0-145" 
                      className={inputClass} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.cropRec.potassium}</label>
                    <input 
                      type="number" 
                      name="potassium" 
                      value={formData.potassium} 
                      onChange={handleChange} 
                      placeholder="0-205" 
                      className={inputClass} 
                    />
                  </div>
                </div>
              </div>

              {/* Climate Conditions (Optional) */}
              <div>
                <h3 className="flex items-center space-x-2 text-lg font-semibold text-gray-800 mb-4">
                  <ThermometerSun className="h-5 w-5 text-orange-500" />
                  <span>Climate (Optional)</span>
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.cropRec.temperature}</label>
                    <input type="number" name="temperature" value={formData.temperature} onChange={handleChange} placeholder="Auto from weather" step="0.1" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.cropRec.humidity}</label>
                    <input type="number" name="humidity" value={formData.humidity} onChange={handleChange} placeholder="Auto from weather" className={inputClass} />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !formData.state || !formData.district}
                className={cn(
                  "w-full py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center space-x-2",
                  isLoading || !formData.state || !formData.district
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed" 
                    : "bg-green-600 text-white hover:bg-green-700 shadow-lg hover:shadow-xl"
                )}
              >
                {isLoading ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /><span>Analyzing...</span></>
                ) : (
                  <><Sprout className="h-5 w-5" /><span>{t.cropRec.submit}</span></>
                )}
              </button>
            </form>
          </div>

          {/* Results Panel */}
          <div>
            {showResults && recommendations.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-100">
                <h2 className="flex items-center space-x-2 text-xl font-bold text-gray-800 mb-6">
                  <Calendar className="h-6 w-6 text-green-600" />
                  <span>{t.cropRec.result}</span>
                </h2>

                {usedCachedResult && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {language === 'hi'
                      ? 'ऑफलाइन या नेटवर्क समस्या के कारण कैश की गई सलाह दिखाई जा रही है।'
                      : language === 'te'
                        ? 'ఆఫ్లైన్ లేదా నెట్‌వర్క్ సమస్య కారణంగా క్యాష్ చేసిన సలహా చూపిస్తున్నాం.'
                        : 'Showing cached advisory because you are offline or the network request failed.'}
                  </div>
                )}

                {/* Soil Info Summary */}
                {soilInfo && (
                  <div className="mb-6 p-4 bg-green-50 rounded-xl border border-green-200">
                    <h4 className="font-semibold text-green-800 mb-2">{ui.soilAnalysis}: {formData.district}, {formData.state}</h4>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div><span className="text-gray-600">N:</span> <span className="font-medium">{soilInfo.n_status}</span></div>
                      <div><span className="text-gray-600">P:</span> <span className="font-medium">{soilInfo.p_status}</span></div>
                      <div><span className="text-gray-600">K:</span> <span className="font-medium">{soilInfo.k_status}</span></div>
                    </div>
                  </div>
                )}

                <p className="mb-4 text-sm text-gray-600">
                  {recommendations.length <= 2
                    ? (language === 'hi'
                        ? 'आपके इनपुट के लिए सुझाव स्पष्ट हैं, इसलिए 2 सर्वोत्तम विकल्प दिखाए गए हैं।'
                        : language === 'te'
                          ? 'మీ ఇన్‌పుట్‌కు సిఫార్సు స్పష్టంగా ఉంది, అందుకే 2 ఉత్తమ ఎంపికలు చూపించాం.'
                          : 'Your input has a strong match, so we are showing 2 best options.')
                    : (language === 'hi'
                        ? 'कई विकल्प करीब हैं, इसलिए 3 सुरक्षित विकल्प दिखाए गए हैं।'
                        : language === 'te'
                          ? 'అనేక ఎంపికలు దగ్గరగా ఉన్నాయి, అందుకే 3 భద్రమైన ఎంపికలు చూపించాం.'
                          : 'Multiple options are close, so we are showing 3 safe options.')}
                </p>

                <div className="space-y-4">
                  {recommendations.map((rec, index) => (
                    <div key={index} className={cn("p-4 rounded-xl border-2 transition-all hover:shadow-md", index === 0 ? "border-green-500 bg-green-50" : "border-gray-200 bg-gray-50")}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white", index === 0 ? "bg-green-500" : "bg-gray-400")}>
                            {index + 1}
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-800">{rec.name}</h3>
                            {rec.season && <p className="text-sm text-gray-500">{localizeCropText(rec.season)}</p>}
                            <p className="text-xs text-green-700 mt-1">
                              {index === 0
                                ? (language === 'hi' ? 'प्राथमिक सुझाव' : language === 'te' ? 'ప్రధాన సిఫార్సు' : 'Primary recommendation')
                                : (language === 'hi' ? 'वैकल्पिक सुझाव' : language === 'te' ? 'ప్రత్యామ్నాయ సిఫార్సు' : 'Alternative recommendation')}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                        {rec.duration && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-gray-400" />
                            <span className="text-gray-600">{localizeCropText(rec.duration)}</span>
                          </div>
                        )}
                        {rec.water_requirement && (
                          <div className="flex items-center gap-1">
                            <Droplets className="h-3 w-3 text-blue-400" />
                            <span className="text-gray-600">{localizeCropText(rec.water_requirement)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-800">
                    <strong>{ui.note}:</strong> {ui.noteText}
                  </p>
                </div>

                <FeedbackWidget
                  feature="crop"
                  subject={`${formData.state} | ${formData.district} | ${recommendations[0]?.name || 'crop-advisory'}`}
                  metadata={{
                    state: formData.state,
                    district: formData.district,
                    season: formData.season || null,
                    topRecommendation: recommendations[0]?.name || null,
                    usedCachedResult,
                  }}
                />
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 h-full flex flex-col items-center justify-center text-center">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                  <Sprout className="h-12 w-12 text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">{ui.selectLocation}</h3>
                <p className="text-gray-500 max-w-xs">{ui.selectLocationText}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
