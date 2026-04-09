import { useEffect, useMemo, useState } from 'react'
import { BarChart3, CheckCircle2, MessageSquareText, RefreshCw, ShieldAlert, Users } from 'lucide-react'

import { getFeedbackAnalytics, type FeedbackAnalyticsResponse } from '@/services/api'
import { cn } from '@/utils/cn'

const ANALYTICS_KEY_STORAGE = 'kisaannavi_analytics_key'

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function AnalyticsPage() {
  const [accessKey, setAccessKey] = useState('')
  const [draftKey, setDraftKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<FeedbackAnalyticsResponse | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(ANALYTICS_KEY_STORAGE) || ''
    if (!stored) return
    setAccessKey(stored)
    setDraftKey(stored)
  }, [])

  const loadAnalytics = async (keyOverride?: string) => {
    const key = (keyOverride ?? accessKey).trim()
    if (!key) {
      setError('Enter analytics key first.')
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const response = await getFeedbackAnalytics(key)
      setData(response)
      setAccessKey(key)
      localStorage.setItem(ANALYTICS_KEY_STORAGE, key)
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setIsLoading(false)
    }
  }

  const maxDailyCount = useMemo(() => {
    if (!data?.daily_feedback?.length) return 1
    return Math.max(...data.daily_feedback.map((item) => item.total), 1)
  }, [data])

  return (
    <div className="min-h-screen bg-linear-to-b from-sky-50 to-white py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-sky-100 rounded-2xl mb-3">
            <BarChart3 className="h-7 w-7 text-sky-700" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Project Analytics</h1>
          <p className="text-gray-600 mt-2">Feedback trends, positive/negative split, and farmer notes.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6">
          <p className="text-sm text-gray-600 mb-3">
            Enter analytics key to access admin dashboard.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="password"
              value={draftKey}
              onChange={(event) => setDraftKey(event.target.value)}
              placeholder="Analytics key"
              className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              type="button"
              onClick={() => loadAnalytics(draftKey)}
              disabled={isLoading}
              className={cn(
                'px-5 py-3 rounded-xl text-white font-semibold inline-flex items-center justify-center gap-2',
                isLoading ? 'bg-gray-400' : 'bg-sky-600 hover:bg-sky-700'
              )}
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
              <span>{isLoading ? 'Loading...' : 'Open Analytics'}</span>
            </button>
          </div>
          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Registered Users</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{data.total_users}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Total Feedback</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{data.total_feedback}</p>
              </div>
              <div className="bg-white rounded-xl border border-violet-200 bg-violet-50 p-4">
                <p className="text-sm text-violet-700">Comments</p>
                <p className="text-2xl font-bold text-violet-800 mt-1">{data.total_comments}</p>
              </div>
              <div className="bg-white rounded-xl border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-green-700">Good</p>
                <p className="text-2xl font-bold text-green-800 mt-1">{data.positive_feedback}</p>
              </div>
              <div className="bg-white rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">Bad</p>
                <p className="text-2xl font-bold text-red-800 mt-1">{data.negative_feedback}</p>
              </div>
              <div className="bg-white rounded-xl border border-sky-200 bg-sky-50 p-4">
                <p className="text-sm text-sky-700">Positive Rate</p>
                <p className="text-2xl font-bold text-sky-800 mt-1">{data.positive_rate}%</p>
              </div>
              <div className="bg-white rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-700">Unique Feedback Users</p>
                <p className="text-2xl font-bold text-amber-800 mt-1">{data.unique_feedback_users}</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-800 mb-4 inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Feature-wise Feedback
                </h2>
                <div className="space-y-3">
                  {data.by_feature.map((item) => (
                    <div key={item.feature} className="rounded-xl border border-gray-100 p-3">
                      <div className="flex justify-between items-center">
                        <p className="font-medium text-gray-800 capitalize">{item.feature}</p>
                        <p className="text-sm text-gray-600">{item.total} total</p>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <p className="text-green-700">Positive: {item.positive}</p>
                        <p className="text-red-700">Negative: {item.negative}</p>
                      </div>
                    </div>
                  ))}
                  {data.by_feature.length === 0 && (
                    <p className="text-sm text-gray-500">No feedback yet.</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-800 mb-4 inline-flex items-center gap-2">
                  <Users className="h-4 w-4 text-sky-600" />
                  Daily Feedback (Last 14 Days)
                </h2>
                <div className="space-y-2">
                  {data.daily_feedback.map((item) => (
                    <div key={item.date} className="text-sm">
                      <div className="flex justify-between text-gray-600 mb-1">
                        <span>{item.date}</span>
                        <span>{item.total}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-sky-500"
                          style={{ width: `${Math.max((item.total / maxDailyCount) * 100, item.total > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 mt-6">
              <h2 className="font-semibold text-gray-800 mb-4 inline-flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-violet-600" />
                Recent Feedback Notes
              </h2>
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {data.recent_notes.map((item) => (
                  <div key={item.id} className="rounded-xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800 capitalize">{item.feature}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.user_name || 'Anonymous'}</p>
                      </div>
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-full',
                        item.helpful ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      )}>
                        {item.helpful ? 'Good' : 'Bad'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{item.subject}</p>
                    <p className="text-sm text-gray-700 mt-2">{item.note}</p>
                    <p className="text-xs text-gray-400 mt-2">{formatDateTime(item.created_at)}</p>
                  </div>
                ))}
                {data.recent_notes.length === 0 && (
                  <p className="text-sm text-gray-500">No feedback notes yet.</p>
                )}
              </div>
            </div>

            <div className="mt-4 text-xs text-gray-500 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Last updated: {formatDateTime(data.generated_at)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
