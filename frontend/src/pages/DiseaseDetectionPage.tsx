import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, Camera, CheckCircle2, ImagePlus, Leaf, Loader2, ShieldCheck, Stethoscope } from 'lucide-react'

import { FeedbackWidget } from '@/components/FeedbackWidget'
import { useLanguage } from '@/contexts/LanguageContext'
import { detectDiseaseCached, type DiseaseDetectionResponse } from '@/services/api'
import { cn } from '@/utils/cn'

const SUPPORTED_CROPS = [
  'Apple',
  'Bell pepper',
  'Blueberry',
  'Cherry',
  'Corn',
  'Grape',
  'Peach',
  'Potato',
  'Raspberry',
  'Soybean',
  'Squash',
  'Strawberry',
  'Tomato',
]


export function DiseaseDetectionPage() {
  const { language } = useLanguage()
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [selectedCrop, setSelectedCrop] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [result, setResult] = useState<DiseaseDetectionResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [usedCachedResult, setUsedCachedResult] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const ui = useMemo(() => {
    if (language === 'hi') {
      return {
        title: 'फसल रोग पहचान',
        subtitle: 'पत्ती की फोटो अपलोड करें और संभावित रोग का त्वरित विश्लेषण देखें।',
        uploadTitle: 'पत्ती की छवि अपलोड करें',
        uploadHint: 'साफ, नजदीक से ली गई पत्ती की फोटो सबसे अच्छी रहेगी।',
        chooseImage: 'छवि चुनें',
        analyze: 'रोग पहचानें',
        analyzing: 'विश्लेषण हो रहा है...',
        result: 'रोग पहचान परिणाम',
        crop: 'फसल',
        disease: 'रोग',
        healthy: 'स्थिति',
        confidence: 'विश्वास',
        healthyLeaf: 'स्वस्थ पत्ती',
        likelyIssue: 'संभावित समस्या',
        summary: 'संक्षिप्त विवरण',
        actions: 'तुरंत क्या करें',
        prevention: 'बचाव के उपाय',
        alternatives: 'अन्य संभावित मिलान',
        emptyTitle: 'तैयार',
        emptyText: 'एक पत्ती की छवि चुनें और सिस्टम उससे रोग वर्ग की भविष्यवाणी करेगा।',
        missingImage: 'कृपया पहले एक पत्ती की छवि चुनें।',
        failed: 'रोग पहचान अभी पूरी नहीं हो सकी। कृपया बैकएंड और मॉडल जांचें।',
      }
    }
    if (language === 'te') {
      return {
        title: 'పంట రోగ గుర్తింపు',
        subtitle: 'ఆకు ఫోటోను అప్లోడ్ చేసి, సంభావ్య రోగాన్ని త్వరగా తెలుసుకోండి.',
        uploadTitle: 'ఆకు చిత్రాన్ని అప్లోడ్ చేయండి',
        uploadHint: 'స్పష్టంగా కనిపించే దగ్గరి ఆకు ఫోటో ఉత్తమంగా పనిచేస్తుంది.',
        chooseImage: 'చిత్రం ఎంచుకోండి',
        analyze: 'రోగాన్ని గుర్తించండి',
        analyzing: 'విశ్లేషణ జరుగుతోంది...',
        result: 'రోగ గుర్తింపు ఫలితం',
        crop: 'పంట',
        disease: 'రోగం',
        healthy: 'స్థితి',
        confidence: 'నమ్మకం',
        healthyLeaf: 'ఆరోగ్యకరమైన ఆకు',
        likelyIssue: 'సంభావ్య సమస్య',
        summary: 'సంక్షిప్త వివరణ',
        actions: 'వెంటనే చేయాల్సినవి',
        prevention: 'నివారణ చిట్కాలు',
        alternatives: 'ఇతర సాధ్యమైన ఫలితాలు',
        emptyTitle: 'సిద్ధంగా ఉంది',
        emptyText: 'ఒక ఆకు చిత్రం ఎంచుకుంటే సిస్టమ్ దానికి సరిపోయే రోగ వర్గాన్ని అంచనా వేస్తుంది.',
        missingImage: 'దయచేసి ముందుగా ఆకు చిత్రాన్ని ఎంచుకోండి.',
        failed: 'రోగ గుర్తింపు విఫలమైంది. బ్యాక్‌ఎండ్ మరియు మోడల్‌ను తనిఖీ చేయండి.',
      }
    }
    return {
      title: 'Crop Disease Detection',
      subtitle: 'Upload a leaf image and get a fast disease prediction.',
      uploadTitle: 'Upload Leaf Image',
      uploadHint: 'A clear close-up leaf photo works best.',
      chooseImage: 'Choose Image',
      analyze: 'Detect Disease',
      analyzing: 'Analyzing...',
      result: 'Disease Detection Result',
      crop: 'Crop',
      disease: 'Disease',
      healthy: 'Status',
      confidence: 'Confidence',
      healthyLeaf: 'Healthy leaf',
      likelyIssue: 'Likely issue',
      summary: 'Summary',
      actions: 'Immediate actions',
      prevention: 'Prevention tips',
      alternatives: 'Other likely matches',
      emptyTitle: 'Ready',
      emptyText: 'Pick a leaf image and the system will predict the closest disease class from the trained model.',
      missingImage: 'Please choose a leaf image first.',
      failed: 'Disease detection could not be completed. Please check the backend and trained model.',
    }
  }, [language])

  const handleSelectImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setSelectedImage(file)
    setPreviewUrl(URL.createObjectURL(file))
    setResult(null)
    setUsedCachedResult(false)
    setError(null)
    event.target.value = ''
  }

  const handleAnalyze = async () => {
    if (!selectedCrop) {
      setError(
        language === 'hi'
          ? 'कृपया फसल चुनें, फिर विश्लेषण करें।'
          : language === 'te'
            ? 'దయచేసి పంటను ఎంచుకుని తరువాత విశ్లేషించండి.'
            : 'Please choose the crop first, then analyze.'
      )
      return
    }

    if (!selectedImage) {
      setError(ui.missingImage)
      return
    }

    setIsLoading(true)
    setUsedCachedResult(false)
    setError(null)

    try {
      const response = await detectDiseaseCached(selectedImage, selectedCrop)
      setResult(response.data)
      setUsedCachedResult(response.fromCache)
    } catch (err) {
      console.error('Disease detection failed:', err)
      setError(err instanceof Error && err.message ? err.message : ui.failed)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-emerald-50 to-white py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-2xl mb-4">
            <Stethoscope className="h-8 w-8 text-emerald-700" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2">{ui.title}</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">{ui.subtitle}</p>
        </div>

        {error && (
          <div className="max-w-3xl mx-auto mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-100">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-gray-800 mb-2">{ui.uploadTitle}</h2>
              <p className="text-sm text-gray-500">{ui.uploadHint}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'hi' ? 'फसल चुनें' : language === 'te' ? 'పంట ఎంచుకోండి' : 'Choose Crop'}
              </label>
              <select
                value={selectedCrop}
                onChange={(event) => {
                  setSelectedCrop(event.target.value)
                  setError(null)
                }}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">
                  {language === 'hi' ? 'फसल चुनें' : language === 'te' ? 'పంట ఎంచుకోండి' : 'Select crop'}
                </option>
                {SUPPORTED_CROPS.map((crop) => (
                  <option key={crop} value={crop}>
                    {crop}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-500">
                {language === 'hi'
                  ? 'नोट: वर्तमान मॉडल केवल इन समर्थित फसलों के लिए प्रशिक्षित है।'
                  : language === 'te'
                    ? 'గమనిక: ప్రస్తుత మోడల్ ఈ మద్దతు ఉన్న పంటలకే శిక్షణ పొందింది.'
                    : 'Note: current model is trained only for these supported crops.'}
              </p>
            </div>

            <div className="border-2 border-dashed border-emerald-200 rounded-2xl p-6 text-center bg-emerald-50/50">
              <ImagePlus className="h-12 w-12 text-emerald-500 mb-3 mx-auto" />
              <span className="text-base font-semibold text-gray-700 block">{ui.chooseImage}</span>
              <span className="mt-1 text-sm text-gray-500 block">{selectedImage?.name || 'JPG, PNG, JPEG'}</span>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="rounded-xl bg-white border border-emerald-200 px-4 py-3 text-emerald-700 font-medium hover:bg-emerald-100 transition-colors"
                >
                  {ui.chooseImage}
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-white font-medium hover:bg-emerald-700 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <Camera className="h-4 w-4" />
                  <span>{language === 'hi' ? 'कैमरा खोलें' : language === 'te' ? 'కెమెరా తెరవండి' : 'Use Camera'}</span>
                </button>
              </div>

              <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleSelectImage} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleSelectImage} />
            </div>

            {previewUrl && (
              <div className="mt-6">
                <img
                  src={previewUrl}
                  alt="Leaf preview"
                  className="w-full max-h-80 object-contain rounded-2xl border border-gray-200 bg-gray-50"
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isLoading || !selectedImage}
              className={cn(
                'mt-6 w-full py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center space-x-2',
                isLoading || !selectedImage
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg hover:shadow-xl'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{ui.analyzing}</span>
                </>
              ) : (
                <>
                  <Leaf className="h-5 w-5" />
                  <span>{ui.analyze}</span>
                </>
              )}
            </button>
          </div>

          <div>
            {result ? (
              <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 mb-6">{ui.result}</h2>

                {usedCachedResult && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {language === 'hi'
                      ? 'ऑफलाइन या नेटवर्क समस्या के कारण कैश की गई रोग पहचान दिखाई जा रही है।'
                      : language === 'te'
                        ? 'ఆఫ్లైన్ లేదా నెట్‌వర్క్ సమస్య కారణంగా క్యాష్ చేసిన రోగ గుర్తింపును చూపిస్తున్నాం.'
                        : 'Showing cached disease detection because you are offline or the network request failed.'}
                  </div>
                )}

                <div className={cn(
                  'mb-6 rounded-2xl border p-5',
                  result.healthy ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
                )}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-gray-500">{ui.crop}</p>
                      <h3 className="text-2xl font-bold text-gray-800 mt-1">{result.crop}</h3>
                      <p className="mt-3 text-sm text-gray-500">{result.healthy ? ui.healthy : ui.disease}</p>
                      <p className="text-lg font-semibold text-gray-800">
                        {result.healthy ? ui.healthyLeaf : result.disease}
                      </p>
                    </div>
                    <div className={cn(
                      'rounded-xl px-4 py-3 min-w-32 text-center',
                      result.healthy ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    )}>
                      <p className="text-xs uppercase tracking-wide">{ui.confidence}</p>
                      <p className="text-2xl font-bold">{result.confidence}%</p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="font-semibold text-gray-800 mb-2">{ui.summary}</h4>
                  <p className="text-gray-600">{result.summary}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <h4 className="font-semibold text-emerald-800 mb-3">{ui.actions}</h4>
                    <ul className="space-y-2 text-sm text-emerald-700">
                      {result.immediate_actions.map((item, index) => (
                        <li key={index} className="flex gap-2">
                          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <h4 className="font-semibold text-blue-800 mb-3">{ui.prevention}</h4>
                    <ul className="space-y-2 text-sm text-blue-700">
                      {result.prevention_tips.map((item, index) => (
                        <li key={index} className="flex gap-2">
                          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="font-semibold text-gray-800 mb-3">{ui.alternatives}</h4>
                  <div className="space-y-3">
                    {result.top_predictions.map((item, index) => (
                      <div key={`${item.label}-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-gray-800">{item.crop}</p>
                          <p className="text-sm text-gray-500">{item.healthy ? ui.healthyLeaf : item.disease}</p>
                        </div>
                        <span className="text-sm font-semibold text-gray-700">{item.confidence}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <FeedbackWidget
                  feature="disease"
                  subject={`${result.crop} | ${result.healthy ? 'healthy' : result.disease}`}
                  metadata={{
                    selectedCrop,
                    crop: result.crop,
                    disease: result.disease,
                    healthy: result.healthy,
                    confidence: result.confidence,
                    usedCachedResult,
                  }}
                />
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 h-full flex flex-col items-center justify-center text-center">
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                  <Leaf className="h-12 w-12 text-emerald-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">{ui.emptyTitle}</h3>
                <p className="text-gray-500 max-w-sm">{ui.emptyText}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
