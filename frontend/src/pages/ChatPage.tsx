import { useState, useEffect, useRef } from 'react'
import { Send, Mic, MicOff, Bot, User, Loader2, Sprout, History, X, MapPin, Trash2, Volume2, Square, AlertCircle, ImagePlus, Camera } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { useTextToSpeech } from '@/hooks/useTextToSpeech'
import {
  sendChatMessage,
  detectDisease,
  getCurrentPosition,
  getDetailedLocationFromCoords,
  getWeatherByCoords,
  getWeatherByLocation,
  quickAction,
  getStates,
  getDistricts,
  getCropInfo,
  getFertilizerInfo,
  getFertilizerRecommendations,
  listChatConversations,
  getChatConversation,
  createChatConversation,
  saveChatConversation,
  deleteChatConversation,
  type ConversationSummary,
  type ConversationMessage,
  type DiseaseDetectionResponse
} from '@/services/api'
import { loadChatHistory, saveChatHistory, getLastVisit, getLastTopic, formatLastVisit, startNewChatSession } from '@/utils/chatStorage'
import { rankRecommendations } from '@/utils/recommendationRanking'
import { cn } from '@/utils/cn'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  data?: Record<string, unknown>
}

interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface UserLocationInfo {
  lat: number
  lon: number
  name: string
  state?: string
  district?: string
}

interface ChatSummaryItem {
  id: string
  label: string
  firstMessage: string
  updatedAt: Date
}

interface CropResultSnapshot {
  location: string
  soil: { n: number | string; p: number | string; k: number | string }
  crops: Array<{ crop: string; confidence: number }>
}

function toStoredMessage(msg: Message): StoredMessage {
  return { id: msg.id, role: msg.role, content: msg.content, timestamp: msg.timestamp.toISOString() }
}

function fromStoredMessage(msg: StoredMessage): Message {
  return { id: msg.id, role: msg.role, content: msg.content, timestamp: new Date(msg.timestamp) }
}

// Detect if message is weather-related
function isWeatherQuery(message: string): boolean {
  const text = message.toLowerCase()
  const weatherKeywords = [
    'weather',
    '\u092e\u094c\u0938\u092e',
    'mausam',
    '\u0c35\u0c3e\u0c24\u0c3e\u0c35\u0c30\u0c23\u0c02',
    'rain',
    '\u092c\u093e\u0930\u093f\u0936',
    'barish',
    '\u0c35\u0c30\u0c4d\u0c37\u0c02',
    'temperature',
    '\u0924\u093e\u092a\u092e\u093e\u0928',
    'tapman',
    '\u0c09\u0c37\u0c4d\u0c23\u0c4b\u0c17\u0c4d\u0c30\u0c24',
    'forecast',
    'humidity',
    '\u0928\u092e\u0940',
    '\u0c06\u0c30\u0c4d\u0c26\u0c4d\u0c30\u0c24',
    'wind',
    '\u0939\u0935\u093e'
  ]
  return weatherKeywords.some((kw) => text.includes(kw))
}

// Detect if message is crop-related
function isCropQuery(message: string): boolean {
  const text = message.toLowerCase()
  const cropKeywords = [
    'crop',
    '\u092b\u0938\u0932',
    'fasal',
    '\u0c2a\u0c02\u0c1f',
    'grow',
    'plant',
    'sow',
    'cultivation',
    '\u0916\u0947\u0924\u0940',
    'kheti',
    '\u0c15\u0c43\u0c37\u0c3f',
    'what should i grow',
    'kya ugaun',
    '\u0915\u094c\u0928 \u0938\u0940 \u092b\u0938\u0932',
    '\u0c0f \u0c2a\u0c02\u0c1f'
  ]
  if (cropKeywords.some((kw) => text.includes(kw))) return true
  if (text.includes('\u0909\u0917')) return true
  if (text.includes('\u0c2a\u0c02\u0c21\u0c3f\u0c02\u0c1a')) return true
  return false
}

function isCropGuideQuery(message: string): boolean {
  const text = message.toLowerCase()
  if (
    text.includes('which crops') ||
    text.includes('what crops') ||
    text.includes('best crops') ||
    text.includes('what should i grow') ||
    text.includes('right now')
  ) {
    return false
  }
  return [
    'how to grow',
    'how do i grow',
    'how can i grow',
    'rice cultivation',
    'wheat cultivation',
    'cultivation of'
  ].some((k) => text.includes(k))
}

// Detect if message is fertilizer-related
function isFertilizerQuery(message: string): boolean {
  const text = message.toLowerCase()
  const fertKeywords = [
    'fertilizer',
    '\u092b\u0930\u094d\u091f\u093f\u0932\u093e\u0907\u091c\u0930',
    '\u0916\u093e\u0926',
    'khad',
    '\u0909\u0930\u094d\u0935\u0930\u0915',
    'urvarak',
    'urea',
    'dap',
    'npk',
    'nutrient',
    '\u092a\u094b\u0937\u0915',
    '\u0c0e\u0c30\u0c41\u0c35\u0c41',
    '\u0c2b\u0c30\u0c4d\u0c1f\u0c3f\u0c32\u0c48\u0c1c\u0c30',
    'manure'
  ]
  return fertKeywords.some((kw) => text.includes(kw))
}

function isFertilizerGuideQuery(message: string): boolean {
  const text = message.toLowerCase()
  return [
    'how to apply',
    'how to use',
    'how do i apply',
    'how do i use',
    'application of',
    'dose of',
    'dosage of'
  ].some((k) => text.includes(k)) && isFertilizerQuery(message)
}

// Detect if message is asking for current location
function isLocationQuery(message: string): boolean {
  const text = message.toLowerCase()
  const locationKeywords = [
    'current location',
    'my location',
    'where am i',
    'where is my location',
    'where is my current location',
    'mera location',
    'meri location',
    'kahan hoon'
  ]
  return locationKeywords.some(kw => text.includes(kw))
}

function isConfidenceFollowupQuery(message: string): boolean {
  const text = message.toLowerCase()
  const keys = ['confidence', 'percent', '%', 'good?', 'is 33', 'kitna', 'vishwas', 'nammakam']
  return keys.some((k) => text.includes(k))
}

