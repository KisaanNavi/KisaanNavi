import { useMemo, useState } from 'react'
import { Loader2, MessageSquareText, ThumbsDown, ThumbsUp } from 'lucide-react'

import { useLanguage } from '@/contexts/LanguageContext'
import { submitFeedback, type FeedbackPayload } from '@/services/api'
import { queueFeedback } from '@/utils/feedbackQueue'

interface FeedbackWidgetProps {
  feature: string
  subject: string
  metadata?: Record<string, unknown>
}

export function FeedbackWidget({ feature, subject, metadata }: FeedbackWidgetProps) {
  const { language } = useLanguage()
  const [selected, setSelected] = useState<boolean | null>(null)
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sent' | 'queued'>('idle')

  const ui = useMemo(() => {
    if (language === 'hi') {
      return {
        title: 'क्या यह सलाह उपयोगी थी?',
        hint: 'आपकी प्रतिक्रिया से मॉडल और सलाह बेहतर होगी।',
        helpful: 'हाँ',
        notHelpful: 'नहीं',
        notePlaceholder: 'छोटा नोट लिखें (वैकल्पिक)',
        send: 'प्रतिक्रिया भेजें',
        sent: 'प्रतिक्रिया दर्ज हो गई',
        queued: 'ऑफलाइन होने के कारण प्रतिक्रिया कतार में रखी गई',
      }
    }
    if (language === 'te') {
      return {
        title: 'ఈ సలహా ఉపయోగకరంగా ఉందా?',
        hint: 'మీ అభిప్రాయం వల్ల మోడల్ మరియు సలహా మెరుగవుతుంది.',
        helpful: 'అవును',
        notHelpful: 'లేదు',
        notePlaceholder: 'చిన్న గమనిక రాయండి (ఐచ్ఛికం)',
        send: 'ఫీడ్‌బ్యాక్ పంపండి',
        sent: 'ఫీడ్‌బ్యాక్ సేవ్ అయింది',
        queued: 'ఆఫ్లైన్‌లో ఉన్నందున ఫీడ్‌బ్యాక్ క్యూలో ఉంచాం',
      }
    }
    return {
      title: 'Was this advisory useful?',
      hint: 'Your feedback helps improve the model and recommendations.',
      helpful: 'Yes',
      notHelpful: 'No',
      notePlaceholder: 'Add a short note (optional)',
      send: 'Send feedback',
      sent: 'Feedback submitted',
      queued: 'You are offline, so feedback was queued for sync',
    }
  }, [language])

  const handleSubmit = async () => {
    if (selected === null || isSubmitting) return

    const payload: FeedbackPayload = {
      feature,
      subject,
      helpful: selected,
      note: note.trim() || undefined,
      metadata,
    }

    setIsSubmitting(true)
    try {
      const response = await submitFeedback(payload)
      setStatus(response.queued ? 'queued' : 'sent')
    } catch {
      queueFeedback(payload)
      setStatus('queued')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start gap-3">
        <MessageSquareText className="h-5 w-5 text-gray-500 mt-0.5 shrink-0" />
        <div className="flex-1">
          <h4 className="font-semibold text-gray-800">{ui.title}</h4>
          <p className="text-sm text-gray-500 mt-1">{ui.hint}</p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSelected(true)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 border ${
                selected === true ? 'border-green-500 bg-green-100 text-green-800' : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              <ThumbsUp className="h-4 w-4" />
              <span>{ui.helpful}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelected(false)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 border ${
                selected === false ? 'border-red-500 bg-red-100 text-red-800' : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              <ThumbsDown className="h-4 w-4" />
              <span>{ui.notHelpful}</span>
            </button>
          </div>

          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={ui.notePlaceholder}
            rows={3}
            className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={selected === null || isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-white disabled:bg-gray-300"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span>{ui.send}</span>
            </button>
            {status === 'sent' && <span className="text-sm text-green-700">{ui.sent}</span>}
            {status === 'queued' && <span className="text-sm text-amber-700">{ui.queued}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
