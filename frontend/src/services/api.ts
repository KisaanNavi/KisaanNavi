import { getCacheKey, withOfflineCache } from '@/utils/advisoryCache'
import { flushFeedbackQueue, queueFeedback, type FeedbackPayload as QueuedFeedbackPayload } from '@/utils/feedbackQueue'

// API Configuration
// @ts-expect-error Vite env
const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:5000/api'

function getAuthToken(): string | null {
  try {
    return localStorage.getItem('kisaannavi_token')
  } catch {
    return null
  }
}

interface FetchOptions extends RequestInit {
  auth?: boolean
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {}
  if (headers instanceof Headers) {
    const normalized: Record<string, string> = {}
    headers.forEach((value, key) => {
      normalized[key] = value
    })
    return normalized
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }
  return headers as Record<string, string>
}

async function fetchAPI<T>(endpoint: string, options?: FetchOptions): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const token = options?.auth ? getAuthToken() : null
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData
  
  const defaultOptions: RequestInit = {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    },
  }
  
  const { auth: _auth, ...requestOptions } = options || {}
  const response = await fetch(url, {
    ...defaultOptions,
    ...requestOptions,
    headers: {
      ...normalizeHeaders(defaultOptions.headers),
      ...normalizeHeaders(requestOptions.headers),
    },
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }))
    throw new Error(error.detail || `HTTP error! status: ${response.status}`)
  }
  
  return response.json()
}

// Types
export interface WeatherCurrent {
  temperature: number
  humidity: number
  precipitation: number
  wind_speed: number
  condition: string
  icon: string
}

export interface WeatherForecast {
  date: string
  day: string
  temp_max: number
  temp_min: number
  precipitation: number
  rain_chance: number
  condition: string
  icon: string
}

export interface WeatherAdvisory {
  type: 'info' | 'warning' | 'success'
  title: string
  message: string
}

export interface WeatherResponse {
  location: string
  current: WeatherCurrent
  forecast: WeatherForecast[]
  advisories: WeatherAdvisory[]
}

export interface ChatResponse {
  response: string
  intent?: string
  data?: Record<string, unknown>
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ConversationSummary {
  id: string
  title: string
  preview: string
  created_at: string
  updated_at: string
  message_count: number
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessage[]
}

export interface AuthUser {
  id: string
  name: string
  phone: string
  state: string
  district?: string
  language: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: AuthUser
}

export interface CropType {
  name: string
  name_hi: string
}

export interface SoilData {
  nitrogen: number
  phosphorus: number
  potassium: number
  ph: number
  n_status: string
  p_status: string
  k_status: string
  organic_carbon: string
  state?: string
  district?: string
}

export interface CropRecommendation {
  name: string
  confidence: number
  suitable: boolean
  season?: string
  duration?: string
  water_requirement?: string
}

export interface FertilizerRecommendation {
  name: string
  confidence: number
  dosage: string
  application: string
  reason?: string
}

export interface DiseasePredictionOption {
  label: string
  crop: string
  disease: string
  healthy: boolean
  confidence: number
}

export interface DiseaseDetectionResponse {
  label: string
  crop: string
  disease: string
  healthy: boolean
  confidence: number
  summary: string
  immediate_actions: string[]
  prevention_tips: string[]
  top_predictions: DiseasePredictionOption[]
}

export interface CachedResult<T> {
  data: T
  fromCache: boolean
}

export interface FeedbackPayload {
  feature: string
  subject: string
  helpful: boolean
  note?: string
  metadata?: Record<string, unknown>
}

export interface FeedbackSubmitResponse {
  id: string
  success: boolean
  queued: boolean
}

export interface FeedbackFeatureAnalytics {
  feature: string
  total: number
  positive: number
  negative: number
}

export interface FeedbackDailyAnalytics {
  date: string
  total: number
  positive: number
  negative: number
}

export interface FeedbackNoteAnalytics {
  id: string
  feature: string
  subject: string
  helpful: boolean
  note: string
  user_name: string
  is_anonymous: boolean
  created_at: string
}

export interface FeedbackAnalyticsResponse {
  generated_at: string
  total_users: number
  total_feedback: number
  positive_feedback: number
  negative_feedback: number
  total_comments: number
  anonymous_feedback: number
  unique_feedback_users: number
  positive_rate: number
  by_feature: FeedbackFeatureAnalytics[]
  daily_feedback: FeedbackDailyAnalytics[]
  recent_notes: FeedbackNoteAnalytics[]
}

// ============ WEATHER API ============
export async function getWeatherByLocation(location: string): Promise<WeatherResponse> {
  return fetchAPI<WeatherResponse>(`/weather/${encodeURIComponent(location)}`)
}

export async function getWeatherByCoords(lat: number, lon: number, name?: string): Promise<WeatherResponse> {
  const params = name ? `?name=${encodeURIComponent(name)}` : ''
  return fetchAPI<WeatherResponse>(`/weather/coords/${lat}/${lon}${params}`)
}

// ============ CHAT API ============
export async function sendChatMessage(
  message: string, 
  language: string = 'en',
  context?: { role: string; content: string }[]
): Promise<ChatResponse> {
  return fetchAPI<ChatResponse>('/chat/', {
    method: 'POST',
    body: JSON.stringify({ message, language, context }),
  })
}

export interface QuickActionResponse {
  success: boolean
  crops?: { crop: string; confidence: number }[]
  fertilizers?: { name: string; dosage: string; application: string }[]
  weather?: Record<string, unknown>
  soil_info?: Partial<SoilData>
  error?: string
}

export interface CropInfoResponse {
  name: string
  season?: string
  duration?: string
  soil?: string
  temperature?: string
  tips?: string[]
  fertilizer?: {
    nitrogen?: string
    phosphorus?: string
    potassium?: string
  }
  info?: string
}

export interface FertilizerInfoResponse {
  name: string
  composition?: string
  usage?: string
  dosage?: string
  application?: string[]
  price_range?: string
  info?: string
}

export async function quickAction(action: string, data: Record<string, unknown>): Promise<QuickActionResponse> {
  return fetchAPI<QuickActionResponse>('/chat/quick-action', {
    method: 'POST',
    body: JSON.stringify({ action, data }),
  })
}

// ============ LOCATION API ============
export async function getStates(): Promise<{ states: string[] }> {
  return fetchAPI<{ states: string[] }>('/location/states')
}

export async function getDistricts(state: string): Promise<{ state: string; districts: string[] }> {
  return fetchAPI(`/location/districts/${encodeURIComponent(state)}`)
}

export async function getCrops(
  state: string,
  season?: string,
  soilType?: string
): Promise<{ state: string; season?: string; soil_type?: string; crops: CropType[] }> {
  const query = new URLSearchParams()
  if (season) query.set('season', season)
  if (soilType) query.set('soil_type', soilType)
  const params = query.toString() ? `?${query.toString()}` : ''
  return fetchAPI(`/location/crops/${encodeURIComponent(state)}${params}`)
}

export async function listChatConversations(): Promise<ConversationSummary[]> {
  return fetchAPI<ConversationSummary[]>('/chat/conversations', { auth: true })
}

export async function createChatConversation(title?: string): Promise<ConversationSummary> {
  return fetchAPI<ConversationSummary>('/chat/conversations', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ title }),
  })
}

