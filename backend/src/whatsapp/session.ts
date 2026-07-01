import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys'
import type { Server } from 'socket.io'
import P from 'pino'
import { Boom } from '@hapi/boom'
import path from 'path'
import { handleChatsSet, handleChatsUpsert } from './chats.js'
import { handleMessagesUpsert } from './messages.js'
import { handleContactsUpsert, handleContactsUpdate } from './contacts.js'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const AUTH_DIR = path.join(__dirname, '../../auth_')

export interface SessionState {
  workspaceId: string
  state: 'connecting' | 'qr' | 'connected' | 'reconnecting' | 'disconnected' | 'logged-out'
}

export type SessionEventCallback = (event: {
  type: 'connection.state' | 'qr.updated'
  payload: any
}) => void

export interface ManagedSession {
  workspaceId: string
  sock: Awaited<ReturnType<typeof makeWASocket>>
  reconnectTimer: ReturnType<typeof setTimeout> | null
  io: Server
}

const sessions = new Map<string, ManagedSession>()

export function getSession(workspaceId: string): ManagedSession | undefined {
  return sessions.get(workspaceId)
}

export function hasSession(workspaceId: string): boolean {
  return sessions.has(workspaceId)
}

export async function startSession(workspaceId: string, io: Server): Promise<ManagedSession> {
  const existing = sessions.get(workspaceId)
  if (existing) {
    if (existing.reconnectTimer) clearTimeout(existing.reconnectTimer)
    existing.sock.end(undefined)
    sessions.delete(workspaceId)
  }

  const authDir = `${AUTH_DIR}${workspaceId}`
  const { state, saveCreds } = await useMultiFileAuthState(authDir)

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
  })

  const session: ManagedSession = { workspaceId, sock, reconnectTimer: null, io }
  sessions.set(workspaceId, session)

  const emit = (type: string, payload: any) => {
    io.emit(type, { workspaceId, ...payload })
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      emit('qr.updated', { qr })
    }

    if (connection === 'open') {
      emit('connection.state', { state: 'connected' })
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      const isLoggedOut = statusCode === DisconnectReason.loggedOut

      if (isLoggedOut) {
        sessions.delete(workspaceId)
        emit('connection.state', { state: 'logged-out' })
      } else {
        emit('connection.state', { state: 'reconnecting' })
        session.reconnectTimer = setTimeout(() => {
          startSession(workspaceId, io)
        }, 5000)
      }
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('chats.set' as any, (data: any) => {
    handleChatsSet(workspaceId, data, io)
  })

  sock.ev.on('chats.upsert' as any, (chats: any[]) => {
    handleChatsUpsert(workspaceId, chats, io)
  })

  sock.ev.on('messages.upsert' as any, (data: any) => {
    handleMessagesUpsert(workspaceId, data, io)
  })

  sock.ev.on('contacts.upsert' as any, (contacts: any[]) => {
    handleContactsUpsert(workspaceId, contacts, io)
  })

  sock.ev.on('contacts.update' as any, (contacts: any[]) => {
    handleContactsUpdate(workspaceId, contacts, io)
  })

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
