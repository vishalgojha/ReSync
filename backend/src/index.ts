import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { Boom } from '@hapi/boom'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDb, getDb } from './core/db'
import { EventDispatcher } from './core/dispatcher'
import { CapabilityRegistry, PluginLoader } from './core/plugin'
import { startSession, stopSession, hasSession, getSession, setDispatcher } from './whatsapp/session'
import { ActionRegistry, ActionRunner } from './actions/index.js'
import type { ActionContext } from './actions/Action.js'
import sendMessage from './actions/sendMessage.js'
import replyMessage from './actions/replyMessage.js'
import reactMessage from './actions/reactMessage.js'
import forwardMessage from './actions/forwardMessage.js'
import markRead from './actions/markRead.js'
import archiveChat from './actions/archiveChat.js'
import downloadMediaAction from './actions/downloadMedia.js'
import deleteMessageAction from './actions/deleteMessage.js'
import aiPlugin from './plugins/ai/index'
import analyticsPlugin from './plugins/analytics/index'
import exampleLoggerPlugin from './plugins/examples/logger/index'
import { AutomationStorage } from './automation/AutomationStorage.js'
import { WorkflowRunner } from './automation/WorkflowRunner.js'
import { ExecutionLog } from './automation/ExecutionLog.js'
import { AutomationEngine } from './automation/AutomationEngine.js'
import { TriggerRegistry, registerBuiltinTriggers } from './automation/triggers/index.js'
import { ConditionRegistry, registerBuiltinConditions } from './automation/conditions/index.js'
import { createAutomationRouter } from './automation/api.js'
import { ConversationCapability } from './engine/ConversationCapability.js'
import { createConversationRouter } from './engine/api.js'
import { KnowledgeGraphCapability } from './engine/graph/KnowledgeGraphCapability.js'
import { createGraphRouter } from './engine/graph/api.js'
import { createAgentRouter } from './agents/api.js'
import { readFileSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const startTime = Date.now()

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*' },
  maxHttpBufferSize: 5e7,
})

app.use(express.json({ limit: '5mb' }))

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
})

app.use('/api', apiLimiter)
app.use('/connect', apiLimiter)
app.use('/messages', apiLimiter)
app.use('/search', apiLimiter)
app.use('/media', apiLimiter)

const db = initDb()
const dispatcher = new EventDispatcher()
const capabilities = new CapabilityRegistry()
const pluginRouter = express.Router()

app.use(pluginRouter)

setDispatcher(dispatcher)

const registry = new ActionRegistry()
const runner = new ActionRunner(registry, dispatcher, io)

registry.register(sendMessage)
registry.register(replyMessage)
registry.register(reactMessage)
registry.register(forwardMessage)
registry.register(markRead)
registry.register(archiveChat)
registry.register(downloadMediaAction)
registry.register(deleteMessageAction)

const autoStorage = new AutomationStorage(db)
const workflowRunner = new WorkflowRunner(runner, autoStorage)
const executionLog = new ExecutionLog(autoStorage)
const autoTriggers = new TriggerRegistry()
const autoConditions = new ConditionRegistry()
registerBuiltinTriggers(autoTriggers)
registerBuiltinConditions(autoConditions)

capabilities.register('automation.triggers', autoTriggers)
capabilities.register('automation.conditions', autoConditions)

const buildActionContext = (wid: string): ActionContext => {
  const session = getSession(wid)
  return {
    workspaceId: wid,
    dispatcher,
    database: db,
    logger: { info: console.log, warn: console.warn, error: console.error },
    storage: path.join(__dirname, 'storage'),
    capabilities,
    baileys: session?.sock ?? null,
    config: {},
  }
}

const engineDeps = {
  dispatcher,
  db,
  runner: workflowRunner,
  storage: autoStorage,
  executionLog,
  capabilities,
  actionRegistry: registry,
  buildActionContext,
  io,
}

const automationEngine = new AutomationEngine(engineDeps)
automationEngine.start()
app.use('/api/automations', createAutomationRouter(engineDeps))

const conversation = new ConversationCapability()
conversation.setDispatcher(dispatcher)
dispatcher.on('messages.upsert', (ctx, data) => conversation.processMessage(ctx, data))
capabilities.register('conversation', conversation)

const graph = new KnowledgeGraphCapability()
graph.setDispatcher(dispatcher)
dispatcher.on('messages.upsert', (ctx, data) => graph.processMessage(ctx, data))
capabilities.register('graph', graph)

const conversationRouter = express.Router()
app.use('/api', createConversationRouter(conversationRouter, conversation))
app.use('/api', createGraphRouter(express.Router(), graph))
app.use('/api', createAgentRouter(express.Router(), capabilities, runner, buildActionContext))

const loader = new PluginLoader(dispatcher, capabilities, pluginRouter, path.join(__dirname, 'storage/plugins'))

loader.register(aiPlugin)
loader.register(analyticsPlugin)
loader.register(exampleLoggerPlugin)
await loader.startAll()

const DEFAULT_WORKSPACE_ID = 'default'

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

