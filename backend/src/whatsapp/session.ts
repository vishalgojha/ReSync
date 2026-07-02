import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import type { Server } from 'socket.io'
import P from 'pino'
import { Boom } from '@hapi/boom'
import path from 'path'
import { EventDispatcher, type DispatchContext } from '../core/dispatcher.js'
import { registerChatHandlers } from './chats.js'
import { registerMessageHandlers } from './messages.js'
import { registerContactHandlers } from './contacts.js'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const AUTH_DIR = path.join(__dirname, '../../auth_')

export type ConnectionState =
  | 'connecting'
  | 'qr'
  | 'connected'
  | 'syncing'
  | 'disconnected'
  | 'logged_out'
  | 'error'

export interface ManagedSession {
  workspaceId: string
  sock: ReturnType<typeof makeWASocket>
  state: ConnectionState
  qrCode: string | null
  reconnectTimer: ReturnType<typeof setTimeout> | null
  reconnectAttempts: number
  syncProgress: { type: 'chats' | 'contacts'; current: number; total: number } | null
}

let globalDispatcher: EventDispatcher | null = null

export function setDispatcher(d: EventDispatcher) {
  globalDispatcher = d
  registerChatHandlers(d)
  registerMessageHandlers(d)
  registerContactHandlers(d)
}

export function getDispatcher(): EventDispatcher {
  if (!globalDispatcher) throw new Error('Dispatcher not initialized')
  return globalDispatcher
}

const sessions = new Map<string, ManagedSession>()

export function hasSession(workspaceId: string): boolean {
  return sessions.has(workspaceId)
}

export function getSession(workspaceId: string): ManagedSession | undefined {
  return sessions.get(workspaceId)
}

function emitConnectionState(session: ManagedSession, io: Server) {
  io.emit('connection.state', {
    workspaceId: session.workspaceId,
    state: session.state,
    qr: session.qrCode,
    syncProgress: session.syncProgress,
  })
}

const MAX_RECONNECT_ATTEMPTS = 10
const BASE_RECONNECT_DELAY = 2000

function reconnectDelay(attempts: number): number {
  return Math.min(BASE_RECONNECT_DELAY * Math.pow(1.5, attempts), 30_000)
}

export async function startSession(workspaceId: string, io: Server): Promise<ManagedSession> {
  const existing = sessions.get(workspaceId)
  if (existing) {
    if (existing.reconnectTimer) clearTimeout(existing.reconnectTimer)
    existing.sock.end(undefined)
    sessions.delete(workspaceId)
  }

  const dispatcher = getDispatcher()
  const ctx = (): DispatchContext => ({ workspaceId, io })

  const session: ManagedSession = {
    workspaceId,
    sock: null as any,
    state: 'connecting',
    qrCode: null,
    reconnectTimer: null,
    reconnectAttempts: 0,
    syncProgress: null,
  }
  sessions.set(workspaceId, session)
  emitConnectionState(session, io)

  const authDir = `${AUTH_DIR}${workspaceId}`
  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
    qrTimeout: 60_000,
    markOnlineOnConnect: true,
  })

  session.sock = sock

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      session.qrCode = qr
      session.state = 'qr'
      emitConnectionState(session, io)
    }

    if (connection === 'connecting') {
      session.state = 'connecting'
      session.qrCode = null
      emitConnectionState(session, io)
    }

    if (connection === 'open') {
      session.state = 'connected'
      session.qrCode = null
      session.reconnectAttempts = 0
      emitConnectionState(session, io)
    }

    if (connection === 'close') {
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode
      const isLoggedOut = code === DisconnectReason.loggedOut
      const isRestartRequired = code === DisconnectReason.restartRequired

      if (isLoggedOut) {
        session.state = 'logged_out'
        session.qrCode = null
        emitConnectionState(session, io)
        sessions.delete(workspaceId)
        return
      }

      if (isRestartRequired || session.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        session.state = 'connecting'
        session.reconnectAttempts++
        const delay = reconnectDelay(session.reconnectAttempts)
        emitConnectionState(session, io)
        session.reconnectTimer = setTimeout(() => {
          startSession(workspaceId, io)
        }, delay)
      } else {
        session.state = 'error'
        emitConnectionState(session, io)
      }
    }
  })

  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('chats.set' as any, (data) => {
    const chats: any[] = data?.chats || []
    session.syncProgress = { type: 'chats', current: 0, total: chats.length }
    session.state = 'syncing'
    emitConnectionState(session, io)
    dispatcher.dispatch('chats.set', ctx(), data)
    session.syncProgress = null
    session.state = 'connected'
    emitConnectionState(session, io)
  })
  sock.ev.on('chats.upsert' as any, (data) => dispatcher.dispatch('chats.upsert', ctx(), data))
  sock.ev.on('chats.update' as any, (data) => dispatcher.dispatch('chats.update', ctx(), data))
  sock.ev.on('messages.upsert' as any, (data) => {
    const msgs: any[] = data?.messages || []
    const type = data?.type
    dispatcher.dispatch('messages.upsert', ctx(), { messages: msgs, type })
  })
  sock.ev.on('messages.update' as any, (data) => dispatcher.dispatch('messages.update', ctx(), data))
  sock.ev.on('messages.delete' as any, (data) => dispatcher.dispatch('messages.delete', ctx(), data))
  sock.ev.on('contacts.upsert' as any, (data) => dispatcher.dispatch('contacts.upsert', ctx(), data))
  sock.ev.on('contacts.update' as any, (data) => dispatcher.dispatch('contacts.update', ctx(), data))

  return session
}

export function stopSession(workspaceId: string, io: Server) {
  const session = sessions.get(workspaceId)
  if (!session) return
  if (session.reconnectTimer) clearTimeout(session.reconnectTimer)
  session.sock.end(undefined)
  sessions.delete(workspaceId)
  io.emit('connection.state', { workspaceId, state: 'disconnected' })
}

export function getConnectionState(workspaceId: string): ConnectionState | null {
  return sessions.get(workspaceId)?.state ?? null
}
