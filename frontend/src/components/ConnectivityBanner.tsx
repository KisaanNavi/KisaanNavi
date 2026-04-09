import { useEffect, useMemo, useState } from 'react'
import { CloudOff, RefreshCcw, Wifi } from 'lucide-react'

import { useLanguage } from '@/contexts/LanguageContext'
import { syncPendingFeedback } from '@/services/api'
import { getFeedbackQueueEventName, getQueuedFeedbackCount } from '@/utils/feedbackQueue'


export function ConnectivityBanner() {
  const { language } = useLanguage()
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  )
  const [pendingFeedback, setPendingFeedback] = useState(getQueuedFeedbackCount())
  const [syncedCount, setSyncedCount] = useState(0)

  const ui = useMemo(() => {
    if (language === 'hi') {
      return {
        offlineTitle: 'ऑफलाइन मोड',
        syncTitle: 'सिंक लंबित',
        onlineTitle: 'फिर से ऑनलाइन',
        offline: 'आप ऑफलाइन हैं। पहले से सेव की गई सलाह दिखाई जाएगी।',
        queued: (count: number) => `${count} फीडबैक सिंक होने के लिए कतार में हैं।`,
        synced: (count: number) => `${count} लंबित फीडबैक अभी सिंक किए गए।`,
      }
    }
    if (language === 'te') {
      return {
        offlineTitle: 'ఆఫ్లైన్ మోడ్',
        syncTitle: 'సింక్ పెండింగ్',
        onlineTitle: 'మళ్లీ ఆన్‌లైన్‌లోకి వచ్చారు',
        offline: 'మీరు ఆఫ్లైన్‌లో ఉన్నారు. సేవ్ చేసిన సలహాలను చూపిస్తాం.',
        queued: (count: number) => `${count} ఫీడ్బ్యాక్ అంశాలు సింక్ కోసం వేచి ఉన్నాయి.`,
        synced: (count: number) => `${count} పెండింగ్ ఫీడ్బ్యాక్ అంశాలు ఇప్పుడే సింక్ అయ్యాయి.`,
      }
    }
    return {
      offlineTitle: 'Offline mode',
      syncTitle: 'Sync pending',
      onlineTitle: 'Back online',
      offline: 'You are offline. Saved advisories will be used until the connection returns.',
      queued: (count: number) => `${count} feedback item${count === 1 ? '' : 's'} waiting to sync.`,
      synced: (count: number) => `${count} pending feedback item${count === 1 ? '' : 's'} synced successfully.`,
    }
  }, [language])

  useEffect(() => {
    const queueEventName = getFeedbackQueueEventName()

    const refreshQueue = () => {
      setPendingFeedback(getQueuedFeedbackCount())
    }

    const handleOffline = () => {
      setIsOnline(false)
      refreshQueue()
    }

    const handleOnline = async () => {
      setIsOnline(true)
      const synced = await syncPendingFeedback()
      setSyncedCount(synced)
      refreshQueue()
      if (synced > 0) {
        window.setTimeout(() => setSyncedCount(0), 5000)
      }
    }

    const handleOnlineEvent = () => {
      void handleOnline()
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnlineEvent)
    window.addEventListener(queueEventName, refreshQueue as EventListener)

    refreshQueue()
    if (navigator.onLine) {
      void handleOnline()
    }

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnlineEvent)
      window.removeEventListener(queueEventName, refreshQueue as EventListener)
    }
  }, [])

  if (isOnline && pendingFeedback === 0 && syncedCount === 0) {
    return null
  }

  return (
    <div className="px-4 pt-4">
      {!isOnline && (
        <div className="mx-auto mb-3 max-w-7xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 flex items-start gap-3">
          <CloudOff className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{ui.offlineTitle}</p>
            <p className="text-sm">{ui.offline}</p>
            {pendingFeedback > 0 && <p className="text-sm mt-1">{ui.queued(pendingFeedback)}</p>}
          </div>
        </div>
      )}

      {isOnline && pendingFeedback > 0 && (
        <div className="mx-auto mb-3 max-w-7xl rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800 flex items-start gap-3">
          <RefreshCcw className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{ui.syncTitle}</p>
            <p className="text-sm">{ui.queued(pendingFeedback)}</p>
          </div>
        </div>
      )}

      {isOnline && syncedCount > 0 && (
        <div className="mx-auto mb-3 max-w-7xl rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-green-800 flex items-start gap-3">
          <Wifi className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{ui.onlineTitle}</p>
            <p className="text-sm">{ui.synced(syncedCount)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
