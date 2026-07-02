import fs from 'fs'
import path from 'path'
import { Boom } from '@hapi/boom'
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import type { Action } from './Action.js'

const downloadMediaAction: Action = {
  id: 'downloadMedia',
  name: 'Download Media',
  description: 'Download media from a message to local storage',
  inputSchema: {
    type: 'object',
    required: ['messageId'],
    properties: {
      messageId: { type: 'string' },
    },
  },
  permissions: [],

  async execute(ctx, input) {
    const row = ctx.database
      .prepare('SELECT data_json FROM messages WHERE id = ? AND workspace_id = ?')
      .get(input.messageId, ctx.workspaceId) as any
    if (!row) {
      throw new Boom('Message not found', { statusCode: 404 })
    }

    const msg = JSON.parse(row.data_json)
    const content = msg.message || {}
    const types = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage']
    let mediaMsg: any = null
    for (const t of types) {
      if (content[t]) { mediaMsg = content[t]; break }
    }
    if (!mediaMsg) {
      throw new Boom('Message is not a media message', { statusCode: 400 })
    }

    const sha256 = mediaMsg.fileSha256 ? Buffer.from(mediaMsg.fileSha256).toString('base64') : null
    if (!sha256) {
      throw new Boom('Cannot identify media', { statusCode: 400 })
    }

    const existing = ctx.database
      .prepare('SELECT storage_path FROM media WHERE sha256 = ?')
      .get(sha256) as any
    if (existing?.storage_path && fs.existsSync(existing.storage_path)) {
      return { status: 'already_downloaded', path: existing.storage_path, mime: mediaMsg.mimeType }
    }

    if (!ctx.baileys) {
      throw new Boom('Session not ready — cannot download media', { statusCode: 400 })
    }

    const mediaDir = path.join(ctx.storage, 'media')
    fs.mkdirSync(mediaDir, { recursive: true })

    try {
      const buffer = await downloadMediaMessage(msg, 'buffer', {})
      const ext = mediaMsg.mimeType?.split('/')[1] || 'bin'
      const fileName = `${sha256}.${ext}`
      const filePath = path.join(mediaDir, fileName)
      fs.writeFileSync(filePath, buffer)

      ctx.database
        .prepare(`INSERT INTO media (sha256, workspace_id, mime_type, file_size, storage_path, download_status, downloaded_at)
          VALUES (?, ?, ?, ?, ?, 'done', unixepoch())
          ON CONFLICT(sha256) DO UPDATE SET download_status = 'done', storage_path = ?, downloaded_at = unixepoch()`)
        .run(sha256, ctx.workspaceId, mediaMsg.mimeType || null, mediaMsg.fileLength ? Number(mediaMsg.fileLength) : null, filePath, filePath)

      ctx.database
        .prepare('UPDATE messages SET media_storage_path = ?, media_download_status = ? WHERE id = ? AND workspace_id = ?')
        .run(filePath, 'done', input.messageId, ctx.workspaceId)

      return { status: 'downloaded', path: filePath, mime: mediaMsg.mimeType || 'application/octet-stream' }
    } catch (err: any) {
      ctx.database
        .prepare('UPDATE media SET download_status = ?, error = ? WHERE sha256 = ?')
        .run('error', String(err), sha256)
      throw new Boom('Download failed: ' + err.message, { statusCode: 500 })
    }
  },
}

export default downloadMediaAction