export async function getChatConversation(conversationId: string): Promise<ConversationDetail> {
  return fetchAPI<ConversationDetail>(`/chat/conversations/${encodeURIComponent(conversationId)}`, { auth: true })
}

export async function saveChatConversation(
  conversationId: string,
  payload: { title?: string; messages: ConversationMessage[] }
): Promise<ConversationSummary> {
  return fetchAPI<ConversationSummary>(`/chat/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(payload),
  })
}

export async function deleteChatConversation(conversationId: string): Promise<{ success: boolean }> {
  return fetchAPI<{ success: boolean }>(`/chat/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
    auth: true
  })
}

export async function getSoilData(state: string, district: string): Promise<{ soil_data: SoilData }> {
  return fetchAPI(`/location/soil-data/${encodeURIComponent(state)}/${encodeURIComponent(district)}`)
}

// ============ CROP RECOMMENDATION API ============
export async function getCropRecommendations(data: {
  state: string
  district: string
  season?: string
}): Promise<{
  crops: CropRecommendation[]
  soil_info: SoilData
  weather_info: Record<string, unknown>
}> {
  return fetchAPI('/crop/recommend', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getCropInfo(cropName: string): Promise<CropInfoResponse> {
  return fetchAPI<CropInfoResponse>(`/crop/info/${encodeURIComponent(cropName)}`)
}

export async function getCropRecommendationsCached(data: {
  state: string
  district: string
  season?: string
}): Promise<CachedResult<{
  crops: CropRecommendation[]
  soil_info: SoilData
  weather_info: Record<string, unknown>
}>> {
  return withOfflineCache({
    cacheKey: getCacheKey('crop', data),
    loader: () => getCropRecommendations(data),
  })
}

// ============ FERTILIZER RECOMMENDATION API ============
export async function getFertilizerRecommendations(data: {
  state: string
  district?: string
  crop: string
  nitrogen?: string
  phosphorus?: string
  potassium?: string
}): Promise<{
  fertilizers: FertilizerRecommendation[]
  application_info: string
  warnings?: string[]
}> {
  return fetchAPI('/fertilizer/recommend', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getFertilizerInfo(fertilizerName: string): Promise<FertilizerInfoResponse> {
  return fetchAPI<FertilizerInfoResponse>(`/fertilizer/info/${encodeURIComponent(fertilizerName)}`)
}

export async function getFertilizerRecommendationsCached(data: {
  state: string
  district?: string
  crop: string
  nitrogen?: string
  phosphorus?: string
  potassium?: string
}): Promise<CachedResult<{
  fertilizers: FertilizerRecommendation[]
  application_info: string
  warnings?: string[]
}>> {
  return withOfflineCache({
    cacheKey: getCacheKey('fertilizer', data),
    loader: () => getFertilizerRecommendations(data),
  })
}

// ============ DISEASE DETECTION API ============
export async function detectDisease(file: File, crop?: string): Promise<DiseaseDetectionResponse> {
  const formData = new FormData()
  formData.append('file', file)
  if (crop) {
    formData.append('crop', crop)
  }

  return fetchAPI<DiseaseDetectionResponse>('/disease/detect', {
    method: 'POST',
    body: formData,
  })
}

async function buildDiseaseImageFingerprint(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer()
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', buffer)
      const bytes = Array.from(new Uint8Array(digest))
      return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')
    }
  } catch {
    // Fall back to metadata key below.
  }

  return `${file.name}:${file.size}:${file.lastModified}`
}

export async function detectDiseaseCached(file: File, crop?: string): Promise<CachedResult<DiseaseDetectionResponse>> {
  const imageFingerprint = await buildDiseaseImageFingerprint(file)

  return withOfflineCache({
    cacheKey: getCacheKey('disease', { imageFingerprint, crop: crop || 'auto' }),
    loader: () => detectDisease(file, crop),
    ttlMs: 1000 * 60 * 60 * 24,
  })
}

// ============ AUTH API ============
export async function login(name: string, password: string): Promise<AuthResponse> {
  return fetchAPI<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ name, password }),
  })
}

