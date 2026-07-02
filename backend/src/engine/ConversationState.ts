import { getDb } from '../core/db.js'

export interface ConversationStateRow {
  chat_id: string
  workspace_id: string
  first_message_at: number | null
  first_message_text: string | null
  first_message_from_me: number | null
  last_message_at: number | null
  last_message_text: string | null
  last_message_from_me: number | null
  last_outgoing_at: number | null
  last_incoming_at: number | null
  unread_count: number
  message_count: number
  media_count: number
  participant_count: number
  total_response_time_ms: number
  response_count: number
  average_reply_delay: number
  health_score: number
  last_status: string | null
  created_at: number
  updated_at: number
}

export function ensureConversationState(workspaceId: string, chatId: string): void {
  const db = getDb()
  db.prepare(`
    INSERT OR IGNORE INTO conversation_state (chat_id, workspace_id)
    VALUES (?, ?)
  `).run(chatId, workspaceId)
}

export function getConversationState(workspaceId: string, chatId: string): ConversationStateRow | null {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM conversation_state WHERE chat_id = ? AND workspace_id = ?
  `).get(chatId, workspaceId) as ConversationStateRow | null
}

export function updateMessageCounts(workspaceId: string, chatId: string, msg: {
  fromMe: number
  timestamp: number
  textContent: string | null
  messageType: string | null
}): void {
  const db = getDb()
  const state = getConversationState(workspaceId, chatId)
  const isIncoming = msg.fromMe === 0
  const isMedia = ['imageMessage', 'videoMessage', 'audioMessage', 'ptvMessage', 'documentMessage', 'stickerMessage'].includes(msg.messageType || '')

  db.transaction(() => {
    ensureConversationState(workspaceId, chatId)

    const firstMsg = db.prepare(`
      SELECT timestamp FROM conversation_state WHERE chat_id = ? AND workspace_id = ?
    `).get(chatId, workspaceId) as any

    const wasFirstMessage = !firstMsg?.first_message_at

    // Compute response time for incoming replies to outgoing
    let responseTimeMs = 0
    if (isIncoming && state && state.last_outgoing_at && msg.timestamp > state.last_outgoing_at) {
      responseTimeMs = (msg.timestamp - state.last_outgoing_at) * 1000
    }

    // Compute response time for outgoing replies to incoming
    if (msg.fromMe && state && state.last_incoming_at && msg.timestamp > state.last_incoming_at) {
      responseTimeMs = (msg.timestamp - state.last_incoming_at) * 1000
    }

    const newResponseCount = state ? state.response_count + (responseTimeMs > 0 ? 1 : 0) : (responseTimeMs > 0 ? 1 : 0)
    const newTotalResponseTime = state ? state.total_response_time_ms + responseTimeMs : responseTimeMs
    const avgDelay = newResponseCount > 0 ? newTotalResponseTime / newResponseCount : 0

    // Health score: 0-1 based on responsiveness, message count, and recency
    const recentThreshold = Date.now() / 1000 - 7 * 86400
    const recentActivity = msg.timestamp >= recentThreshold ? 1 : 0
    const messageBalance = state
      ? Math.min(1, (state.message_count + 1) / 100)
      : 0
    const responsiveness = avgDelay > 0
      ? Math.max(0, 1 - avgDelay / (86400 * 1000))
      : 0.5
    const healthScore = Math.round((responsiveness * 0.5 + messageBalance * 0.3 + recentActivity * 0.2) * 100) / 100

    db.prepare(`
      UPDATE conversation_state SET
        first_message_at = COALESCE(first_message_at, ?),
        first_message_text = COALESCE(first_message_text, ?),
        first_message_from_me = COALESCE(first_message_from_me, ?),
        last_message_at = ?,
        last_message_text = ?,
        last_message_from_me = ?,
        last_outgoing_at = CASE WHEN ? THEN ? ELSE last_outgoing_at END,
        last_incoming_at = CASE WHEN ? THEN ? ELSE last_incoming_at END,
        message_count = message_count + 1,
        media_count = media_count + ?,
        total_response_time_ms = ?,
        response_count = ?,
        average_reply_delay = ?,
        health_score = ?,
        updated_at = unixepoch()
      WHERE chat_id = ? AND workspace_id = ?
    `).run(
      wasFirstMessage ? msg.timestamp : null,
      wasFirstMessage ? msg.textContent : null,
      wasFirstMessage ? msg.fromMe : null,
      msg.timestamp,
      msg.textContent,
      msg.fromMe,
      msg.fromMe, msg.timestamp,
      isIncoming, msg.timestamp,
      isMedia ? 1 : 0,
      newTotalResponseTime,
      newResponseCount,
      avgDelay,
      healthScore,
      chatId, workspaceId,
    )
  })()
}

export function updateParticipantCount(workspaceId: string, chatId: string, count: number): void {
  const db = getDb()
  ensureConversationState(workspaceId, chatId)
  db.prepare(`
    UPDATE conversation_state SET participant_count = ?, updated_at = unixepoch()
    WHERE chat_id = ? AND workspace_id = ?
  `).run(count, chatId, workspaceId)
}

export function updateUnreadCount(workspaceId: string, chatId: string, delta: number): void {
  const db = getDb()
  ensureConversationState(workspaceId, chatId)
  db.prepare(`
    UPDATE conversation_state SET
      unread_count = MAX(0, unread_count + ?),
      updated_at = unixepoch()
    WHERE chat_id = ? AND workspace_id = ?
  `).run(delta, chatId, workspaceId)
}

export function resetUnreadCount(workspaceId: string, chatId: string): void {
  const db = getDb()
  ensureConversationState(workspaceId, chatId)
  db.prepare(`
    UPDATE conversation_state SET unread_count = 0, updated_at = unixepoch()
    WHERE chat_id = ? AND workspace_id = ?
  `).run(chatId, workspaceId)
}