function sanitizeGroqAdvisory(text: string): string {
  return text
    .replace(/\b\d+(\.\d+)?\s*%/g, '')
    .replace(/confidence/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function compactAdvisory(text: string, maxChars = 420): string {
  const clean = text
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (clean.length <= maxChars) return clean
  return `${clean.slice(0, maxChars - 3).trim()}...`
}

function stripBoldMarkers(text: string): string {
  return text.replace(/\*\*/g, '')
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function getMessageImagePreview(message: Message): string | null {
  const value = message.data?.imagePreviewUrl
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function normalizeLocationSpelling(value: string): string {
  const aliasMap: Record<string, string> = {
    gujrat: 'gujarat',
    telengana: 'telangana',
    bengaluru: 'bangalore',
    delhi: 'delhi'
  }
  const lowered = value.trim().toLowerCase()
  return aliasMap[lowered] || lowered
}

function formatLocationLabel(value: string): string {
  return value.replace(/\s*,\s*$/g, '').replace(/\s{2,}/g, ' ').trim()
}

function getForecastOffset(message: string): number {
  const text = message.toLowerCase()
  if (text.includes('day after tomorrow') || text.includes('parso') || text.includes('\u092a\u0930\u0938\u094b\u0902')) return 2
  if (text.includes('tomorrow') || text.includes('kal') || text.includes('\u0915\u0932') || text.includes('\u0c30\u0c47\u0c2a\u0c41')) return 1
  const match = text.match(/\b(\d+)\s*day[s]?\b/)
  if (match?.[1]) {
    const day = Number(match[1])
    if (!Number.isNaN(day)) return Math.max(0, Math.min(day, 6))
  }
  return 0
}

function formatDiseaseDetectionMessage(result: DiseaseDetectionResponse, language: string): string {
  if (language === 'hi') {
    return [
      `रोग पहचान परिणाम`,
      ``,
      `फसल: ${result.crop}`,
      `स्थिति: ${result.healthy ? 'स्वस्थ पत्ती' : result.disease}`,
      `विश्वास: ${result.confidence}%`,
      ``,
      `${result.summary}`,
      ``,
      `तुरंत क्या करें:`,
      ...result.immediate_actions.map((item) => `- ${item}`),
      ``,
      `बचाव के उपाय:`,
      ...result.prevention_tips.map((item) => `- ${item}`)
    ].join('\n')
  }

  if (language === 'te') {
    return [
      `రోగ గుర్తింపు ఫలితం`,
      ``,
      `పంట: ${result.crop}`,
      `స్థితి: ${result.healthy ? 'ఆరోగ్యకరమైన ఆకు' : result.disease}`,
      `నమ్మకం: ${result.confidence}%`,
      ``,
      `${result.summary}`,
      ``,
      `వెంటనే చేయాల్సినవి:`,
      ...result.immediate_actions.map((item) => `- ${item}`),
      ``,
      `నివారణ చిట్కాలు:`,
      ...result.prevention_tips.map((item) => `- ${item}`)
    ].join('\n')
  }

  return [
    `Disease Detection Result`,
    ``,
    `Crop: ${result.crop}`,
    `Prediction: ${result.healthy ? 'Healthy leaf' : result.disease}`,
    `Confidence: ${result.confidence}%`,
    ``,
    `${result.summary}`,
    ``,
    `Immediate actions:`,
    ...result.immediate_actions.map((item) => `- ${item}`),
    ``,
    `Prevention tips:`,
    ...result.prevention_tips.map((item) => `- ${item}`)
  ].join('\n')
}

export function ChatPage() {
  const { t, language } = useLanguage()
  const uiByLanguage = {
    en: {
      weatherIn: 'Weather in',
      temp: 'Temperature',
      humidity: 'Humidity',
      wind: 'Wind',
      condition: 'Condition',
      advisory: 'Farming Advisory',
      recommendedCropsFor: 'Recommended Crops for',
      basedOnSoil: 'Based on soil',
      needLocation: 'For accurate crop recommendations, please share your state/district.',
      askCrop: 'Which crop do you need fertilizer advice for? Supported: paddy/rice, wheat, maize, cotton, sugarcane, groundnut, barley, millets, oilseeds, tobacco, pulses.',
      unsupportedCrop: 'Fertilizer data for "{crop}" is not available yet.',
      fertilizerFor: 'Fertilizer Recommendations for',
      dosage: 'Dosage',
      application: 'Application',
      lastTopic: 'Last topic',
      detectingLocation: 'Detecting location...',
      voiceProcessing: 'Processing voice...',
      voiceInputUnsupported: 'Voice input is not available on this browser. You can continue by typing.',
      voicePermissionDenied: 'Microphone permission was denied. Please allow mic access in browser settings.',
      voiceNoSpeech: 'No speech detected. Please try again.',
      voiceMicUnavailable: 'Microphone is unavailable. Please check your device microphone.',
      voiceNetworkError: 'Voice service network error. Please try again.',
      voiceUnknownError: 'Voice input failed. Please try again.',
      speakingNow: 'Playing audio...',
      stopAudio: 'Stop audio',
      speakReply: 'Speak reply',
      stopReply: 'Stop reply',
      ttsUnsupported: 'Text-to-speech is not available on this device.',
      ttsFailed: 'Audio playback failed. Please try again.'
    },
    hi: {
      weatherIn: 'मौसम',
      temp: 'तापमान',
      humidity: 'नमी',
      wind: 'हवा',
      condition: 'स्थिति',
      advisory: 'खेती सलाह',
      recommendedCropsFor: 'अनुशंसित फसलें',
      basedOnSoil: 'मिट्टी के आधार पर',
      needLocation: 'सही फसल सलाह के लिए कृपया अपना राज्य/जिला बताएं।',
      askCrop: 'किस फसल के लिए खाद सलाह चाहिए? समर्थित फसलें: धान/चावल, गेहूं, मक्का, कॉटन/कपास, गन्ना, मूंगफली, जौ, मिलेट्स, तिलहन, तंबाकू, दलहन।',
      unsupportedCrop: '"{crop}" के लिए अभी उर्वरक डेटा उपलब्ध नहीं है।',
      fertilizerFor: 'उर्वरक सिफारिशें',
      dosage: 'मात्रा',
      application: 'प्रयोग विधि',
      lastTopic: 'पिछला विषय',
      detectingLocation: 'स्थान पता किया जा रहा है...',
      voiceProcessing: 'आवाज़ प्रोसेस हो रही है...',
      voiceInputUnsupported: 'इस ब्राउज़र में वॉइस इनपुट उपलब्ध नहीं है। आप टाइप करके जारी रख सकते हैं।',
      voicePermissionDenied: 'माइक्रोफोन अनुमति नहीं मिली। कृपया ब्राउज़र सेटिंग्स में अनुमति दें।',
      voiceNoSpeech: 'कोई आवाज़ नहीं मिली। कृपया फिर कोशिश करें।',
      voiceMicUnavailable: 'माइक्रोफोन उपलब्ध नहीं है। कृपया डिवाइस माइक्रोफोन जांचें।',
      voiceNetworkError: 'वॉइस सेवा में नेटवर्क त्रुटि हुई। कृपया फिर कोशिश करें।',
      voiceUnknownError: 'वॉइस इनपुट विफल हुआ। कृपया फिर कोशिश करें।',
      speakingNow: 'ऑडियो चल रहा है...',
      stopAudio: 'ऑडियो रोकें',
      speakReply: 'उत्तर सुनें',
      stopReply: 'उत्तर रोकें',
      ttsUnsupported: 'इस डिवाइस पर टेक्स्ट-टू-स्पीच उपलब्ध नहीं है।',
      ttsFailed: 'ऑडियो चलाने में समस्या हुई। कृपया फिर कोशिश करें।'
    },
    te: {
      weatherIn: 'వాతావరణం',
      temp: 'ఉష్ణోగ్రత',
      humidity: 'ఆర్ద్రత',
      wind: 'గాలి వేగం',
      condition: 'స్థితి',
      advisory: 'వ్యవసాయ సలహా',
      recommendedCropsFor: 'సిఫార్సు చేసిన పంటలు',
      basedOnSoil: 'మట్టి ఆధారంగా',
      needLocation: 'ఖచ్చితమైన పంట సిఫార్సుల కోసం మీ రాష్ట్రం/జిల్లా చెప్పండి.',
      askCrop: 'ఎలాంటి పంటకు ఎరువు సలహా కావాలి? మద్దతు ఉన్న పంటలు: వరి, గోధుమ, మొక్కజొన్న, పత్తి, చెరకు, వేరుశెనగ, బార్లీ, మిల్లెట్స్, ఆయిల్ సీడ్స్, పొగాకు, పప్పుధాన్యాలు.',
      unsupportedCrop: '"{crop}" కోసం ప్రస్తుతం ఎరువు డేటా అందుబాటులో లేదు.',
      fertilizerFor: 'ఎరువు సిఫార్సులు',
      dosage: 'మోతాదు',
      application: 'వినియోగ విధానం',
      lastTopic: 'గత విషయం',
      detectingLocation: 'లొకేషన్ గుర్తిస్తున్నాం...',
      voiceProcessing: 'వాయిస్ ప్రాసెస్ అవుతోంది...',
      voiceInputUnsupported: 'ఈ బ్రౌజర్‌లో వాయిస్ ఇన్‌పుట్ అందుబాటులో లేదు. టైప్ చేసి కొనసాగండి.',
      voicePermissionDenied: 'మైక్రోఫోన్ అనుమతి నిరాకరించబడింది. బ్రౌజర్ సెట్టింగ్స్‌లో అనుమతించండి.',
      voiceNoSpeech: 'మాట వినిపించలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.',
      voiceMicUnavailable: 'మైక్రోఫోన్ అందుబాటులో లేదు. డివైస్ మైక్రోఫోన్‌ను తనిఖీ చేయండి.',
      voiceNetworkError: 'వాయిస్ సేవలో నెట్‌వర్క్ లోపం వచ్చింది. మళ్లీ ప్రయత్నించండి.',
      voiceUnknownError: 'వాయిస్ ఇన్‌పుట్ విఫలమైంది. మళ్లీ ప్రయత్నించండి.',
      speakingNow: 'ఆడియో ప్లే అవుతోంది...',
      stopAudio: 'ఆపు',
      speakReply: 'సమాధానం వినండి',
      stopReply: 'ఆపండి',
      ttsUnsupported: 'ఈ డివైస్‌లో టెక్స్ట్-టు-స్పీచ్ అందుబాటులో లేదు.',
      ttsFailed: 'ఆడియో ప్లే కాలేదు. మళ్లీ ప్రయత్నించండి.'
    }
  } as const
  const ui = uiByLanguage[language as keyof typeof uiByLanguage] || uiByLanguage.en
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showWelcomeBack, setShowWelcomeBack] = useState(false)
  const [lastTopic, setLastTopic] = useState<string | null>(null)
  const [lastVisitText, setLastVisitText] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<UserLocationInfo | null>(null)
  const [knownStates, setKnownStates] = useState<string[]>([])
  const [districtLookup, setDistrictLookup] = useState<Array<{ district: string; state: string }>>([])
  const [currentUser, setCurrentUser] = useState<{ name?: string } | null>(null)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [conversationList, setConversationList] = useState<ConversationSummary[]>([])
  const [mobileChatsOpen, setMobileChatsOpen] = useState(false)
  const [awaitingFertilizerCrop, setAwaitingFertilizerCrop] = useState(false)
  const [lastCropResult, setLastCropResult] = useState<CropResultSnapshot | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const hasLoadedHistory = useRef(false)

  const {
    isListening,
    status: voiceStatus,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: voiceSupported,
    error: voiceError,
    clearError: clearVoiceError
  } = useVoiceInput()
  const {
    isSpeaking,
    isSupported: ttsSupported,
    error: ttsError,
    speak,
    stop: stopSpeaking,
    clearError: clearTtsError
  } = useTextToSpeech()
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)

  // Get user info from localStorage
  const getUserInfo = () => {
    try {
      const stored = localStorage.getItem('kisaannavi_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  const getToken = () => {
    try {
      return localStorage.getItem('kisaannavi_token')
    } catch {
      return null
    }
  }

  const isLoggedIn = () => Boolean(getUserInfo() && getToken())

  const welcomeMessage = (user: { name?: string } | null) => ({
    id: 'welcome',
    role: 'assistant' as const,
    content: user?.name ? `${t.chat.welcome} ${user.name}!` : t.chat.welcome,
    timestamp: new Date()
  })

  useEffect(() => {
    if (hasLoadedHistory.current) return
    hasLoadedHistory.current = true

    const user = getUserInfo()
    setCurrentUser(user)

    if (!user || !getToken()) {
      if (!user) {
        setMessages([welcomeMessage(null)])
        setShowWelcomeBack(false)
        return
      }

      const storedMessages = loadChatHistory()
      const lastVisit = getLastVisit()
      const topic = getLastTopic()

      if (storedMessages.length > 0 && lastVisit) {
        setLastTopic(topic)
        setLastVisitText(formatLastVisit(lastVisit, language))
        setShowWelcomeBack(true)
        setMessages(storedMessages.map(fromStoredMessage))
      } else {
        setMessages([welcomeMessage(user)])
      }
      return
    }

    const loadServerConversations = async () => {
      try {
        const list = await listChatConversations()
        setConversationList(list)

        if (list.length === 0) {
          const created = await createChatConversation()
          setActiveConversationId(created.id)
          setConversationList([created])
          setMessages([welcomeMessage(user)])
          setShowWelcomeBack(false)
          return
        }

        const latest = list[0]
        setActiveConversationId(latest.id)
        const detail = await getChatConversation(latest.id)
        const serverMessages = detail.messages.map((m) => ({
          id: `${new Date(m.timestamp).getTime()}-${Math.random().toString(36).slice(2, 6)}`,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp)
        }))

        if (serverMessages.length > 0) {
          setMessages(serverMessages)
          const lastVisit = new Date(latest.updated_at)
          setLastVisitText(formatLastVisit(lastVisit, language))
          const latestUserMessage = [...serverMessages].reverse().find((m) => m.role === 'user')
          setLastTopic(latestUserMessage?.content || null)
          setShowWelcomeBack(true)
        } else {
          setMessages([welcomeMessage(user)])
          setShowWelcomeBack(false)
        }
      } catch {
        const fallbackHistory = loadChatHistory()
        setMessages(fallbackHistory.length ? fallbackHistory.map(fromStoredMessage) : [welcomeMessage(user)])
      }
    }

    loadServerConversations()
  }, [t.chat.welcome, language])

  useEffect(() => {
    if (!hasLoadedHistory.current) return
    if (!isLoggedIn()) {
      if (!currentUser) return
      if (messages.length === 0) return
      if (messages.length === 1 && messages[0].id === 'welcome') return
      saveChatHistory(messages.map(toStoredMessage))
      return
    }
    if (!activeConversationId) return
    if (messages.length === 0) return
 
    const timeout = window.setTimeout(async () => {
      try {
        const serverMessages: ConversationMessage[] = messages
          .filter((msg) => msg.id !== 'welcome')
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp.toISOString()
          }))

        const firstUserMessage = serverMessages.find((m) => m.role === 'user')?.content
        const updated = await saveChatConversation(activeConversationId, {
          title: firstUserMessage || undefined,
          messages: serverMessages
        })
        setConversationList((prev) => {
          const withoutCurrent = prev.filter((item) => item.id !== updated.id)
          return [updated, ...withoutCurrent]
        })
      } catch (error) {
        console.error('Failed to sync conversation:', error)
      }
    }, 450)

    return () => window.clearTimeout(timeout)
  }, [messages, currentUser, activeConversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (transcript) {
      setInput(transcript)
      if (voiceError) clearVoiceError()
    }
  }, [transcript, voiceError, clearVoiceError])

  useEffect(() => {
    if (!isSpeaking && speakingMessageId) {
      setSpeakingMessageId(null)
    }
  }, [isSpeaking, speakingMessageId])

  useEffect(() => {
    const loadStates = async () => {
      try {
        const response = await getStates()
        const states = response.states || []
        setKnownStates(states)

        const districtResults = await Promise.all(
          states.map(async (state) => {
            try {
              const districtsResponse = await getDistricts(state)
              return (districtsResponse.districts || []).map((district) => ({ district, state }))
            } catch {
              return []
            }
          })
        )
        setDistrictLookup(districtResults.flat())
      } catch {
        setKnownStates([])
        setDistrictLookup([])
      }
    }
    loadStates()
  }, [])

  const dismissWelcomeBack = () => setShowWelcomeBack(false)

  const continueLastTopic = () => {
    if (lastTopic) {
      setInput(lastTopic)
      inputRef.current?.focus()
    }
    setShowWelcomeBack(false)
  }

  const startFresh = async () => {
    if (isLoggedIn()) {
      try {
        const created = await createChatConversation()
        setActiveConversationId(created.id)
        setConversationList((prev) => [created, ...prev])
      } catch (error) {
        console.error('Failed to create new conversation:', error)
      }
    } else {
      startNewChatSession()
    }
    setMessages([welcomeMessage(currentUser)])
    setLastTopic(null)
    setLastVisitText(null)
    setShowWelcomeBack(false)
  }

  const detectLocation = async (): Promise<UserLocationInfo | null> => {
    if (userLocation) return userLocation
    
    setLocationLoading(true)
    try {
      const position = await getCurrentPosition()
      const { latitude, longitude } = position.coords
      const locInfo = await getDetailedLocationFromCoords(latitude, longitude)
      
      const loc: UserLocationInfo = {
        lat: latitude,
        lon: longitude,
        name: locInfo.displayName,
        state: locInfo.state || undefined,
        district: locInfo.district || undefined
      }
      setUserLocation(loc)
      return loc
    } catch (err) {
      console.error('Location error:', err)
      return null
    } finally {
      setLocationLoading(false)
    }
  }

  const hasHereReference = (message: string) => {
    const text = message.toLowerCase()
    return ['here', 'this area', 'my area', 'yahan', 'yahaan', 'idhar', 'ikkada'].some(k => text.includes(k))
  }

  const getExplicitLocationLabel = (message: string): string | null => {
    const text = message.toLowerCase()
    if (text.includes('new delhi') || text.includes('nct delhi') || text.includes('delhi')) return 'Delhi'
    const inMatch = text.match(/\b(?:in|at|for)\s+([a-z][a-z\s-]{1,40})/)
    if (!inMatch?.[1]) return null
    const candidate = normalizeLocationSpelling(inMatch[1]).trim().replace(/\s+/g, ' ')
    if (candidate.length < 3) return null
    return candidate
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  const extractLocationFromMessage = async (message: string): Promise<{ state: string; district: string }> => {
    let text = message.toLowerCase()
    text = text.replace(/\bgujrat\b/g, 'gujarat').replace(/\btelengana\b/g, 'telangana')

    if (!knownStates.length) return { state: '', district: '' }

    const matchedState = [...knownStates]
      .sort((a, b) => b.length - a.length)
      .find((s) => text.includes(s.toLowerCase()))

    if (!matchedState) {
      const matchedDistrict = [...districtLookup]
        .sort((a, b) => b.district.length - a.district.length)
        .find((entry) => text.includes(entry.district.toLowerCase()))

      if (matchedDistrict) {
        return { state: matchedDistrict.state, district: matchedDistrict.district }
      }
      return { state: '', district: '' }
    }

    try {
      const response = await getDistricts(matchedState)
      const districts = response.districts || []
      const matchedDistrict = [...districts]
        .sort((a, b) => b.length - a.length)
        .find((d) => text.includes(d.toLowerCase()))

      return {
        state: matchedState,
        district: matchedDistrict || ''
      }
    } catch {
      return { state: matchedState, district: '' }
    }
  }

  const getLocationContextForMessage = async (message: string): Promise<{ state: string; district: string; unavailableLocation?: string }> => {
    const explicitLocation = getExplicitLocationLabel(message)
    const explicit = await extractLocationFromMessage(message)
    if (explicit.state) return explicit
    if (explicitLocation) return { state: '', district: '', unavailableLocation: explicitLocation }

    if (hasHereReference(message)) {
      const live = await detectLocation()
      if (live) {
        const liveState = normalizeLocationSpelling(live.state || '')
        if (liveState) {
          const matchedState = knownStates.find((s) => {
            const a = s.toLowerCase()
            return a === liveState || a.includes(liveState) || liveState.includes(a)
          })
          if (matchedState) {
            return { state: matchedState, district: live.district || '' }
          }
        }

        if (live.district) {
          const matchedDistrict = districtLookup.find(
            (entry) => entry.district.toLowerCase() === live.district?.toLowerCase()
          )
          if (matchedDistrict) {
            return { state: matchedDistrict.state, district: matchedDistrict.district }
          }
        }

        const label = live.state || live.name.split(',')[0] || 'your location'
        return { state: '', district: '', unavailableLocation: label }
      }
      return { state: '', district: '', unavailableLocation: 'your location' }
    }

    const user = getUserInfo()
    let state = userLocation?.state || user?.state || ''
    let district = userLocation?.district || user?.district || ''

    if (!state) {
      const loc = await detectLocation()
      if (loc?.state) state = loc.state
      if (loc?.district) district = loc.district
    }

    return { state, district }
  }

  const extractFertilizerCrop = (message: string): string | null => {
    const text = message.toLowerCase().trim()
    const aliases: Array<{ crop: string; keys: string[] }> = [
      { crop: 'rice', keys: ['rice', 'paddy', 'धान', 'चावल', 'vari', 'వరి', 'dhaan'] },
      { crop: 'wheat', keys: ['wheat', 'गेहूं', 'गेहू', 'gehu', 'godhuma', 'గోధుమ'] },
      { crop: 'maize', keys: ['maize', 'corn', 'मक्का', 'makka', 'mokkajonna', 'మొక్కజొన్న'] },
      { crop: 'cotton', keys: ['cotton', 'कॉटन', 'कपास', 'kapas', 'patti', 'పత్తి'] },
      { crop: 'sugarcane', keys: ['sugarcane', 'गन्ना', 'ganna', 'cheruku', 'చెరకు'] },
      { crop: 'groundnut', keys: ['groundnut', 'ground nuts', 'peanut', 'मूंगफली', 'moongfali', 'verusenaga', 'వేరుశెనగ'] },
      { crop: 'soybean', keys: ['soybean', 'सोयाबीन', 'soyabean', 'సోయాబీన్'] },
      { crop: 'barley', keys: ['barley', 'जौ', 'yava', 'బార్లీ'] },
      { crop: 'millets', keys: ['millet', 'millets', 'बाजरा', 'ज्वार', 'रागी', 'sajje', 'jowar', 'ragi', 'సజ్జలు', 'జొన్న', 'రాగి'] },
      { crop: 'oilseeds', keys: ['oilseed', 'oil seeds', 'oilseeds', 'तिलहन', 'सरसों', 'mustard', 'sesame', 'నూనె గింజలు', 'ఆయిల్ సీడ్స్'] },
      { crop: 'tobacco', keys: ['tobacco', 'तंबाकू', 'పొగాకు'] },
      { crop: 'pulses', keys: ['pulses', 'दलहन', 'పప్పుధాన్యాలు'] },
      { crop: 'chickpea', keys: ['chickpea', 'chana', 'चना', 'bengal gram', 'senaga', 'సెనగ'] },
      { crop: 'pigeon pea', keys: ['pigeon pea', 'arhar', 'tur', 'अरहर', 'तूर', 'kandulu', 'తూర', 'కందులు'] },
      { crop: 'black gram', keys: ['black gram', 'urad', 'उड़द', 'minumu', 'మినుము'] },
      { crop: 'green gram', keys: ['green gram', 'moong', 'मूंग', 'pesara', 'పెసర'] },
      { crop: 'lentil', keys: ['lentil', 'masoor', 'मसूर', 'masur', 'మసూర్'] }
    ]

    for (const item of aliases) {
      if (item.keys.some((k) => text.includes(k))) return item.crop
    }
    return null
  }

  const extractDiseaseCrop = (message: string): string | null => {
    const text = message.toLowerCase().trim()
    const aliases: Array<{ crop: string; keys: string[] }> = [
      { crop: 'Apple', keys: ['apple', 'सेब', 'ఆపిల్'] },
      { crop: 'Bell pepper', keys: ['bell pepper', 'pepper', 'capsicum', 'शिमला मिर्च', 'कैप्सिकम', 'క్యాప్సికమ్', 'మిరప'] },
      { crop: 'Blueberry', keys: ['blueberry'] },
      { crop: 'Cherry', keys: ['cherry', 'चेरी'] },
      { crop: 'Corn', keys: ['corn', 'maize', 'मक्का', 'మొక్కజొన్న'] },
      { crop: 'Grape', keys: ['grape', 'अंगूर', 'ద్రాక్ష'] },
      { crop: 'Peach', keys: ['peach'] },
      { crop: 'Potato', keys: ['potato', 'आलू', 'బంగాళాదుంప'] },
      { crop: 'Raspberry', keys: ['raspberry'] },
      { crop: 'Soybean', keys: ['soybean', 'soyabean', 'सोयाबीन', 'సోయాబీన్'] },
      { crop: 'Squash', keys: ['squash'] },
      { crop: 'Strawberry', keys: ['strawberry'] },
      { crop: 'Tomato', keys: ['tomato', 'टमाटर', 'టమాటా'] }
    ]

    for (const item of aliases) {
      if (item.keys.some((k) => text.includes(k))) return item.crop
    }
    return null
  }

  const toFertilizerApiCrop = (crop: string): string => {
    const map: Record<string, string> = {
      rice: 'Paddy',
      wheat: 'Wheat',
      maize: 'Maize',
      cotton: 'Cotton',
      sugarcane: 'Sugarcane',
      groundnut: 'Ground Nuts',
      soybean: 'Oil seeds',
      barley: 'Barley',
      millets: 'Millets',
      oilseeds: 'Oil seeds',
      tobacco: 'Tobacco',
      pulses: 'Pulses',
      chickpea: 'Pulses',
      'pigeon pea': 'Pulses',
      'black gram': 'Pulses',
      'green gram': 'Pulses',
      lentil: 'Pulses'
    }
    return map[crop] || crop
  }

  const getDisplayCropName = (crop: string): string => {
    const key = crop.toLowerCase()
    const labels: Record<string, { en: string; hi: string; te: string }> = {
      rice: { en: 'Rice', hi: 'धान', te: 'వరి' },
      wheat: { en: 'Wheat', hi: 'गेहूं', te: 'గోధుమ' },
      maize: { en: 'Maize', hi: 'मक्का', te: 'మొక్కజొన్న' },
      cotton: { en: 'Cotton', hi: 'कॉटन', te: 'పత్తి' },
      sugarcane: { en: 'Sugarcane', hi: 'गन्ना', te: 'చెరకు' },
      groundnut: { en: 'Groundnut', hi: 'मूंगफली', te: 'వేరుశెనగ' },
      soybean: { en: 'Soybean', hi: 'सोयाबीन', te: 'సోయాబీన్' },
      barley: { en: 'Barley', hi: 'जौ', te: 'బార్లీ' },
      millets: { en: 'Millets', hi: 'मिलेट्स/बाजरा', te: 'మిల్లెట్స్' },
      oilseeds: { en: 'Oilseeds', hi: 'तिलहन', te: 'ఆయిల్ సీడ్స్' },
      tobacco: { en: 'Tobacco', hi: 'तंबाकू', te: 'పొగాకు' },
      pulses: { en: 'Pulses', hi: 'दलहन', te: 'పప్పుధాన్యాలు' },
      chickpea: { en: 'Chickpea', hi: 'चना', te: 'సెనగ' },
      'pigeon pea': { en: 'Pigeon pea', hi: 'अरहर', te: 'కందులు' },
      'black gram': { en: 'Black gram', hi: 'उड़द', te: 'మినుము' },
      'green gram': { en: 'Green gram', hi: 'मूंग', te: 'పెసర' },
      lentil: { en: 'Lentil', hi: 'मसूर', te: 'మసూర్' }
    }
    const entry = labels[key]
    if (!entry) return crop.charAt(0).toUpperCase() + crop.slice(1)
    return language === 'hi' ? entry.hi : language === 'te' ? entry.te : entry.en
  }

  const localizeFertilizerName = (name: string): string => {
    if (language === 'en') return name
    const map: Record<string, { hi: string; te: string }> = {
      urea: { hi: 'यूरिया', te: 'యూరియా' },
      dap: { hi: 'डीएपी', te: 'డిఏపీ' },
      ssp: { hi: 'एसएसपी', te: 'ఎస్‌ఎస్‌పి' },
      mop: { hi: 'एमओपी (पोटाश)', te: 'ఎంఓపీ (పోటాష్)' }
    }
    const key = name.trim().toLowerCase()
    const entry = map[key]
    if (!entry) return name
    return language === 'hi' ? entry.hi : entry.te
  }

  const localizeFertilizerText = (text: string): string => {
    if (language === 'en') return text
    const replacementsHi: Array<[RegExp, string]> = [
      [/As per soil test recommendation/gi, 'मिट्टी जांच की सिफारिश के अनुसार'],
      [/Apply as per crop requirement/gi, 'फसल की आवश्यकता के अनुसार प्रयोग करें'],
      [/Apply in 2-3 splits during crop growth/gi, 'फसल वृद्धि के दौरान 2-3 किस्तों में दें'],
      [/Apply at sowing as basal dose/gi, 'बुवाई के समय बेसल डोज के रूप में दें'],
      [/Apply at sowing or in 2 splits/gi, 'बुवाई के समय या 2 किस्तों में दें'],
      [/Apply at sowing, mix well with soil/gi, 'बुवाई के समय मिट्टी में अच्छी तरह मिलाकर दें']
    ]
    const replacementsTe: Array<[RegExp, string]> = [
      [/As per soil test recommendation/gi, 'మట్టి పరీక్ష సిఫార్సు ప్రకారం'],
      [/Apply as per crop requirement/gi, 'పంట అవసరానికి అనుగుణంగా వేయండి'],
      [/Apply in 2-3 splits during crop growth/gi, 'పంట పెరుగుదలలో 2-3 విడతల్లో వేయండి'],
      [/Apply at sowing as basal dose/gi, 'విత్తే సమయంలో బేసల్ డోస్‌గా వేయండి'],
      [/Apply at sowing or in 2 splits/gi, 'విత్తే సమయంలో లేదా 2 విడతల్లో వేయండి'],
      [/Apply at sowing, mix well with soil/gi, 'విత్తే సమయంలో మట్టితో బాగా కలిపి వేయండి']
    ]
    const pairs = language === 'hi' ? replacementsHi : replacementsTe
    let out = text
    for (const [pattern, replacement] of pairs) {
      out = out.replace(pattern, replacement)
    }
    return out
  }

  const extractFertilizerName = (message: string): string | null => {
    const text = message.toLowerCase().trim()
    const aliases: Array<{ name: string; keys: string[] }> = [
      { name: 'urea', keys: ['urea', 'यूरिया', 'युरिया', 'yuriya', 'యూరియా'] },
      { name: 'dap', keys: ['dap', 'डीएपी', 'di-ammonium phosphate', 'డిఏపీ'] },
      { name: 'mop', keys: ['mop', 'potash'] },
      { name: 'ssp', keys: ['ssp', 'single super phosphate'] },
      { name: 'npk', keys: ['npk', '20-20', '10-26-26', '14-35-14', '28-28', '17-17-17'] }
    ]

    for (const item of aliases) {
      if (item.keys.some((k) => text.includes(k))) return item.name
    }
    return null
  }

  const extractGuideCrop = (message: string): string | null => {
    const text = message.toLowerCase().trim()
    const patterns = [
      /how to grow\s+([a-z][a-z\s-]{1,30})/,
      /how do i grow\s+([a-z][a-z\s-]{1,30})/,
      /how can i grow\s+([a-z][a-z\s-]{1,30})/,
      /([a-z][a-z\s-]{1,30})\s+cultivation/
    ]
    for (const p of patterns) {
      const m = text.match(p)
      if (m?.[1]) return m[1].trim().split(' ')[0]
    }
    return extractFertilizerCrop(message)
  }

  const getVoiceErrorText = (errorCode: string | null): string | null => {
    if (!errorCode) return null
    if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') return ui.voicePermissionDenied
    if (errorCode === 'no-speech') return ui.voiceNoSpeech
    if (errorCode === 'audio-capture') return ui.voiceMicUnavailable
    if (errorCode === 'network') return ui.voiceNetworkError
    if (errorCode === 'unsupported') return ui.voiceInputUnsupported
    return ui.voiceUnknownError
  }

  const speakMessage = (message: Message) => {
    if (!ttsSupported) return

    if (isSpeaking && speakingMessageId === message.id) {
      stopSpeaking()
      setSpeakingMessageId(null)
      return
    }

    clearTtsError()
    setSpeakingMessageId(message.id)
    speak(stripBoldMarkers(message.content))
  }

  const voiceErrorText = getVoiceErrorText(voiceError)
  const ttsErrorText = ttsError
    ? (ttsError === 'unsupported' ? ui.ttsUnsupported : ui.ttsFailed)
    : null

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return

    if (isSpeaking) {
      stopSpeaking()
      setSpeakingMessageId(null)
    }
    if (isListening || voiceStatus === 'processing') {
      stopListening()
    }

    const queuedImage = selectedImage
    let queuedImagePreview: string | null = null
    if (queuedImage) {
      try {
        queuedImagePreview = await fileToDataUrl(queuedImage)
      } catch (error) {
        console.warn('Could not create image preview for chat message:', error)
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim() || (queuedImage ? `Analyze this leaf image: ${queuedImage.name}` : ''),
      timestamp: new Date(),
      data: queuedImagePreview ? { type: 'leaf_image', imagePreviewUrl: queuedImagePreview } : undefined
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setSelectedImage(null)
    resetTranscript()
    setIsLoading(true)
    setShowWelcomeBack(false)

    try {
      if (isConfidenceFollowupQuery(userMessage.content) && lastCropResult?.crops?.length) {
        const top1 = lastCropResult.crops[0]
        const { highConfidence } = rankRecommendations(lastCropResult.crops, {
          getId: (item) => item.crop,
          getScore: (item) => item.confidence
        })
        const confidenceReply = language === 'hi'
          ? highConfidence
            ? `${lastCropResult.location} की स्थितियों के हिसाब से ${top1.crop} सबसे मजबूत विकल्प है, इसलिए 2 स्पष्ट सिफारिशें दी गई हैं।`
            : `${lastCropResult.location} के लिए कई विकल्प करीब-करीब समान हैं, इसलिए सुरक्षित निर्णय के लिए 3 फसल विकल्प दिए गए हैं।`
          : language === 'te'
            ? highConfidence
              ? `${lastCropResult.location} పరిస్థితులకు ${top1.crop} బలమైన ఎంపికగా ఉంది, అందుకే 2 స్పష్టమైన సిఫార్సులు ఇచ్చాం.`
              : `${lastCropResult.location} కోసం అనేక ఎంపికలు దగ్గరగా ఉన్నాయి, కాబట్టి సురక్షిత నిర్ణయానికి 3 పంట ఎంపికలు ఇచ్చాం.`
            : highConfidence
              ? `For your current input, the recommendation is strong. For ${lastCropResult.location}, ${top1.crop} is the primary option with one solid alternative.`
              : `For your current input, multiple crops are similarly suitable, so we shared 3 options for ${lastCropResult.location}. Finalize using water, weather, and market conditions.`
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: confidenceReply,
          timestamp: new Date()
        }])
        setIsLoading(false)
        return
      }

      if (queuedImage) {
        const expectedCrop = extractDiseaseCrop(userMessage.content)
        if (!expectedCrop) {
          const note = language === 'hi'
            ? 'बेहतर परिणाम के लिए फोटो के साथ फसल का नाम भी लिखें। समर्थित फसलें: Apple, Bell pepper, Blueberry, Cherry, Corn, Grape, Peach, Potato, Raspberry, Soybean, Squash, Strawberry, Tomato.'
            : language === 'te'
              ? 'మంచి ఫలితానికి ఫోటోతో పాటు పంట పేరును కూడా రాయండి. మద్దతు ఉన్న పంటలు: Apple, Bell pepper, Blueberry, Cherry, Corn, Grape, Peach, Potato, Raspberry, Soybean, Squash, Strawberry, Tomato.'
              : 'For reliable disease detection, include the crop name with the photo. Supported crops: Apple, Bell pepper, Blueberry, Cherry, Corn, Grape, Peach, Potato, Raspberry, Soybean, Squash, Strawberry, Tomato.'

          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: note,
            timestamp: new Date()
          }])
          setIsLoading(false)
          return
        }

        const result = await detectDisease(queuedImage, expectedCrop)
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: formatDiseaseDetectionMessage(result, language),
          timestamp: new Date(),
          data: {
            type: 'disease_detection',
            label: result.label,
            disease: result.disease,
            crop: result.crop,
            confidence: result.confidence
          }
        }])
        setIsLoading(false)
        return
      }

      // Check if this is a weather query
      if (isWeatherQuery(userMessage.content) && !isCropQuery(userMessage.content) && !isFertilizerQuery(userMessage.content)) {
        const forecastOffset = getForecastOffset(userMessage.content)
        const explicit = await extractLocationFromMessage(userMessage.content)
        const explicitLabel = explicit.district || explicit.state || getExplicitLocationLabel(userMessage.content)

        try {
          let weatherData
          if (explicitLabel) {
            weatherData = await getWeatherByLocation(explicitLabel)
          } else {
            const location = await detectLocation()
            if (!location) {
              throw new Error('Location unavailable')
            }
            weatherData = await getWeatherByCoords(location.lat, location.lon, location.name)
          }
          const weatherLocation = formatLocationLabel(weatherData.location || '')

          const forecastTarget = forecastOffset > 0 ? weatherData.forecast?.[forecastOffset] : undefined
          const titleSuffix = forecastOffset === 1
            ? ' (Tomorrow)'
            : forecastOffset > 1
              ? ` (${forecastOffset} days ahead)`
              : ''
          const weatherResponse = forecastTarget
            ? `${ui.weatherIn} ${weatherLocation}${titleSuffix}:\n\n` +
              `${ui.temp}: ${Math.round(forecastTarget.temp_max)}°C / ${Math.round(forecastTarget.temp_min)}°C\n` +
              `Rain chance: ${forecastTarget.rain_chance}%\n` +
              `${ui.condition}: ${forecastTarget.condition}`
            : `${ui.weatherIn} ${weatherLocation}:\n\n` +
              `${ui.temp}: ${Math.round(weatherData.current.temperature)}°C\n` +
              `${ui.humidity}: ${weatherData.current.humidity}%\n` +
              `${ui.wind}: ${weatherData.current.wind_speed} km/h\n` +
              `${ui.condition}: ${weatherData.current.condition}\n\n` +
              `${ui.advisory}:\n` +
              weatherData.advisories.map(a => `- ${a.message}`).join('\n')

          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: stripBoldMarkers(weatherResponse),
            timestamp: new Date(),
            data: weatherData as unknown as Record<string, unknown>
          }])
          setIsLoading(false)
          return
        } catch (e) {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: language === 'hi'
              ? 'अभी मौसम डेटा उपलब्ध नहीं है। कृपया स्थान का नाम फिर से जांचें।'
              : language === 'te'
                ? 'ప్రస్తుతం వాతావరణ డేటా అందుబాటులో లేదు. దయచేసి స్థల పేరు మళ్లీ పరిశీలించండి.'
                : 'Weather data is not available right now. Please recheck the location name.',
            timestamp: new Date()
          }])
          setIsLoading(false)
          return
        }
      }
      // Check if this is a current-location query
      if (isLocationQuery(userMessage.content)) {
        const location = await detectLocation()
        const user = getUserInfo()

        if (location) {
          const locationResponse = language === 'hi'
            ? `Aapki current location:\n\n${location.name}\nLatitude: ${location.lat.toFixed(5)}\nLongitude: ${location.lon.toFixed(5)}`
            : `Your current location:\n\n${location.name}\nLatitude: ${location.lat.toFixed(5)}\nLongitude: ${location.lon.toFixed(5)}`

          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: locationResponse,
            timestamp: new Date()
          }])
          setIsLoading(false)
          return
        }

        if (user?.state) {
          const fallbackLocation = user.district
            ? `${user.district}, ${user.state}`
            : user.state

          const fallbackResponse = language === 'hi'
            ? `Live location access nahi mila. Aapki registered location: ${fallbackLocation}`
            : `I couldn't access live location. Your registered location is: ${fallbackLocation}`

          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: fallbackResponse,
            timestamp: new Date()
          }])
          setIsLoading(false)
          return
        }
      }

      // Crop guide query should show cultivation guidance, not recommendations
      if (isCropGuideQuery(userMessage.content)) {
        const cropName = extractGuideCrop(userMessage.content)
        if (cropName) {
          try {
            const info = await getCropInfo(cropName)
            const tips = Array.isArray(info?.tips) ? info.tips.slice(0, 4) : []
            const locationCtx = await extractLocationFromMessage(userMessage.content)
            const locationLabel = locationCtx.state || locationCtx.district
            const fert = info?.fertilizer as Record<string, string> | undefined

            const guide = [
              `Crop Guide: ${info?.name || cropName}${locationLabel ? ` (${locationLabel})` : ''}`,
              info?.season ? `1. Season: ${info.season}` : '',
              info?.duration ? `2. Crop Duration: ${info.duration}` : '',
              info?.soil ? `3. Soil Requirement: ${info.soil}` : '',
              info?.temperature ? `4. Temperature Range: ${info.temperature}` : '',
              fert ? `5. Nutrient Plan (base): N ${fert.nitrogen || '-'}, P ${fert.phosphorus || '-'}, K ${fert.potassium || '-'}` : '',
              '6. Irrigation: Keep moisture stable at germination and flowering; avoid water stress.',
              tips.length ? `7. Practical Field Tips:\n${tips.map((x: string) => `- ${x}`).join('\n')}` : '',
              '8. Protection: Monitor pests/diseases weekly and use local KVK guidance before spraying.'
            ].filter(Boolean).join('\n')

            setMessages(prev => [...prev, {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: guide,
              timestamp: new Date()
            }])
            setIsLoading(false)
            return
          } catch {
            // fall through to generic chat
          }
        }
      }

      // Check if this is a crop query
      if (isCropQuery(userMessage.content)) {
        const { state, district, unavailableLocation } = await getLocationContextForMessage(userMessage.content)
        if (unavailableLocation) {
          const noDataMessage = language === 'hi'
            ? `${unavailableLocation} के लिए उपलब्ध डेटा के अनुसार अभी उपयुक्त फसल सिफारिश नहीं मिली।`
            : language === 'te'
              ? `${unavailableLocation} కోసం అందుబాటులో ఉన్న డేటా ప్రకారం సరైన పంట సిఫార్సు లభించలేదు.`
              : `No crop found suitable to grow in ${unavailableLocation} according to the available data.`
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: noDataMessage,
            timestamp: new Date()
          }])
          setIsLoading(false)
          return
        }
        if (state) {
          const result = await quickAction('crop', { state, district })

          if (result.success && result.crops) {
            const ranking = rankRecommendations(result.crops as Array<{ crop: string; confidence: number }>, {
              getId: (item) => item.crop,
              getScore: (item) => item.confidence
            })
            const topCrops = ranking.shortlisted
            const highConfidence = ranking.highConfidence
            const locationLabel = district || state
            const recommendationLine = language === 'hi'
              ? highConfidence
                ? 'सिफारिश मजबूत है, इसलिए 2 सर्वश्रेष्ठ विकल्प दिए गए हैं।'
                : 'कई विकल्प करीब हैं, इसलिए 3 सुरक्षित विकल्प दिए गए हैं।'
              : language === 'te'
                ? highConfidence
                  ? 'సిఫార్సు బలంగా ఉంది, అందుకే 2 ఉత్తమ ఎంపికలు ఇచ్చాం.'
                  : 'ఎంపికలు దగ్గరగా ఉండటంతో, 3 సురక్షిత ఎంపికలు ఇచ్చాం.'
                : highConfidence
                  ? 'Recommendation is strong, so we are sharing 2 best options.'
                  : 'Multiple options are close, so we are sharing 3 safe options.'
            const cropResponse = `Model Recommendation (Trained Data)\n\n${ui.recommendedCropsFor} ${locationLabel}:\n\n` +
              topCrops.map((c, i: number) =>
                `${i + 1}. ${c.crop}`
              ).join('\n') +
              `\n\n${recommendationLine}\n${ui.basedOnSoil}: N=${result.soil_info?.nitrogen || 'N/A'}, P=${result.soil_info?.phosphorus || 'N/A'}, K=${result.soil_info?.potassium || 'N/A'}`

            setLastCropResult({
              location: locationLabel,
              soil: {
                n: result.soil_info?.nitrogen || 'N/A',
                p: result.soil_info?.phosphorus || 'N/A',
                k: result.soil_info?.potassium || 'N/A'
              },
              crops: ranking.ranked
            })

            setMessages(prev => [...prev, {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: cropResponse,
              timestamp: new Date(),
              data: { type: 'crop_model', location: locationLabel, crops: topCrops } as unknown as Record<string, unknown>
            }])

            try {
              const shortlisted = [...new Set(topCrops.map((c) => c.crop))]
              const altLine = shortlisted.length >= 3
                ? `Line2: Best now: ${shortlisted[0]}; alternatives: ${shortlisted[1]}, ${shortlisted[2]}.`
                : `Line2: Best now: ${shortlisted[0]}; alternative: ${shortlisted[1] || shortlisted[0]}.`
              const advisoryPrompt = [
                `Location: ${locationLabel}`,
                `Verified model crops: ${shortlisted.join(', ')}`,
                `Soil NPK: N=${result.soil_info?.nitrogen || 'N/A'}, P=${result.soil_info?.phosphorus || 'N/A'}, K=${result.soil_info?.potassium || 'N/A'}`,
                `Language: ${language}`,
                'Task: Return a compact quick advisory only (not full cultivation guide).',
                'Output format: exactly 4 short lines, plain text, no markdown.',
                `Line1: Quick advisory for ${locationLabel}.`,
                altLine,
                'Line3: One short water/sowing hint (max 14 words).',
                'Line4: One short risk note (max 12 words).',
                'Rules: do not mention any crop outside verified list, no percentages, no long paragraphs.'
              ].join('\n')

              const advisory = await sendChatMessage(advisoryPrompt, language, [])
              let advisoryText = compactAdvisory(sanitizeGroqAdvisory(advisory.response))
              if (!advisoryText || advisoryText.length < 20) {
                advisoryText = shortlisted.length >= 3
                  ? `Quick advisory for ${locationLabel}.\nBest now: ${shortlisted[0]}; alternatives: ${shortlisted[1]}, ${shortlisted[2]}.\nWater/sowing hint: choose sowing window as per local rainfall onset.\nRisk: monitor pests and sudden weather swings.`
                  : `Quick advisory for ${locationLabel}.\nBest now: ${shortlisted[0]}; alternative: ${shortlisted[1] || shortlisted[0]}.\nWater/sowing hint: choose sowing window as per local rainfall onset.\nRisk: monitor pests and sudden weather swings.`
              }

              setMessages(prev => [...prev, {
                id: (Date.now() + 2).toString(),
                role: 'assistant',
                content: `AI Advisory (Groq)\n\n${advisoryText}`,
                timestamp: new Date()
              }])
            } catch (e) {
              console.error('Advisory generation error:', e)
            }

            setIsLoading(false)
            return
          }
        } else {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: language === 'hi'
              ? 'कृपया अपना राज्य/जिला बताएं ताकि सटीक फसल सिफारिश दी जा सके।'
              : ui.needLocation,
            timestamp: new Date()
          }])
          setIsLoading(false)
          return
        }
      }

      // Fertilizer guide query should return detailed usage steps
      if (isFertilizerGuideQuery(userMessage.content)) {
        const fertilizerName = extractFertilizerName(userMessage.content)
        const cropName = extractFertilizerCrop(userMessage.content)
        if (fertilizerName) {
          try {
            const info = await getFertilizerInfo(fertilizerName)

            let schedule = ''
            let warnings: string[] = []

            if (cropName) {
              const loc = await getLocationContextForMessage(userMessage.content)
              if (loc.state) {
                try {
                  const rec = await getFertilizerRecommendations({
                    state: loc.state,
                    district: loc.district || loc.state,
                    crop: toFertilizerApiCrop(cropName)
                  })
                  schedule = rec.application_info || ''
                  warnings = rec.warnings || []
                } catch {
                  schedule = ''
                }
              }
            }

            const appSteps = Array.isArray(info?.application) ? info.application.slice(0, 5) : []
            const detailedGuide = [
              `Fertilizer Guide: ${info?.name || fertilizerName.toUpperCase()}${cropName ? ` for ${cropName}` : ''}`,
              info?.composition ? `1. Composition: ${info.composition}` : '',
              info?.usage ? `2. Use Case: ${info.usage}` : '',
              info?.dosage ? `3. Typical Dose: ${info.dosage}` : '',
              appSteps.length ? `4. Application Steps:\n${appSteps.map((s: string) => `- ${s}`).join('\n')}` : '',
              schedule ? `5. Crop-wise Timing: ${schedule}` : '',
              warnings.length ? `6. Risk Notes:\n${warnings.slice(0, 3).map((w) => `- ${w}`).join('\n')}` : '',
              info?.price_range ? `7. Price Range: ${info.price_range}` : ''
            ].filter(Boolean).join('\n')

            setMessages(prev => [...prev, {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: detailedGuide,
              timestamp: new Date()
            }])
            setIsLoading(false)
            return
          } catch {
            // fall through to standard fertilizer flow
          }
        }
      }

      // Check if this is a fertilizer query
      if (isFertilizerQuery(userMessage.content) || awaitingFertilizerCrop) {
        const { state, district } = await getLocationContextForMessage(userMessage.content)
        const mentionedCrop = extractFertilizerCrop(userMessage.content)

        if (!mentionedCrop) {
          const rawInput = userMessage.content.trim()
          const looksLikeCropName =
            awaitingFertilizerCrop &&
            rawInput.length > 1 &&
            !isFertilizerQuery(userMessage.content) &&
            !isWeatherQuery(userMessage.content) &&
            !isCropQuery(userMessage.content)

          setAwaitingFertilizerCrop(true)
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: looksLikeCropName
              ? `${ui.unsupportedCrop.replace('{crop}', rawInput)}\n\n${ui.askCrop}`
              : ui.askCrop,
            timestamp: new Date()
          }])
          setIsLoading(false)
          return
        }
        setAwaitingFertilizerCrop(false)

        if (state) {
          const apiCrop = toFertilizerApiCrop(mentionedCrop)
          const cropDisplayName = getDisplayCropName(mentionedCrop)
          const result = await quickAction('fertilizer', {
            state,
            district,
            crop: apiCrop
          })

          if (result.success && result.fertilizers) {
            const fertResponse = `${ui.fertilizerFor} ${cropDisplayName}:\n\n` +
              result.fertilizers.map((f: { name: string; dosage: string; application: string }) =>
                `${localizeFertilizerName(f.name)}\n- ${ui.dosage}: ${localizeFertilizerText(f.dosage)}\n- ${ui.application}: ${localizeFertilizerText(f.application)}`
              ).join('\n\n')

            setMessages(prev => [...prev, {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: fertResponse,
              timestamp: new Date()
            }])
            setIsLoading(false)
            return
          }
        }
      }

      // Default: Call the chat API
