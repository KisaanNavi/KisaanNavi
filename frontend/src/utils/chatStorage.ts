const STORAGE_KEY = 'kisaannavi_chat_sessions'
const ACTIVE_SESSION_KEY = 'kisaannavi_chat_active_session'
const MAX_MESSAGES = 50
const MAX_DAYS = 30

interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ChatSession {
  id: string
  messages: StoredMessage[]
  lastVisit: string
}

function isExpired(timestamp: string): boolean {
  const messageDate = new Date(timestamp)
  const now = new Date()
  const diffDays = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays > MAX_DAYS
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function loadSessions(): ChatSession[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []

    const sessions = JSON.parse(stored) as ChatSession[]
    return sessions
      .map((session) => ({
        ...session,
        messages: (session.messages || [])
          .filter((msg) => !isExpired(msg.timestamp))
          .slice(-MAX_MESSAGES)
      }))
      .filter((session) => session.messages.length > 0)
      .sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime())
  } catch {
    return []
  }
}

function saveSessions(sessions: ChatSession[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

function getActiveSessionId(): string | null {
  return localStorage.getItem(ACTIVE_SESSION_KEY)
}

function setActiveSessionId(sessionId: string): void {
  localStorage.setItem(ACTIVE_SESSION_KEY, sessionId)
}

function ensureActiveSession(): string {
  const sessions = loadSessions()
  const currentId = getActiveSessionId()

  if (currentId && sessions.some((session) => session.id === currentId)) {
    return currentId
  }

  if (sessions.length > 0) {
    setActiveSessionId(sessions[0].id)
    return sessions[0].id
  }

  const newId = generateSessionId()
  setActiveSessionId(newId)
  return newId
}

export function startNewChatSession(): string {
  const newId = generateSessionId()
  setActiveSessionId(newId)
  return newId
}

export function loadChatHistory(): StoredMessage[] {
  const sessions = loadSessions()
  const activeId = ensureActiveSession()
  const active = sessions.find((session) => session.id === activeId)
  return active?.messages || []
}

export function saveChatHistory(messages: StoredMessage[]): void {
  try {
    const trimmedMessages = messages
      .filter((msg) => msg.id !== 'welcome')
      .filter((msg) => !isExpired(msg.timestamp))
      .slice(-MAX_MESSAGES)

    const sessions = loadSessions()
    const activeId = ensureActiveSession()
    const now = new Date().toISOString()
    const index = sessions.findIndex((session) => session.id === activeId)

    if (index >= 0) {
      sessions[index] = {
        ...sessions[index],
        messages: trimmedMessages,
        lastVisit: now
      }
    } else {
      sessions.unshift({
        id: activeId,
        messages: trimmedMessages,
        lastVisit: now
      })
    }

    saveSessions(sessions.filter((session) => session.messages.length > 0))
  } catch {
    console.warn('Could not save chat history')
  }
}

export function getLastVisit(): Date | null {
  try {
    const sessions = loadSessions()
    const activeId = ensureActiveSession()
    const active = sessions.find((session) => session.id === activeId)
    if (!active) return null
    return new Date(active.lastVisit)
  } catch {
    return null
  }
}

export function getLastTopic(): string | null {
  try {
    const messages = loadChatHistory()
    if (messages.length === 0) return null
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    return lastUserMessage?.content || null
  } catch {
    return null
  }
}

export function formatLastVisit(date: Date, lang: string): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (lang === 'hi') {
    if (diffMins < 60) return `${diffMins} min pehle`
    if (diffHours < 24) return `${diffHours} ghante pehle`
    if (diffDays === 1) return 'kal'
    return `${diffDays} din pehle`
  }

  if (lang === 'te') {
    if (diffMins < 60) return `${diffMins} nimishalu kritam`
    if (diffHours < 24) return `${diffHours} gantalu kritam`
    if (diffDays === 1) return 'ninna'
    return `${diffDays} rojulu kritam`
  }

  if (diffMins < 60) return `${diffMins} minutes ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  if (diffDays === 1) return 'yesterday'
  return `${diffDays} days ago`
}