export async function register(data: {
  name: string
  phone: string
  password: string
  state: string
  district?: string
  language?: string
}): Promise<AuthResponse> {
  return fetchAPI<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getWeatherByLocationCached(location: string): Promise<CachedResult<WeatherResponse>> {
  return withOfflineCache({
    cacheKey: getCacheKey('weather_location', { location }),
    loader: () => getWeatherByLocation(location),
    ttlMs: 1000 * 60 * 30,
  })
}

export async function getWeatherByCoordsCached(lat: number, lon: number, name?: string): Promise<CachedResult<WeatherResponse>> {
  return withOfflineCache({
    cacheKey: getCacheKey('weather_coords', { lat: lat.toFixed(3), lon: lon.toFixed(3), name }),
    loader: () => getWeatherByCoords(lat, lon, name),
    ttlMs: 1000 * 60 * 30,
  })
}

export async function submitFeedback(payload: FeedbackPayload): Promise<FeedbackSubmitResponse> {
  const queuePayload: QueuedFeedbackPayload = payload

  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      queueFeedback(queuePayload)
      return { id: `queued-${Date.now()}`, success: true, queued: true }
    }

    const response = await fetchAPI<FeedbackSubmitResponse>('/feedback/', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload),
    })
    return response
  } catch (error) {
    queueFeedback(queuePayload)
    return { id: `queued-${Date.now()}`, success: true, queued: true }
  }
}

export async function syncPendingFeedback(): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0

  return flushFeedbackQueue(async (payload) => {
    await fetchAPI<FeedbackSubmitResponse>('/feedback/', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload),
    })
  })
}

export async function getFeedbackAnalytics(accessKey: string): Promise<FeedbackAnalyticsResponse> {
  return fetchAPI<FeedbackAnalyticsResponse>('/feedback/analytics', {
    method: 'GET',
    headers: {
      'X-Analytics-Key': accessKey,
    },
  })
}

// ============ GEOLOCATION HELPERS ============
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'))
      return
    }
    
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000 // 5 minutes cache
    })
  })
}

// Type-safe version
export interface LocationInfo {
  city: string
  district: string
  state: string
  displayName: string
  lat: number
  lon: number
}

export async function getDetailedLocationFromCoords(lat: number, lon: number): Promise<LocationInfo> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'KisaanNavi/1.0'
        }
      }
    )
    const data = await response.json()
    
    const address = data.address || {}
    const city = address.city || address.town || address.village || address.county || ''
    const state = address.state || ''
    const district = address.state_district || address.county || ''
    
    return {
      city,
      district,
      state,
      displayName: city ? `${city}, ${state}` : state || data.display_name,
      lat,
      lon
    }
  } catch {
    return {
      city: '',
      district: '',
      state: '',
      displayName: 'Unknown Location',
      lat,
      lon
    }
  }
}
