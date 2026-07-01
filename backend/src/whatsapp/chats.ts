import Database from 'better-sqlite3'
import path from 'path'
import { Server } from 'socket.io'
import { getDb } from './db.js'

export function handleChatsSet(workspaceId: string, data: any, io: Server) {
  const db = getDb()
  const chats: any[] = data.chats || []

  const stmt = db.prepare(`
    INSERT INTO chats (id, workspace_id, name, last_message_timestamp, unread_count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id, workspace_id) DO UPDATE SET
      name = COALESCE(excluded.name, chats.name),
      last_message_timestamp = COALESCE(excluded.last_message_timestamp, chats.last_message_timestamp),
      unread_count = COALESCE(excluded.unread_count, chats.unread_count)
  `)

  const formatted = chats.map((c: any) => {
    const name = c.name || c.id?.split('@')[0] || 'Unknown'
    stmt.run(c.id, workspaceId, name, c.conversationTimestamp || null, c.unreadCount || 0)
    return {
      id: c.id,
      name,
      lastMessageTimestamp: c.conversationTimestamp || null,
      unreadCount: c.unreadCount || 0,
    }
  })

  io.emit('chats.set', { workspaceId, chats: formatted })
}

export function handleChatsUpsert(workspaceId: string, chats: any[], io: Server) {
  const db = getDb()

  const stmt = db.prepare(`
    INSERT INTO chats (id, workspace_id, name, last_message_timestamp, unread_count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id, workspace_id) DO UPDATE SET
      name = COALESCE(excluded.name, chats.name),
      last_message_timestamp = COALESCE(excluded.last_message_timestamp, chats.last_message_timestamp),
      unread_count = COALESCE(excluded.unread_count, chats.unread_count)
  `)

  const formatted = chats.map((c: any) => {
    const name = c.name || c.id?.split('@')[0] || 'Unknown'
    stmt.run(c.id, workspaceId, name, c.conversationTimestamp || null, c.unreadCount || 0)
    return {
      id: c.id,
      name,
      lastMessageTimestamp: c.conversationTimestamp || null,
      unreadCount: c.unreadCount || 0,
    }
  })

  io.emit('chats.update', { workspaceId, chats: formatted })
}
