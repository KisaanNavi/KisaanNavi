const FEEDBACK_QUEUE_KEY = 'kisaannavi_feedback_queue'
const FEEDBACK_QUEUE_EVENT = 'kisaannavi-feedback-queue-changed'

export interface FeedbackPayload {
  feature: string
  subject: string
  helpful: boolean
  note?: string
  metadata?: Record<string, unknown>
}

function readQueue(): FeedbackPayload[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeQueue(items: FeedbackPayload[]): void {
  try {
    localStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify(items))
  } catch {
    // Ignore queue write failures
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FEEDBACK_QUEUE_EVENT, { detail: { count: items.length } }))
  }
}

export function queueFeedback(payload: FeedbackPayload): void {
  const queue = readQueue()
  queue.push(payload)
  writeQueue(queue)
}

export function getQueuedFeedbackCount(): number {
  return readQueue().length
}

export function getFeedbackQueueEventName(): string {
  return FEEDBACK_QUEUE_EVENT
}

export async function flushFeedbackQueue(
  submitter: (payload: FeedbackPayload) => Promise<void>
): Promise<number> {
  const queue = readQueue()
  if (!queue.length) return 0

  const remaining: FeedbackPayload[] = []
  let flushed = 0

  for (const item of queue) {
    try {
      await submitter(item)
      flushed += 1
    } catch {
      remaining.push(item)
    }
  }

  writeQueue(remaining)
  return flushed
}
