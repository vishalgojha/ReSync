import { Server } from 'socket.io'
import { getDb } from './db.js'
import { extractMessageFields } from './extract.js'

export function handleMessagesUpsert(workspaceId: string, data: any, io: Server) {
  const db = getDb()
  const rawMessages: any[] = data.messages || []

  const stmt = db.prepare(`
    INSERT INTO messages (
      id, workspace_id, chat_id, from_me, sender, timestamp,
      message_type, text_content, quoted_message_id,
      media_url, media_mime_type, media_size, media_width, media_height,
      status, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id, workspace_id) DO NOTHING
  `)

  const insertMany = db.transaction((msgs: any[]) => {
    for (const msg of msgs) {
      const fields = extractMessageFields(msg)
      if (!fields) continue
      stmt.run(
        fields.id, workspaceId, fields.chatId, fields.fromMe, fields.sender,
        fields.timestamp, fields.messageType, fields.textContent,
        fields.quotedMessageId, fields.mediaUrl, fields.mediaMimeType,
        fields.mediaSize, fields.mediaWidth, fields.mediaHeight,
        fields.status, fields.dataJson,
      )
      updateChatLastMessage(workspaceId, fields.chatId, fields.textContent, fields.timestamp)
    }
  })

  insertMany(rawMessages)
  io.emit('message.new', { workspaceId, messages: rawMessages })
}

function updateChatLastMessage(
  workspaceId: string,
  chatId: string,
  text: string | null,
  timestamp: number | null,
) {
  if (!text) return
  const db = getDb()
  db.prepare(`
    UPDATE chats SET last_message_text = ?, last_message_timestamp = ?
    WHERE id = ? AND workspace_id = ?
  `).run(text, timestamp || Math.floor(Date.now() / 1000), chatId, workspaceId)
}
