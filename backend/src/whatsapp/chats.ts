import { getDb } from '../core/db.js'
import type { EventDispatcher, DispatchContext } from '../core/dispatcher.js'

function persistSet(ctx: DispatchContext, data: any) {
  const db = getDb()
  const chats: any[] = data.chats || []

  const stmt = db.prepare(`
    INSERT INTO chats (id, workspace_id, name, last_message_text, last_message_timestamp, last_message_from_me, last_message_type, unread_count, archived, pinned, muted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id, workspace_id) DO UPDATE SET
      name = COALESCE(excluded.name, chats.name),
      last_message_text = COALESCE(excluded.last_message_text, chats.last_message_text),
      last_message_timestamp = COALESCE(excluded.last_message_timestamp, chats.last_message_timestamp),
      last_message_from_me = COALESCE(excluded.last_message_from_me, chats.last_message_from_me),
      last_message_type = COALESCE(excluded.last_message_type, chats.last_message_type),
      unread_count = COALESCE(excluded.unread_count, chats.unread_count),
      archived = COALESCE(excluded.archived, chats.archived),
      pinned = COALESCE(excluded.pinned, chats.pinned),
      muted = COALESCE(excluded.muted, chats.muted)
  `)

  const inserted = db.transaction(() => {
    const result: any[] = []
    for (const c of chats) {
      const id = c.id
      const name = c.name || c.subject || null
      const lastMsg = c.lastMessage?.conversation || c.lastMessage?.extendedTextMessage?.text || null
      stmt.run(
        id, ctx.workspaceId, name,
        lastMsg,
        c.conversationTimestamp || null,
        c.lastMessage?.key?.fromMe ? 1 : 0,
        c.lastMessage?.message ? Object.keys(c.lastMessage.message)[0] : null,
        c.unreadCount || 0,
        c.archive ? 1 : 0,
        // pin is a timestamp of when it was pinned; treat truthy as pinned
        c.pin ? 1 : 0,
        c.muteEndTime ? 1 : 0,
      )
      result.push({ id, name, lastMessage: lastMsg, timestamp: c.conversationTimestamp, unread: c.unreadCount })
    }
    return result
  })()

  ctx.io.emit('sync.completed', {
    workspaceId: ctx.workspaceId,
    type: 'chats',
    count: chats.length,
  })
}

function persistUpsert(ctx: DispatchContext, chats: any[]) {
  const db = getDb()

  const stmt = db.prepare(`
    INSERT INTO chats (id, workspace_id, name, last_message_text, last_message_timestamp, unread_count)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id, workspace_id) DO UPDATE SET
      last_message_text = COALESCE(excluded.last_message_text, chats.last_message_text),
      last_message_timestamp = COALESCE(excluded.last_message_timestamp, chats.last_message_timestamp),
      unread_count = COALESCE(excluded.unread_count, chats.unread_count)
  `)

  const formatted: any[] = []
  for (const c of chats) {
    const id = c.id
    const name = c.name || c.subject || id?.split('@')[0] || 'Unknown'
    const lastMsg = c.lastMessage?.conversation || c.lastMessage?.extendedTextMessage?.text || null
    stmt.run(id, ctx.workspaceId, name, lastMsg, c.conversationTimestamp || null, c.unreadCount || 0)
    formatted.push({ id, name, lastMessage: lastMsg, timestamp: c.conversationTimestamp, unread: c.unreadCount })
  }

  ctx.io.emit('chat.created', { workspaceId: ctx.workspaceId, chats: formatted })
}

function persistUpdate(ctx: DispatchContext, updates: any[]) {
  const db = getDb()

  const stmt = db.prepare(`
    UPDATE chats SET
      name = COALESCE(?, name),
      unread_count = COALESCE(?, unread_count),
      archived = COALESCE(?, archived),
      pinned = COALESCE(?, pinned),
      muted = COALESCE(?, muted),
      last_message_text = COALESCE(?, last_message_text),
      last_message_timestamp = COALESCE(?, last_message_timestamp)
    WHERE id = ? AND workspace_id = ?
  `)

  const formatted: any[] = []
  for (const u of updates) {
    const id = u.id
    if (!id) continue
    stmt.run(u.name ?? null, u.unreadCount ?? null, u.archive ?? null, u.pin ?? null, u.muteEndTime ?? null, null, null, id, ctx.workspaceId)
    formatted.push(u)
  }

  ctx.io.emit('chat.updated', { workspaceId: ctx.workspaceId, chats: formatted })
}

export function registerChatHandlers(dispatcher: EventDispatcher) {
  dispatcher.on('chats.set', persistSet)
  dispatcher.on('chats.upsert', persistUpsert)
  dispatcher.on('chats.update', persistUpdate)
}
