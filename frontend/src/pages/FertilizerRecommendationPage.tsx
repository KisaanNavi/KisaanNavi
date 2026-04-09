import { useState, useEffect } from 'react'
import { FlaskConical, Loader2, Leaf, Droplet, AlertCircle, CheckCircle2, Clock, MapPin } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { 
  getStates, 
  getDistricts, 
  getCrops,
  getSoilData,
  getFertilizerRecommendationsCached,
  type CropType,
  type FertilizerRecommendation,
  type SoilData
} from '@/services/api'
import { FeedbackWidget } from '@/components/FeedbackWidget'
import { cn } from '@/utils/cn'

interface FormData {
  state: string
  district: string
  cropType: string
  nitrogen: string
  phosphorus: string
  potassium: string
  season: string
}

export function FertilizerRecommendationPage() {
  const { t, language } = useLanguage()
  const ui = language === 'hi'
    ? {
        dosage: 'मात्रा',
        application: 'उपयोग',
        why: 'कारण',
        appSchedule: 'उपयोग समय-सारणी',
        notes: 'महत्वपूर्ण नोट्स',
        noCrops: 'चुने गए राज्य/मौसम के लिए कोई फसल नहीं मिली। दूसरा मौसम चुनें।',
        emptyTitle: 'उर्वरक सलाह प्राप्त करें',
        emptyText: 'राज्य और फसल चुनें। एनपीके स्तर हाथ से सेट करें या जिले से ऑटो-फिल करें।',
        districtHelperLabel: 'एनपीके मान नहीं पता?',
        districtHelperHint: 'जिला चुनें और हम स्थानीय मिट्टी डेटा से NPK स्तर भर देंगे।'
      }
    : language === 'te'
      ? {
          dosage: 'మోతాదు',
          application: 'వాడకం',
          why: 'కారణం',
          appSchedule: 'వాడే షెడ్యూల్',
          notes: 'ముఖ్య గమనికలు',
          noCrops: 'ఎంచుకున్న రాష్ట్రం/సీజన్‌కు పంటలు లభించలేదు. వేరే సీజన్ ఎంచుకోండి.',
          emptyTitle: 'ఎరువు సలహా పొందండి',
          emptyText: 'రాష్ట్రం మరియు పంట ఎంచుకోండి. NPK స్థాయిలను చేతితో పెట్టండి లేదా జిల్లాతో ఆటో-ఫిల్ చేయండి.',
          districtHelperLabel: 'NPK విలువలు తెలియవా?',
          districtHelperHint: 'జిల్లా ఎంచుకోండి. స్థానిక నేల డేటా ఆధారంగా NPK స్థాయిలను ఆటో-ఫిల్ చేస్తాం.'
        }
      : {
          dosage: 'Dosage',
          application: 'Application',
          why: 'Why',
          appSchedule: 'Application Schedule',
          notes: 'Important Notes',
          noCrops: 'No crops found for the selected state/season. Try another season.',
          emptyTitle: 'Get Fertilizer Advice',
          emptyText: 'Choose state and crop. Set NPK manually or use district to auto-fill local NPK.',
          districtHelperLabel: 'Confused about NPK values?',
          districtHelperHint: 'Choose district and we will auto-fill NPK levels from local soil data.'
        }
  const localizeBackendText = (text: string) => {
    if (!text || language === 'en') return text

    const hiMap: Record<string, string> = {
      'As per soil test recommendation': 'मिट्टी परीक्षण के अनुसार',
      'Apply as per crop requirement': 'फसल की आवश्यकता के अनुसार डालें',
      'Apply in 2-3 splits during crop growth': 'फसल वृद्धि के दौरान 2-3 किस्तों में डालें',
      'Apply at sowing as basal dose': 'बुवाई के समय बेसल डोज के रूप में डालें',
      'Apply at sowing': 'बुवाई के समय डालें',
      'Apply at sowing or in splits': 'बुवाई के समय या किस्तों में डालें',
      'Apply in 2-3 splits': '2-3 किस्तों में डालें',
      'Apply basal dose at sowing. Top dress nitrogen in 2-3 splits at 25-30 day intervals.': 'बुवाई के समय बेसल डोज डालें। नाइट्रोजन की टॉप ड्रेसिंग 25-30 दिन के अंतराल पर 2-3 किस्तों में करें।',
      'Basal: Full P & K. Square formation: 1/3 N. Flowering: 1/3 N. Boll development: 1/3 N.': 'बेसल: पूरा P और K. स्क्वायर चरण: 1/3 N. फूल आने पर: 1/3 N. बॉल विकास पर: 1/3 N.',
      'Apply urea in evening or before irrigation/rain to reduce nitrogen loss.': 'नाइट्रोजन हानि कम करने के लिए यूरिया शाम में या सिंचाई/बारिश से पहले डालें।'
    }
    const teMap: Record<string, string> = {
      'As per soil test recommendation': 'నేల పరీక్ష సూచన ప్రకారం',
      'Apply as per crop requirement': 'పంట అవసరానికి అనుగుణంగా వేయండి',
      'Apply in 2-3 splits during crop growth': 'పంట పెరుగుదల సమయంలో 2-3 విడతల్లో వేయండి',
      'Apply at sowing as basal dose': 'విత్తే సమయంలో బేసల్ మోతాదుగా వేయండి',
      'Apply at sowing': 'విత్తే సమయంలో వేయండి',
      'Apply at sowing or in splits': 'విత్తే సమయంలో లేదా విడతల్లో వేయండి',
      'Apply in 2-3 splits': '2-3 విడతల్లో వేయండి',
      'Apply basal dose at sowing. Top dress nitrogen in 2-3 splits at 25-30 day intervals.': 'విత్తే సమయంలో బేసల్ మోతాదు వేయండి. నైట్రోజన్ టాప్‌డ్రెస్‌ను 25-30 రోజుల వ్యవధిలో 2-3 విడతల్లో వేయండి.',
      'Basal: Full P & K. Square formation: 1/3 N. Flowering: 1/3 N. Boll development: 1/3 N.': 'బేసల్: పూర్తి P మరియు K. స్క్వేర్ దశ: 1/3 N. పుష్ప దశ: 1/3 N. బోల్ అభివృద్ధి: 1/3 N.',
      'Apply urea in evening or before irrigation/rain to reduce nitrogen loss.': 'నైట్రోజన్ నష్టం తగ్గేందుకు యూరియాను సాయంత్రం లేదా నీరుపోసే ముందు/వానకు ముందు వేయండి.'
    }

    const map = language === 'hi' ? hiMap : teMap
    return map[text] || text
  }
  const [formData, setFormData] = useState<FormData>({
    state: '', district: '', cropType: '',
    nitrogen: '', phosphorus: '', potassium: '', season: ''
  })
  
  // Data states
  const [states, setStates] = useState<string[]>([])
  const [districts, setDistricts] = useState<string[]>([])
  const [crops, setCrops] = useState<CropType[]>([])
  const [soilData, setSoilData] = useState<SoilData | null>(null)
  
  // UI states
  const [recommendations, setRecommendations] = useState<FertilizerRecommendation[]>([])
  const [applicationInfo, setApplicationInfo] = useState<string>('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStates, setLoadingStates] = useState(true)
  const [loadingDistricts, setLoadingDistricts] = useState(false)
  const [loadingCrops, setLoadingCrops] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [usedCachedResult, setUsedCachedResult] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load states on mount
  useEffect(() => {
    loadStates()
    loadUserData()
  }, [])

  const loadStates = async () => {
    try {
      const response = await getStates()
      setStates(response.states)
    } catch {
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
          loadCrops(user.state, undefined)
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

  const loadCrops = async (state: string, season?: string) => {
    if (!state) {
      setCrops([])
      return
    }
    
    setLoadingCrops(true)
    try {
      const response = await getCrops(state, season)
      setCrops(response.crops)
    } catch {
      // Fallback
      setCrops([
        { name: 'Rice', name_hi: 'धान' },
        { name: 'Wheat', name_hi: 'गेहूँ' },
        { name: 'Maize', name_hi: 'मक्का' },
        { name: 'Cotton', name_hi: 'कपास' }
      ])
    } finally {
      setLoadingCrops(false)
    }
  }

  const loadSoilDataForDistrict = async (state: string, district: string) => {
    if (!state || !district) return
    
    try {
      const response = await getSoilData(state, district)
      setSoilData(response.soil_data)
      
      // Auto-fill nutrient levels
      const soil = response.soil_data
      setFormData(prev => ({
        ...prev,
        nitrogen: soil.n_status?.toLowerCase() || '',
        phosphorus: soil.p_status?.toLowerCase() || '',
        potassium: soil.k_status?.toLowerCase() || ''
      }))
    } catch {
      console.log('Soil data not available')
    }
  }

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    if (name === 'state') {
      setFormData(prev => ({ ...prev, district: '', cropType: '' }))
      setSoilData(null)
      setDistricts([])
      setCrops([])
      
      await Promise.all([
        loadDistricts(value),
        loadCrops(value, undefined)
      ])
    }
    
    if (name === 'district' && formData.state) {
      if (value) {
        await loadSoilDataForDistrict(formData.state, value)
      } else {
        setSoilData(null)
      }
    }
    
    if (name === 'season' && formData.state) {
      setFormData(prev => ({ ...prev, cropType: '' }))
      await loadCrops(formData.state, value)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.cropType) {
      setError('Please select a crop')
      return
    }
    
    setIsLoading(true)
    setShowResults(false)
    setUsedCachedResult(false)
    setError(null)

    try {
      const response = await getFertilizerRecommendationsCached({
        state: formData.state,
        district: formData.district || undefined,
        crop: formData.cropType,
        nitrogen: formData.nitrogen || undefined,
        phosphorus: formData.phosphorus || undefined,
        potassium: formData.potassium || undefined
      })

      setRecommendations(response.data.fertilizers)
      setApplicationInfo(response.data.application_info)
      setWarnings(response.data.warnings || [])
      setUsedCachedResult(response.fromCache)
      setShowResults(true)
    } catch (err) {
      console.error('Recommendation error:', err)
      setError('Could not get recommendations. Please check if the backend is running.')
      
      // Fallback
      setRecommendations([
        { name: 'Urea', confidence: 85, dosage: '50-60 kg/acre', application: 'Apply in 2-3 splits' },
        { name: 'DAP', confidence: 78, dosage: '40-50 kg/acre', application: 'Apply at sowing' },
        { name: 'MOP', confidence: 72, dosage: '30-40 kg/acre', application: 'Apply at sowing or in splits' }
      ])
      setShowResults(true)
    } finally {
      setIsLoading(false)
    }
  }

  const selectClass = "w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors appearance-none cursor-pointer"
  
  const nutrientLevels = [
    { value: 'low', label: t.fertRec.levels.low, color: 'text-red-500', bg: 'bg-red-100' },
    { value: 'medium', label: t.fertRec.levels.medium, color: 'text-yellow-500', bg: 'bg-yellow-100' },
    { value: 'high', label: t.fertRec.levels.high, color: 'text-green-500', bg: 'bg-green-100' }
  ]

  return (
    <div className="min-h-screen bg-linear-to-b from-blue-50 to-white py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
            <FlaskConical className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">{t.fertRec.title}</h1>
          <p className="text-gray-600 max-w-xl mx-auto">{t.fertRec.subtitle}</p>
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
                    <span>{language === 'hi' ? 'स्थान' : language === 'te' ? 'స్థానం' : 'Location'}</span>
                  </h3>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.cropRec.state}</label>
                  <select 
                    name="state" 
                    value={formData.state} 
                    onChange={handleChange} 
                    className={selectClass}
                    disabled={loadingStates}
                  >
                    <option value="">Select State</option>
                    {states.map(state => <option key={state} value={state}>{state}</option>)}
                  </select>
                </div>
              </div>

              {/* Season Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'hi' ? 'मौसम' : language === 'te' ? 'సీజన్' : 'Season'}</label>
                <select name="season" value={formData.season} onChange={handleChange} className={selectClass}>
                  <option value="">{language === 'hi' ? 'सभी मौसम' : language === 'te' ? 'అన్ని సీజన్లు' : 'All Seasons'}</option>
                  <option value="kharif">{t.cropRec.seasons.kharif}</option>
                  <option value="rabi">{t.cropRec.seasons.rabi}</option>
                  <option value="zaid">{t.cropRec.seasons.zaid}</option>
                </select>
              </div>

              {/* Crop Type - Filtered by State and Season */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.fertRec.cropType} *
                  {formData.state && <span className="text-blue-600 ml-1">({language === 'hi' ? 'फ़िल्टर' : language === 'te' ? 'ఫిల్టర్' : 'Filtered for'} {formData.state})</span>}
                </label>
                <select 
                  name="cropType" 
                  value={formData.cropType} 
                  onChange={handleChange} 
                  className={selectClass}
                  required
                  disabled={loadingCrops || !formData.state}
                >
                  <option value="">{loadingCrops ? (language === 'hi' ? 'फसलें लोड हो रही हैं...' : language === 'te' ? 'పంటలు లోడ్ అవుతున్నాయి...' : 'Loading crops...') : (language === 'hi' ? 'फसल चुनें' : language === 'te' ? 'పంట ఎంచుకోండి' : 'Select Crop')}</option>
                  {crops.map(crop => (
                    <option key={crop.name} value={crop.name}>
                      {crop.name} {language !== 'en' && crop.name_hi ? `(${crop.name_hi})` : ''}
                    </option>
                  ))}
                </select>
                {!loadingCrops && formData.state && crops.length === 0 && (
                  <p className="mt-2 text-sm text-amber-700">
                    {ui.noCrops}
                  </p>
                )}
              </div>

              {/* District Helper for Auto NPK */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{ui.districtHelperLabel}</label>
                <p className="text-xs text-gray-500 mb-2">{ui.districtHelperHint}</p>
                <select 
                  name="district" 
                  value={formData.district} 
                  onChange={handleChange} 
                  className={selectClass}
                  disabled={loadingDistricts || !formData.state}
                >
                  <option value="">{loadingDistricts ? t.common.loading : (language === 'hi' ? 'जिला चुनें (वैकल्पिक)' : language === 'te' ? 'జిల్లా ఎంచుకోండి (ఐచ్ఛికం)' : 'Select District (optional)')}</option>
                  {districts.map(district => <option key={district} value={district}>{district}</option>)}
                </select>
              </div>

              {/* Nutrient Levels */}
              <div>
                <h3 className="flex items-center space-x-2 text-lg font-semibold text-gray-800 mb-4">
                  <Leaf className="h-5 w-5 text-green-600" />
                  <span>{language === 'hi' ? 'पोषक स्तर' : language === 'te' ? 'పోషక స్థాయిలు' : 'Nutrient Levels'}</span>
                  {soilData && <span className="text-sm font-normal text-green-600">({language === 'hi' ? 'स्वतः पहचाना गया' : language === 'te' ? 'స్వయంచాలకంగా గుర్తింపు' : 'Auto-detected'})</span>}
                </h3>

                {['nitrogen', 'phosphorus', 'potassium'].map((nutrient) => (
                  <div key={nutrient} className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t.fertRec[nutrient as keyof typeof t.fertRec] as string}
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {nutrientLevels.map(level => (
                        <button
                          key={`${nutrient}-${level.value}`}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, [nutrient]: level.value }))}
                          className={cn(
                            "py-3 px-4 rounded-xl border-2 font-medium transition-all",
                            formData[nutrient as keyof FormData] === level.value
                              ? `border-blue-500 ${level.bg} text-blue-700`
                              : "border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <span className={level.color}>•</span> {level.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={isLoading || !formData.cropType}
                className={cn(
                  "w-full py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center space-x-2",
                  (isLoading || !formData.cropType)
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl"
                )}
              >
                {isLoading ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /><span>Analyzing...</span></>
                ) : (
                  <><FlaskConical className="h-5 w-5" /><span>{t.fertRec.submit}</span></>
                )}
              </button>
            </form>
          </div>

          {/* Results Panel */}
          <div>
            {showResults && recommendations.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-100">
                <h2 className="flex items-center space-x-2 text-xl font-bold text-gray-800 mb-6">
                  <CheckCircle2 className="h-6 w-6 text-blue-600" />
                  <span>{t.fertRec.result}</span>
                </h2>

                {usedCachedResult && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {language === 'hi'
                      ? 'ऑफलाइन या नेटवर्क समस्या के कारण कैश की गई उर्वरक सलाह दिखाई जा रही है।'
                      : language === 'te'
                        ? 'ఆఫ్లైన్ లేదా నెట్‌వర్క్ సమస్య కారణంగా క్యాష్ చేసిన ఎరువు సలహా చూపిస్తున్నాం.'
                        : 'Showing cached fertilizer advice because you are offline or the network request failed.'}
                  </div>
                )}

                <div className="space-y-4">
                  {recommendations.map((rec, index) => (
                    <div key={index} className="p-5 rounded-xl border-2 border-gray-200 bg-gray-50 hover:border-blue-300 transition-all">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2 mb-3">
                        <FlaskConical className="h-5 w-5 text-blue-500" />
                        <span>{rec.name}</span>
                      </h3>

                      <div className="grid gap-3 text-sm">
                        <div className="flex items-start space-x-2">
                          <Droplet className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                          <div><span className="font-medium text-gray-700">{ui.dosage}: </span><span className="text-gray-600">{localizeBackendText(rec.dosage)}</span></div>
                        </div>
                        <div className="flex items-start space-x-2">
                          <Clock className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <div><span className="font-medium text-gray-700">{ui.application}: </span><span className="text-gray-600">{localizeBackendText(rec.application)}</span></div>
                        </div>
                        {rec.reason && (
                          <div className="flex items-start space-x-2">
                            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                            <div><span className="font-medium text-gray-700">{ui.why}: </span><span className="text-gray-600">{localizeBackendText(rec.reason)}</span></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Application Schedule */}
                {applicationInfo && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {ui.appSchedule}
                    </h4>
                    <p className="text-sm text-green-700">{localizeBackendText(applicationInfo)}</p>
                  </div>
                )}

                {/* Warnings */}
                {warnings.length > 0 && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      {ui.notes}
                    </h4>
                    <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
                      {warnings.map((warning, i) => (
                        <li key={i}>{localizeBackendText(warning)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <FeedbackWidget
                  feature="fertilizer"
                  subject={`${formData.state} | ${formData.cropType}`}
                  metadata={{
                    state: formData.state,
                    district: formData.district || null,
                    crop: formData.cropType,
                    season: formData.season || null,
                    fertilizers: recommendations.map((item) => item.name),
                    usedCachedResult,
                  }}
                />
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 h-full flex flex-col items-center justify-center text-center">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                  <FlaskConical className="h-12 w-12 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">{ui.emptyTitle}</h3>
                <p className="text-gray-500 max-w-xs">{ui.emptyText}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