app.post('/connect', (req, res) => {
  const wid = getWsId(req)
  if (hasSession(wid)) {
    res.json({ status: 'already_connected', state: getSession(wid)?.state })
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

app.get('/state', (req, res) => {
  const wid = getWsId(req)
  const session = getSession(wid)
  if (!session) {
    res.json({ state: 'disconnected' })
    return
  }
  res.json({
    state: session.state,
    qr: session.state === 'qr' ? session.qrCode : null,
    syncProgress: session.syncProgress,
    reconnectAttempts: session.reconnectAttempts,
  })
})

app.get('/chats', (req, res) => {
  const wid = getWsId(req)
  requireConnected(wid)
  const chats = db
    .prepare(`
      SELECT c.id, c.name, c.last_message_text, c.last_message_timestamp,
             c.last_message_from_me, c.last_message_type, c.unread_count,
             c.archived, c.pinned, c.muted,
             ct.name AS contact_name, ct.push_name
      FROM chats c
      LEFT JOIN contacts ct ON ct.jid = c.id AND ct.workspace_id = c.workspace_id
      WHERE c.workspace_id = ?
      ORDER BY c.pinned DESC, COALESCE(c.last_message_timestamp, 0) DESC
    `)
    .all(wid) as any[]
  res.json({
    chats: chats.map((c: any) => ({
      id: c.id,
      name: c.contact_name || c.push_name || c.name || c.id.split('@')[0],
      lastMessage: c.last_message_text || null,
      lastMessageTimestamp: c.last_message_timestamp || null,
      lastMessageFromMe: !!c.last_message_from_me,
      lastMessageType: c.last_message_type,
      unreadCount: c.unread_count || 0,
      archived: !!c.archived,
      pinned: !!c.pinned,
      muted: !!c.muted,
    })),
  })
})

app.get('/messages/:chatId', (req, res) => {
  const wid = getWsId(req)
  requireConnected(wid)
  const offset = parseInt(req.query.offset as string) || 0
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)

  const rows = db
    .prepare(`
      SELECT id, data_json, from_me, message_type, timestamp, text_content, sender,
             quoted_message_id, quoted_text, media_url, media_mime_type, media_size,
             media_sha256, media_storage_path, media_download_status, status
      FROM messages
      WHERE workspace_id = ? AND chat_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `)
    .all(wid, req.params.chatId, limit, offset) as any[]

  const total = (db.prepare('SELECT COUNT(*) as count FROM messages WHERE workspace_id = ? AND chat_id = ?')
    .get(wid, req.params.chatId) as any).count

  res.json({
    messages: rows.reverse().map((r: any) => ({
      id: r.id,
      data_json: r.data_json,
      fromMe: r.from_me,
      messageType: r.message_type,
      timestamp: r.timestamp,
      textContent: r.text_content,
      sender: r.sender,
      quotedMessageId: r.quoted_message_id,
      quotedText: r.quoted_text,
      mediaUrl: r.media_url,
      mediaMimeType: r.media_mime_type,
      mediaSize: r.media_size,
      mediaSha256: r.media_sha256,
      mediaStoragePath: r.media_storage_path,
      mediaDownloadStatus: r.media_download_status,
      status: r.status,
    })),
    total,
    offset,
    limit,
  })
})

app.post('/messages/:chatId/send', async (req, res) => {
  const wid = getWsId(req)
  requireConnected(wid)
  const result = await runner.execute('sendMessage', {
    chatId: req.params.chatId,
    text: req.body.text,
    quotedMessageId: req.body.quotedMessageId,
  }, buildActionContext(wid))
  res.json(result)
})

app.post('/messages/send', async (req, res) => {
  const wid = getWsId(req)
  requireConnected(wid)
  const result = await runner.execute('sendMessage', {
    chatId: req.body.chatId,
    text: req.body.text,
    quotedMessageId: req.body.quotedMessageId,
  }, buildActionContext(wid))
  res.json(result)
})

app.post('/messages/:chatId/read', async (req, res) => {
  const wid = getWsId(req)
  requireConnected(wid)
  const result = await runner.execute('markRead', {
    chatId: req.params.chatId,
  }, buildActionContext(wid))
  res.json(result)
})

app.post('/messages/:chatId/react', async (req, res) => {
  const wid = getWsId(req)
  requireConnected(wid)
  const result = await runner.execute('reactMessage', {
    chatId: req.params.chatId,
    messageId: req.body.messageId,
    emoji: req.body.emoji,
  }, buildActionContext(wid))
  res.json(result)
})

app.post('/messages/forward', async (req, res) => {
  const wid = getWsId(req)
  requireConnected(wid)
  const result = await runner.execute('forwardMessage', {
    messageId: req.body.messageId,
    targetChatId: req.body.targetChatId,
  }, buildActionContext(wid))
  res.json(result)
})

app.post('/messages/:chatId/archive', async (req, res) => {
  const wid = getWsId(req)
  requireConnected(wid)
  const result = await runner.execute('archiveChat', {
    chatId: req.params.chatId,
    archive: req.body.archive === true,
  }, buildActionContext(wid))
  res.json(result)
})

app.post('/messages/:chatId/delete', async (req, res) => {
  const wid = getWsId(req)
  requireConnected(wid)
  const result = await runner.execute('deleteMessage', {
    chatId: req.params.chatId,
    messageId: req.body.messageId,
    forEveryone: req.body.forEveryone === true,
  }, buildActionContext(wid))
  res.json(result)
})

app.get('/media/download/:messageId', async (req, res) => {
  const wid = getWsId(req)
  requireConnected(wid)
  const result = await runner.execute('downloadMedia', {
    messageId: req.params.messageId,
  }, buildActionContext(wid))
  if (!result || !result.path) {
    res.status(404).json({ error: 'Media not found or download failed' })
    return
  }
  const mime = result.mime || 'application/octet-stream'
  res.sendFile(result.path, { headers: { 'Content-Type': mime } })
})

app.get('/search', (req, res) => {
  const wid = getWsId(req)
  const query = (req.query.q as string) || ''
  if (!query.trim()) {
    res.json({ results: [] })
    return
  }

  const like = `%${query}%`
  let messages: any[] = []
  try {
    messages = db
      .prepare(`
        SELECT m.id, m.chat_id, m.text_content, m.timestamp, m.from_me, m.message_type,
               c.name AS chat_name
        FROM messages_fts f
        JOIN messages m ON m.rowid = f.rowid
        LEFT JOIN chats c ON c.id = m.chat_id AND c.workspace_id = m.workspace_id
        WHERE m.workspace_id = ? AND messages_fts MATCH ?
        ORDER BY rank
        LIMIT 50
      `)
      .all(wid, query) as any[]
  } catch {
    messages = db
      .prepare(`
        SELECT m.id, m.chat_id, m.text_content, m.timestamp, m.from_me, m.message_type,
               c.name AS chat_name
        FROM messages m
        LEFT JOIN chats c ON c.id = m.chat_id AND c.workspace_id = m.workspace_id
        WHERE m.workspace_id = ? AND (m.text_content LIKE ? OR m.chat_id LIKE ?)
        ORDER BY m.timestamp DESC
        LIMIT 50
      `)
      .all(wid, like, like) as any[]
  }

  const timeline = db
    .prepare(`
      SELECT id, chat_id, event_type, label, description, created_at
      FROM conversation_timeline
      WHERE workspace_id = ? AND (label LIKE ? OR description LIKE ? OR event_type LIKE ?)
      ORDER BY created_at DESC
      LIMIT 30
    `)
    .all(wid, like, like, like) as any[]

  const contacts = db
    .prepare(`
      SELECT jid, name, push_name, phone_number
      FROM contacts
      WHERE workspace_id = ? AND (name LIKE ? OR push_name LIKE ? OR phone_number LIKE ?)
      LIMIT 20
    `)
    .all(wid, like, like, like) as any[]

  res.json({
    results: {
      messages: messages.map((m: any) => ({
        id: m.id,
        chatId: m.chat_id,
        text: m.text_content,
        timestamp: m.timestamp,
        fromMe: m.from_me,
        type: m.message_type,
        chatName: m.chat_name || m.chat_id?.split('@')[0],
      })),
      contacts: contacts.map((c: any) => ({
        jid: c.jid,
        name: c.name || c.push_name || c.phone_number || c.jid.split('@')[0],
      })),
      timeline: timeline.map((t: any) => ({
        id: t.id,
        chatId: t.chat_id,
        eventType: t.event_type,
        label: t.label,
        description: t.description,
        timestamp: t.created_at,
      })),
    },
  })
})

app.get('/actions', (_req, res) => {
  res.json({ actions: registry.getAll() })
})

app.get('/capabilities', (_req, res) => {
  const list: string[] = []
  capabilities.has('ai') && list.push('ai')
  capabilities.has('conversation') && list.push('conversation')
  capabilities.has('graph') && list.push('graph')
  list.push('agents')
  res.json({ capabilities: list })
})

app.get('/health', (req, res) => {
  const wid = (req.query.workspaceId as string) || 'default'
  const session = hasSession(wid) ? getSession(wid) : null
  res.json({
    running: true,
    workspace: wid,
    connected: session?.state === 'connected',
    version: '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
  })
})

const frontendDist = path.join(__dirname, '../../frontend/dist')
let hasFrontend = false
try {
  readFileSync(path.join(frontendDist, 'index.html'))
  hasFrontend = true
} catch {}
if (hasFrontend) {
  app.use(express.static(frontendDist))
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
      return next()
    }
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
  console.log(`Serving frontend from ${frontendDist}`)
} else {
  console.log('No production frontend found — run "cd frontend && npm run build" to build it')
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err?.output?.statusCode || 500
  res.status(status).json({ error: err.message })
})

const PORT = process.env.PORT || 4000
httpServer.listen(PORT, () => {
  console.log(`Backend on http://localhost:${PORT}`)
})
