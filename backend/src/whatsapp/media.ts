import path from 'path'
import fs from 'fs'
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { getDb } from '../core/db.js'
import type { DispatchContext } from '../core/dispatcher.js'
import { getSession } from './session.js'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const MEDIA_DIR = path.join(__dirname, '../../media')

export async function downloadMedia(
  ctx: DispatchContext,
  messageId: string,
): Promise<{ path: string; mime: string } | null> {
  const db = getDb()
  const row = db.prepare('SELECT data_json, chat_id FROM messages WHERE id = ? AND workspace_id = ?').get(messageId, ctx.workspaceId) as any
  if (!row) return null

  const msg = JSON.parse(row.data_json)
  const content = msg.message || {}
  const types = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage']
  let mediaMsg: any = null
  for (const t of types) {
    if (content[t]) { mediaMsg = content[t]; break }
  }
  if (!mediaMsg) return null

  const sha256 = mediaMsg.fileSha256 ? Buffer.from(mediaMsg.fileSha256).toString('base64') : null
  if (!sha256) return null

  const existing = db.prepare('SELECT storage_path FROM media WHERE sha256 = ?').get(sha256) as any
  if (existing?.storage_path && fs.existsSync(existing.storage_path)) {
    return { path: existing.storage_path, mime: mediaMsg.mimeType || 'application/octet-stream' }
  }

  fs.mkdirSync(MEDIA_DIR, { recursive: true })

  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {})
    const ext = mediaMsg.mimeType?.split('/')[1] || 'bin'
    const fileName = `${sha256}.${ext}`
    const filePath = path.join(MEDIA_DIR, fileName)
    fs.writeFileSync(filePath, buffer)

    db.prepare(`
      INSERT INTO media (sha256, workspace_id, mime_type, file_size, storage_path, download_status, downloaded_at)
      VALUES (?, ?, ?, ?, ?, 'done', unixepoch())
      ON CONFLICT(sha256) DO UPDATE SET download_status = 'done', storage_path = ?, downloaded_at = unixepoch()
    `).run(sha256, ctx.workspaceId, mediaMsg.mimeType || null, mediaMsg.fileLength ? Number(mediaMsg.fileLength) : null, filePath, filePath)

    db.prepare('UPDATE messages SET media_storage_path = ?, media_download_status = ? WHERE id = ? AND workspace_id = ?')
      .run(filePath, 'done', messageId, ctx.workspaceId)

    return { path: filePath, mime: mediaMsg.mimeType || 'application/octet-stream' }
  } catch (err) {
    db.prepare('UPDATE media SET download_status = ?, error = ? WHERE sha256 = ?')
      .run('error', String(err), sha256)
    return null
  }
}

export function getMediaPath(sha256: string): string | null {
  const db = getDb()
  const row = db.prepare('SELECT storage_path FROM media WHERE sha256 = ? AND download_status = ?').get(sha256, 'done') as any
  if (row?.storage_path && fs.existsSync(row.storage_path)) return row.storage_path
  return null
}
