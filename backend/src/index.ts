import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { Boom } from '@hapi/boom'
import { initDb, getDb } from './whatsapp/db'
import { startSession, stopSession, hasSession } from './whatsapp/session'
import { ProviderFactory } from './ai/factory'
import type { AIProviderConfig, ProviderKind } from './ai/provider'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*' } })

app.use(express.json())

const db = initDb()

const DEFAULT_WORKSPACE_ID = 'default'

const getSettingStmt = db.prepare(
  'SELECT value FROM workspace_settings WHERE workspace_id = ? AND key = ?'
)
const setSettingStmt = db.prepare(
  'INSERT OR REPLACE INTO workspace_settings (workspace_id, key, value) VALUES (?, ?, ?)'
)

function getSetting(workspaceId: string, key: string): string | undefined {
  const row = getSettingStmt.get(workspaceId, key) as any
  return row?.value
}

function setSetting(workspaceId: string, key: string, value: string) {
  setSettingStmt.run(workspaceId, key, value)
}

function getAIConfig(workspaceId: string): AIProviderConfig | null {
  const kind = getSetting(workspaceId, 'ai_kind') as ProviderKind | undefined
  if (!kind) return null
  return {
    kind,
    apiKey: getSetting(workspaceId, 'ai_apiKey') ?? '',
    model: getSetting(workspaceId, 'ai_model') ?? '',
    baseUrl: getSetting(workspaceId, 'ai_baseUrl'),
  }
}

function getWsId(req: express.Request): string {
  return (req.query.workspaceId as string) || DEFAULT_WORKSPACE_ID
}

function requireConnected(workspaceId: string) {
  if (!hasSession(workspaceId)) {
    throw new Boom('Not connected', { statusCode: 400 })
  }
}

app.get('/workspaces', (_req, res) => {
  const rows = db.prepare('SELECT id, name, created_at FROM workspaces ORDER BY created_at').all()
  res.json({ workspaces: rows })
})

app.get('/chats', (req, res) => {
  const wid = getWsId(req)
  requireConnected(wid)
  const chats = db
    .prepare(`
      SELECT c.id, c.name, c.last_message_text, c.last_message_timestamp, c.unread_count,
             ct.name AS contact_name, ct.push_name
      FROM chats c
      LEFT JOIN contacts ct ON ct.jid = c.id AND ct.workspace_id = c.workspace_id
      WHERE c.workspace_id = ?
      ORDER BY COALESCE(c.last_message_timestamp, 0) DESC
    `)
    .all(wid) as any[]
  res.json({
    chats: chats.map((c: any) => ({
      id: c.id,
      name: c.contact_name || c.push_name || c.name || c.id.split('@')[0],
      lastMessage: c.last_message_text || null,
      lastMessageTimestamp: c.last_message_timestamp || null,
      unreadCount: c.unread_count || 0,
    })),
  })
})

app.get('/messages/:chatId', (req, res) => {
  const wid = getWsId(req)
  requireConnected(wid)
  const rows = db
    .prepare(`
      SELECT data_json, from_me, message_type, timestamp, text_content, sender
      FROM messages
      WHERE workspace_id = ? AND chat_id = ?
      ORDER BY timestamp ASC
      LIMIT 200
    `)
    .all(wid, req.params.chatId) as any[]
  const messages = rows.map((r: any) => JSON.parse(r.data_json))
  res.json({ messages })
})

app.post('/connect', (req, res) => {
  const wid = getWsId(req)
  if (hasSession(wid)) {
    res.json({ status: 'already_connected' })
    return
  }
  startSession(wid, io).catch(err => console.error('Failed to start session', err))
  res.json({ status: 'connecting' })
})

app.post('/disconnect', (req, res) => {
  const wid = getWsId(req)
  stopSession(wid, io)
  res.json({ status: 'disconnected' })
})

app.get('/settings', (req, res) => {
  const wid = getWsId(req)
  const kind = getSetting(wid, 'ai_kind')
  const model = getSetting(wid, 'ai_model')
  const baseUrl = getSetting(wid, 'ai_baseUrl')
  const hasKey = !!getSetting(wid, 'ai_apiKey')
  res.json({ kind, model, baseUrl, hasKey })
})

app.put('/settings', (req, res) => {
  const wid = getWsId(req)
  const { kind, apiKey, model, baseUrl } = req.body
  if (kind) setSetting(wid, 'ai_kind', kind)
  if (apiKey) setSetting(wid, 'ai_apiKey', apiKey)
  if (model) setSetting(wid, 'ai_model', model)
  if (baseUrl !== undefined) setSetting(wid, 'ai_baseUrl', baseUrl ?? '')
  res.json({ status: 'saved' })
})

app.post('/settings/test', async (req, res) => {
  const wid = getWsId(req)
  const config = getAIConfig(wid)
  if (!config) {
    throw new Boom('AI not configured', { statusCode: 400 })
  }
  try {
    const provider = ProviderFactory.create({
      ...config,
      apiKey: req.body.apiKey ?? config.apiKey,
      model: req.body.model ?? config.model,
      baseUrl: req.body.baseUrl ?? config.baseUrl,
    })
    const reply = await provider.chat([{ role: 'user', content: 'Reply with just: ok' }])
    res.json({ status: 'ok', reply })
  } catch (err: any) {
    res.json({ status: 'error', error: err.message })
  }
})

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err?.output?.statusCode || 500
  res.status(status).json({ error: err.message })
})

const PORT = process.env.PORT || 4000
httpServer.listen(PORT, () => {
  console.log(`Backend on http://localhost:${PORT}`)
})