const context = messages
        .filter(m => m.id !== 'welcome')
        .slice(-5)
        .map(m => ({ role: m.role, content: m.content }))

      const response = await sendChatMessage(userMessage.content, language, context)
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        data: response.data
      }])

    } catch (error) {
      console.error('Chat error:', error)
      
      // Fallback response
      const fallbackResponses: Record<string, string> = {
        en: "I'm having trouble connecting to the server. Please check if the backend is running on backend API. In the meantime, you can use the specific pages for Crop Recommendation, Fertilizer Advice, and Weather.",
        hi: 'सर्वर से कनेक्ट करने में दिक्कत हो रही है। कृपया जांचें कि बैकएंड API चल रहा है। तब तक आप Crop Recommendation, Fertilizer Advice और Weather पेज का उपयोग कर सकते हैं।',
        te: 'సర్వర్‌కు కనెక్ట్ కావడంలో సమస్య ఉంది. బ్యాకెండ్ API నడుస్తుందో చూడండి. అప్పటివరకు Crop Recommendation, Fertilizer Advice, Weather పేజీలను ఉపయోగించండి.'
      }
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fallbackResponses[language] || fallbackResponses.en,
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleVoice = () => {
    if (!voiceSupported) return
    clearVoiceError()
    if (isListening || voiceStatus === 'processing') stopListening()
    else startListening()
  }

  const handleImageSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setSelectedImage(file)
    if (ttsError) clearTtsError()
    event.target.value = ''
  }

  const wb = {
    en: { title: 'Welcome back!', lastVisit: 'Last visited', continueBtn: 'Continue where you left', newChat: 'Start fresh' },
    hi: { title: 'फिर से स्वागत है!', lastVisit: 'आखिरी बार', continueBtn: 'जहां छोड़ा था वहीं से जारी रखें', newChat: 'नई चैट' },
    te: { title: 'మళ్లీ స్వాగతం!', lastVisit: 'చివరిసారి', continueBtn: 'ఆపిన చోటు నుంచి కొనసాగించండి', newChat: 'కొత్త చాట్' }
  }[language] || { title: 'Welcome back!', lastVisit: 'Last visited', continueBtn: 'Continue where you left', newChat: 'Start fresh' }

  const suggestions = language === 'hi' 
    ? ['आज मौसम कैसा है?', 'मैं कौन सी फसल उगाऊं?', 'धान के लिए खाद', 'सरकारी योजनाएं']
    : language === 'te'
      ? ['ఈ రోజు వాతావరణం ఎలా ఉంది?', 'ఏ పంట వేయాలి?', 'వరి కోసం ఎరువు', 'ప్రభుత్వ పథకాలు']
      : ['What\'s the weather today?', 'What crops should I grow?', 'Fertilizer for rice', 'Government schemes']

  const getDateLabel = (date: Date) => {
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()

    if (isSameDay(date, today)) return language === 'hi' ? 'आज' : language === 'te' ? 'ఈ రోజు' : 'Today'
    if (isSameDay(date, yesterday)) return language === 'hi' ? 'कल' : language === 'te' ? 'నిన్న' : 'Yesterday'
    return date.toLocaleDateString(language === 'hi' ? 'hi-IN' : language === 'te' ? 'te-IN' : 'en-IN')
  }

  const localChatDayEntries = (() => {
    const map = new Map<string, Message[]>()
    const userOnly = [...messages]
      .filter((m) => m.role === 'user' && m.id !== 'welcome')
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    for (const msg of userOnly) {
      const key = `${msg.timestamp.getFullYear()}-${msg.timestamp.getMonth()}-${msg.timestamp.getDate()}`
      const list = map.get(key) || []
      list.push(msg)
      map.set(key, list)
    }

    return [...map.entries()]
      .map(([key, list]) => ({
        key,
        label: getDateLabel(list[0].timestamp),
        firstMessage: list[0]
      }))
      .sort((a, b) => b.firstMessage.timestamp.getTime() - a.firstMessage.timestamp.getTime())
  })()

  const conversationEntries: ChatSummaryItem[] = conversationList.map((conv) => ({
    id: conv.id,
    label: getDateLabel(new Date(conv.updated_at)),
    firstMessage: conv.title || conv.preview || 'New Chat',
    updatedAt: new Date(conv.updated_at)
  }))

  const sidebarEntries = isLoggedIn() ? conversationEntries : localChatDayEntries.map((entry) => ({
    id: entry.key,
    label: entry.label,
    firstMessage: entry.firstMessage.content,
    updatedAt: entry.firstMessage.timestamp
  }))

  const openConversation = async (entryId: string, previewText: string) => {
    if (!isLoggedIn()) {
      setInput(previewText)
      return
    }

    try {
      setActiveConversationId(entryId)
      const detail = await getChatConversation(entryId)
      const loadedMessages = detail.messages.map((m) => ({
        id: `${new Date(m.timestamp).getTime()}-${Math.random().toString(36).slice(2, 6)}`,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp)
      }))
      setMessages(loadedMessages.length ? loadedMessages : [welcomeMessage(currentUser)])
      setMobileChatsOpen(false)
    } catch (error) {
      console.error('Failed to load conversation:', error)
    }
  }

  const handleDeleteConversation = async (conversationId: string) => {
    if (!isLoggedIn()) return

    try {
      await deleteChatConversation(conversationId)
      const remaining = conversationList.filter((c) => c.id !== conversationId)
      setConversationList(remaining)

      if (activeConversationId === conversationId) {
        if (remaining.length > 0) {
          const next = remaining[0]
          setActiveConversationId(next.id)
          const detail = await getChatConversation(next.id)
          const loadedMessages = detail.messages.map((m) => ({
            id: `${new Date(m.timestamp).getTime()}-${Math.random().toString(36).slice(2, 6)}`,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.timestamp)
          }))
          setMessages(loadedMessages.length ? loadedMessages : [welcomeMessage(currentUser)])
        } else {
          const created = await createChatConversation()
          setActiveConversationId(created.id)
          setConversationList([created])
          setMessages([welcomeMessage(currentUser)])
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b px-4 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-2 rounded-xl">
              <Sprout className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">{t.chat.title}</h1>
              <p className="text-sm text-gray-500">AI-Powered Farming Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentUser && (
              <button
                onClick={() => setMobileChatsOpen(true)}
                className="md:hidden text-sm text-green-700 bg-green-100 px-2 py-1 rounded-lg"
              >
                {language === 'hi' ? 'मेरी चैट' : language === 'te' ? 'నా చాట్స్' : 'My Chats'}
              </button>
            )}
            {userLocation && (
              <div className="text-sm text-gray-500 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {userLocation.name.split(',')[0]}
              </div>
            )}
            {messages.length > 1 && (
              <div className="flex items-center text-sm text-gray-400">
                <History className="h-4 w-4 mr-1" />
                <span>{messages.filter(m => m.id !== 'welcome').length} messages</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {showWelcomeBack && lastVisitText && (
        <div className="bg-linear-to-r from-green-500 to-emerald-500 text-white px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{wb.title}</h3>
                <p className="text-green-100 text-sm mt-1">{wb.lastVisit}: {lastVisitText}</p>
                {lastTopic && (
                  <p className="text-green-100 text-sm mt-1 truncate max-w-md">
                    {ui.lastTopic}: "{lastTopic.slice(0, 50)}{lastTopic.length > 50 ? '...' : ''}"
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={continueLastTopic} className="px-4 py-2 bg-white text-green-600 rounded-lg text-sm font-medium hover:bg-green-50 transition-colors">
                    {wb.continueBtn}
                  </button>
                  <button onClick={startFresh} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors border border-green-400">
                    {wb.newChat}
                  </button>
                </div>
              </div>
              <button onClick={dismissWelcomeBack} className="text-green-200 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {currentUser && (
          <aside className="hidden md:flex md:flex-col md:sticky md:top-16 md:h-[calc(100vh-4rem)] w-72 border-r bg-white shrink-0">
            <div className="p-4 border-b font-semibold text-gray-700">
              {language === 'hi' ? 'आपकी चैट' : language === 'te' ? 'మీ చాట్స్' : 'Your Chats'}
            </div>
            <div className="p-3 space-y-2 overflow-y-auto">
              {sidebarEntries.map((entry) => (
                <div key={entry.id} className="w-full p-2 rounded-lg hover:bg-green-50 border border-gray-100">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => openConversation(entry.id, entry.firstMessage)}
                      className="flex-1 text-left"
                    >
                      <div className="text-xs font-semibold text-gray-500">{entry.label}</div>
                      <div className="text-sm text-gray-700 mt-1">
                        {entry.firstMessage.length > 70
                          ? `${entry.firstMessage.slice(0, 70)}...`
                          : entry.firstMessage}
                      </div>
                    </button>
                    {isLoggedIn() && (
                      <button
                        onClick={() => handleDeleteConversation(entry.id)}
                        className="shrink-0 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title={language === 'hi' ? 'हटाएं' : language === 'te' ? 'తొలగించు' : 'Delete'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        {currentUser && mobileChatsOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMobileChatsOpen(false)}>
            <div className="w-72 h-full bg-white p-4 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{language === 'hi' ? 'आपकी चैट' : language === 'te' ? 'మీ చాట్స్' : 'Your Chats'}</h3>
                <button onClick={() => setMobileChatsOpen(false)}><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-2">
                {sidebarEntries.map((entry) => (
                  <div key={entry.id} className="w-full p-2 rounded-lg hover:bg-green-50 border border-gray-100">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => { openConversation(entry.id, entry.firstMessage); setMobileChatsOpen(false) }}
                        className="flex-1 text-left"
                      >
                        <div className="text-xs font-semibold text-gray-500">{entry.label}</div>
                        <div className="text-sm text-gray-700 mt-1">
                          {entry.firstMessage.length > 70
                            ? `${entry.firstMessage.slice(0, 70)}...`
                            : entry.firstMessage}
                        </div>
                      </button>
                      {isLoggedIn() && (
                        <button
                          onClick={() => handleDeleteConversation(entry.id)}
                          className="shrink-0 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                          title={language === 'hi' ? 'हटाएं' : language === 'te' ? 'తొలగించు' : 'Delete'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {messages.map((message) => {
            const imagePreviewUrl = getMessageImagePreview(message)
            return (
              <div key={message.id} className={cn('flex items-start space-x-3', message.role === 'user' && 'flex-row-reverse space-x-reverse')}>
                <div className={cn('shrink-0 w-10 h-10 rounded-xl flex items-center justify-center', message.role === 'assistant' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600')}>
                  {message.role === 'assistant' ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />}
                </div>
                <div className={cn('max-w-[80%] rounded-2xl px-4 py-3 shadow-sm', message.role === 'assistant' ? 'bg-white border border-gray-100' : 'bg-green-600 text-white')}>
                  {imagePreviewUrl && (
                    <img
                      src={imagePreviewUrl}
                      alt="Uploaded leaf"
                      className="mb-3 max-h-64 w-full rounded-xl border border-black/10 object-contain bg-black/5"
                    />
                  )}
                  <p className="whitespace-pre-wrap">{stripBoldMarkers(message.content)}</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className={cn('text-xs', message.role === 'assistant' ? 'text-gray-400' : 'text-green-200')}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {message.role === 'assistant' && message.id !== 'welcome' && ttsSupported && (
                      <button
                        onClick={() => speakMessage(message)}
                        className="text-xs inline-flex items-center gap-1 rounded-md px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700"
                        title={isSpeaking && speakingMessageId === message.id ? ui.stopReply : ui.speakReply}
                      >
                        {isSpeaking && speakingMessageId === message.id
                          ? <Square className="h-3.5 w-3.5" />
                          : <Volume2 className="h-3.5 w-3.5" />}
                        <span>{isSpeaking && speakingMessageId === message.id ? ui.stopReply : ui.speakReply}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {isLoading && (
            <div className="flex items-start space-x-3">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
                <Bot className="h-5 w-5" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
                <div className="flex items-center space-x-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{locationLoading ? ui.detectingLocation : t.chat.thinking}</span>
                </div>
              </div>
            </div>
          )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      <div className="bg-white border-t px-4 py-4">
        <div className="max-w-4xl mx-auto">
          {selectedImage && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-emerald-800">
                <ImagePlus className="h-4 w-4" />
                <span>{selectedImage.name}</span>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="rounded-md p-1 text-emerald-700 hover:bg-emerald-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {!voiceSupported && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {ui.voiceInputUnsupported}
            </div>
          )}

          {isListening && (
            <div className="flex items-center justify-center space-x-2 text-red-500 mb-3 animate-pulse">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-ping" />
              <span className="font-medium">{t.chat.listening}</span>
            </div>
          )}

          {voiceStatus === 'processing' && (
            <div className="mb-3 flex items-center justify-center space-x-2 text-amber-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-medium">{ui.voiceProcessing}</span>
            </div>
          )}

          {voiceErrorText && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{voiceErrorText}</span>
            </div>
          )}

          {ttsErrorText && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{ttsErrorText}</span>
            </div>
          )}

          {isSpeaking && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <span className="text-sm text-blue-800">{ui.speakingNow}</span>
              <button
                onClick={() => {
                  stopSpeaking()
                  setSpeakingMessageId(null)
                }}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
              >
                <Square className="h-3.5 w-3.5" />
                <span>{ui.stopAudio}</span>
              </button>
            </div>
          )}

          <div className="flex items-center space-x-3">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelected}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageSelected}
            />

            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={isLoading}
              className={cn(
                'shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all',
                isLoading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              )}
              title={language === 'hi' ? 'पत्ती की छवि जोड़ें' : language === 'te' ? 'ఆకు చిత్రం జోడించండి' : 'Attach leaf image'}
            >
              <ImagePlus className="h-5 w-5" />
            </button>

            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={isLoading}
              className={cn(
                'shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all',
                isLoading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              )}
              title={language === 'hi' ? 'कैमरा खोलें' : language === 'te' ? 'కెమెరా తెరవండి' : 'Open camera'}
            >
              <Camera className="h-5 w-5" />
            </button>

            {voiceSupported && (
              <button
                onClick={toggleVoice}
                disabled={voiceStatus === 'processing'}
                className={cn(
                  'shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all',
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : voiceStatus === 'processing'
                      ? 'bg-amber-100 text-amber-700 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
                title={t.chat.voiceBtn}
              >
                {isListening
                  ? <MicOff className="h-5 w-5" />
                  : voiceStatus === 'processing'
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : <Mic className="h-5 w-5" />}
              </button>
            )}

            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  if (voiceError) clearVoiceError()
                  if (ttsError) clearTtsError()
                }}
                onKeyPress={handleKeyPress}
                placeholder={t.chat.placeholder}
                className="w-full px-4 py-3 pr-12 bg-gray-100 rounded-xl border-2 border-transparent focus:border-green-500 focus:bg-white focus:outline-none transition-all"
                disabled={isLoading}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={(!input.trim() && !selectedImage) || isLoading}
              className={cn('shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all', (input.trim() || selectedImage) && !isLoading ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed')}
            >
              <Send className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setInput(suggestion)
                  if (voiceError) clearVoiceError()
                }}
                className="px-3 py-1.5 bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 rounded-full text-sm transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}