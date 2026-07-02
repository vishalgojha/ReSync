import { getDb } from '../core/db.js'

export interface MemoryItem {
  id: number
  chat_id: string
  workspace_id: string
  memory_type: string
  key: string | null
  value: string
  source: string | null
  confidence: number
  created_at: number
  updated_at: number
}

export interface TopicItem {
  id: number
  chat_id: string
  workspace_id: string
  topic: string
  last_mentioned_at: number
  mention_count: number
  message_id: string | null
}

// ── Pinned facts ──

export function addFact(workspaceId: string, chatId: string, fact: string, source?: string): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO conversation_memory (chat_id, workspace_id, memory_type, value, source)
    VALUES (?, ?, 'fact', ?, ?)
  `).run(chatId, workspaceId, fact, source || null)
}

export function getFacts(workspaceId: string, chatId: string): MemoryItem[] {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM conversation_memory
    WHERE workspace_id = ? AND chat_id = ? AND memory_type = 'fact'
    ORDER BY created_at DESC
  `).all(workspaceId, chatId) as MemoryItem[]
}

// ── Entities (detected from text) ──

export function addEntity(workspaceId: string, chatId: string, key: string, value: string, source?: string): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO conversation_memory (chat_id, workspace_id, memory_type, key, value, source, confidence)
    VALUES (?, ?, 'entity', ?, ?, ?, 0.7)
    ON CONFLICT DO NOTHING
  `).run(chatId, workspaceId, key, value, source || null)
}

export function getEntities(workspaceId: string, chatId: string): MemoryItem[] {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM conversation_memory
    WHERE workspace_id = ? AND chat_id = ? AND memory_type = 'entity'
    ORDER BY confidence DESC, updated_at DESC
  `).all(workspaceId, chatId) as MemoryItem[]
}

// ── Frequently mentioned contacts ──

export function trackContactMention(workspaceId: string, chatId: string, contactJid: string, contactName: string): void {
  const db = getDb()
  const existing = db.prepare(`
    SELECT * FROM conversation_memory
    WHERE workspace_id = ? AND chat_id = ? AND memory_type = 'contact' AND key = ?
  `).get(workspaceId, chatId, contactJid) as MemoryItem | undefined

  if (existing) {
    db.prepare(`
      UPDATE conversation_memory SET
        value = ?,
        confidence = MIN(1.0, confidence + 0.1),
        updated_at = unixepoch()
      WHERE id = ?
    `).run(contactName, existing.id)
  } else {
    db.prepare(`
      INSERT INTO conversation_memory (chat_id, workspace_id, memory_type, key, value, confidence)
      VALUES (?, ?, 'contact', ?, ?, 0.3)
    `).run(chatId, workspaceId, contactJid, contactName)
  }
}

export function getTrackedContacts(workspaceId: string, chatId: string): MemoryItem[] {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM conversation_memory
    WHERE workspace_id = ? AND chat_id = ? AND memory_type = 'contact'
    ORDER BY confidence DESC, updated_at DESC
    LIMIT 10
  `).all(workspaceId, chatId) as MemoryItem[]
}

// ── Frequently shared files ──

export function trackFileShare(workspaceId: string, chatId: string, fileName: string, mimeType: string, size: number): void {
  const db = getDb()
  const existing = db.prepare(`
    SELECT * FROM conversation_memory
    WHERE workspace_id = ? AND chat_id = ? AND memory_type = 'file' AND key = ?
  `).get(workspaceId, chatId, fileName) as MemoryItem | undefined

  if (existing) {
    db.prepare(`
      UPDATE conversation_memory SET
        value = ?,
        confidence = MIN(1.0, confidence + 0.15),
        updated_at = unixepoch()
      WHERE id = ?
    `).run(JSON.stringify({ mimeType, size }), existing.id)
  } else {
    db.prepare(`
      INSERT INTO conversation_memory (chat_id, workspace_id, memory_type, key, value, confidence)
      VALUES (?, ?, 'file', ?, ?, 0.4)
    `).run(chatId, workspaceId, fileName, JSON.stringify({ mimeType, size }))
  }
}

export function getTrackedFiles(workspaceId: string, chatId: string): MemoryItem[] {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM conversation_memory
    WHERE workspace_id = ? AND chat_id = ? AND memory_type = 'file'
    ORDER BY confidence DESC, updated_at DESC
    LIMIT 10
  `).all(workspaceId, chatId) as MemoryItem[]
}

// ── Topics ──

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'it', 'its', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him',
  'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their', 'not', 'no',
  'yes', 'ok', 'okay', 'sure', 'thanks', 'thank', 'please', 'hi', 'hello',
  'hey', 'yeah', 'nah', 'oh', 'ah', 'well', 'so', 'just', 'also', 'very',
  'really', 'quite', 'some', 'any', 'all', 'every', 'each', 'both', 'few',
  'more', 'most', 'other', 'such', 'only', 'own', 'same', 'too', 'very',
  'get', 'got', 'go', 'went', 'come', 'came', 'take', 'took', 'make', 'made',
  'see', 'saw', 'know', 'knew', 'think', 'thought', 'want', 'wanted', 'give',
  'gave', 'find', 'found', 'tell', 'told', 'ask', 'asked', 'try', 'tried',
  'leave', 'left', 'call', 'called', 'send', 'sent', 'let', 'need', 'like',
  'use', 'used', 'set', 'put', 'say', 'said', 'look', 'looked', 'help',
  'dm', 'whatsapp', 'msg', 'pls', 'plz',
])

function extractTopics(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s#@]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))

  const freq = new Map<string, number>()
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1)
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word)
}

export function trackTopics(workspaceId: string, chatId: string, text: string, messageId: string, timestamp: number): void {
  const db = getDb()
  const topics = extractTopics(text)
  if (topics.length === 0) return

  db.transaction(() => {
    for (const topic of topics) {
      const existing = db.prepare(`
        SELECT * FROM conversation_topics
        WHERE workspace_id = ? AND chat_id = ? AND topic = ?
      `).get(workspaceId, chatId, topic) as TopicItem | undefined

      if (existing) {
        db.prepare(`
          UPDATE conversation_topics SET
            mention_count = mention_count + 1,
            last_mentioned_at = ?,
            message_id = ?
          WHERE id = ?
        `).run(timestamp, messageId, existing.id)
      } else {
        db.prepare(`
          INSERT INTO conversation_topics (chat_id, workspace_id, topic, last_mentioned_at, mention_count, message_id)
          VALUES (?, ?, ?, ?, 1, ?)
        `).run(chatId, workspaceId, topic, timestamp, messageId)
      }
    }
  })()
}

export function getTopics(workspaceId: string, chatId: string, limit = 15): TopicItem[] {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM conversation_topics
    WHERE workspace_id = ? AND chat_id = ?
    ORDER BY last_mentioned_at DESC, mention_count DESC
    LIMIT ?
  `).all(workspaceId, chatId, limit) as TopicItem[]
}
