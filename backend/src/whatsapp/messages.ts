import { getDb } from '../core/db.js'
import { normalizeMessage } from './normalizer.js'
import type { EventDispatcher, DispatchContext } from '../core/dispatcher.js'

function persistMessages(ctx: DispatchContext, data: any) {
  const db = getDb()
  const raw: any[] = data.messages || []

  const msgStmt = db.prepare(`
    INSERT INTO messages (
      id, workspace_id, chat_id, from_me, sender, timestamp,
      message_type, text_content, quoted_message_id, quoted_text,
      media_url, media_mime_type, media_size, media_width, media_height,
      media_sha256, media_storage_path, media_download_status, status, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id, workspace_id) DO NOTHING
  `)

  const chatStmt = db.prepare(`
    UPDATE chats SET
      last_message_text = ?,
      last_message_timestamp = ?,
      last_message_from_me = ?,
      last_message_type = ?,
      unread_count = CASE WHEN ? = 0 THEN unread_count + 1 ELSE unread_count END
    WHERE id = ? AND workspace_id = ?
  `)

  const insertMany = db.transaction((msgs: any[]) => {
    const normalized: NormalizedMessage[] = []

    for (const msg of msgs) {
      const f = normalizeMessage(msg)
      if (!f) continue
      normalized.push(f)

      msgStmt.run(
        f.id, ctx.workspaceId, f.chatId, f.fromMe, f.sender,
        f.timestamp, f.messageType, f.textContent,
        f.quotedMessageId, f.quotedText,
        f.mediaUrl, f.mediaMimeType, f.mediaSize,
        f.mediaWidth, f.mediaHeight,
        f.mediaSha256, f.mediaStoragePath, f.mediaSha256 ? 'pending' : 'none',
        f.status, f.dataJson,
      )

      if (f.textContent || f.messageType) {
        chatStmt.run(
          f.textContent,
          f.timestamp || Math.floor(Date.now() / 1000),
          f.fromMe,
          f.messageType,
          f.fromMe,
          f.chatId,
          ctx.workspaceId,
        )
      }
    }

    return normalized
  })

  const normalized = insertMany(raw)

  // Emit to Socket.IO only after persistence succeeds
  if (normalized.length > 0) {
    ctx.io.emit('message.created', {
      workspaceId: ctx.workspaceId,
      messages: normalized,
    })
  }
}

function persistUpdate(ctx: DispatchContext, data: any) {
  const db = getDb()
  const updates: any[] = data || []

  const stmt = db.prepare(`
    UPDATE messages SET status = ?, text_content = ?, data_json = ?
    WHERE id = ? AND workspace_id = ?
  `)

  db.transaction(() => {
    for (const u of updates) {
      const msgId = u.key?.id
      if (!msgId) continue
      const existing = db.prepare('SELECT data_json FROM messages WHERE id = ? AND workspace_id = ?').get(msgId, ctx.workspaceId) as any
      if (!existing) continue
      const orig = JSON.parse(existing.data_json)
      const merged = { ...orig, ...u.update, key: u.key, status: u.update?.status || orig.status }
      stmt.run(
        u.update?.status || orig.status,
        u.update?.text || null,
        JSON.stringify(merged),
        msgId,
        ctx.workspaceId,
      )
    }
  })()

  ctx.io.emit('message.updated', { workspaceId: ctx.workspaceId, updates })
}

function persistDelete(ctx: DispatchContext, data: any) {
  const db = getDb()
  const keys = data?.keys || []

  db.transaction(() => {
    for (const key of keys) {
      const id = key?.id
      if (!id) continue
      const msg = db.prepare('SELECT data_json FROM messages WHERE id = ? AND workspace_id = ?').get(id, ctx.workspaceId) as any
      if (!msg) continue
      const parsed = JSON.parse(msg.data_json)
      parsed.message = null
      parsed._deleted = true
      db.prepare('UPDATE messages SET message_type = ?, text_content = ?, data_json = ? WHERE id = ? AND workspace_id = ?')
        .run('deleted', 'This message was deleted', JSON.stringify(parsed), id, ctx.workspaceId)
    }
  })()

  ctx.io.emit('message.deleted', { workspaceId: ctx.workspaceId, messageIds: keys.map((k: any) => k.id).filter(Boolean) })
}

import type { NormalizedMessage } from './normalizer.js'

export function registerMessageHandlers(dispatcher: EventDispatcher) {
  dispatcher.on('messages.upsert', persistMessages)
  dispatcher.on('messages.update', persistUpdate)
  dispatcher.on('messages.delete', persistDelete)
}
