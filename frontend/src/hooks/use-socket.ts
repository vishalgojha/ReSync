import { useEffect, useRef, useState, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import { SIO_URL } from '../config'
import type { ConnectionState, SyncProgress, Chat, MessageRow } from '../lib/types'

let globalSocket: Socket | null = null

function getSocket(): Socket {
  if (!globalSocket) {
    globalSocket = io(SIO_URL)
  }
  return globalSocket
}

export function useSocket() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [chats, setChats] = useState<Chat[]>([])
  const activeChatRef = useRef<string | null>(null)

  useEffect(() => {
    const socket = getSocket()

    const onState = (data: any) => {
      setConnectionState(data.state)
      if (data.qr) setQrCode(data.qr)
      if (data.syncProgress) setSyncProgress(data.syncProgress)
      else setSyncProgress(null)
      if (data.state === 'connected' || data.state === 'syncing') setQrCode(null)
      if (data.state === 'logged_out' || data.state === 'disconnected') {
        setQrCode(null)
        setChats([])
      }
    }

    const onChatsSet = (data: any) => setChats(data.chats)

    const onChatCreated = (data: any) => {
      setChats(prev => {
        const map = new Map(prev.map(c => [c.id, c]))
        for (const c of data.chats) {
          map.set(c.id, { ...map.get(c.id), ...c, lastMessage: c.lastMessage || map.get(c.id)?.lastMessage })
        }
        return Array.from(map.values()).sort((a, b) => (b.lastMessageTimestamp ?? 0) - (a.lastMessageTimestamp ?? 0))
      })
    }

    const onChatUpdated = (data: any) => {
      setChats(prev => {
        const map = new Map(prev.map(c => [c.id, c]))
        for (const u of data.chats) {
          const existing = map.get(u.id)
          if (existing) map.set(u.id, { ...existing, ...u })
        }
        return Array.from(map.values())
      })
    }

    const onMessageCreated = (data: any) => {
      const msgs: MessageRow[] = data.messages || []
      setChats(prev => {
        const map = new Map(prev.map(c => [c.id, c]))
        for (const m of msgs) {
          const chat = map.get(m.chatId)
          if (chat) {
            map.set(m.chatId, {
              ...chat,
              lastMessage: m.textContent || messageTypeLabel(m.messageType),
              lastMessageTimestamp: m.timestamp,
              lastMessageFromMe: !!m.fromMe,
              lastMessageType: m.messageType,
              unreadCount: (chat.unreadCount ?? 0) + (m.fromMe ? 0 : 1),
            })
          }
        }
        return Array.from(map.values()).sort((a, b) => (b.lastMessageTimestamp ?? 0) - (a.lastMessageTimestamp ?? 0))
      })
    }

    const onSyncCompleted = () => setSyncProgress(null)

    socket.on('connection.state', onState)
    socket.on('chats.set', onChatsSet)
    socket.on('chat.created', onChatCreated)
    socket.on('chat.updated', onChatUpdated)
    socket.on('message.created', onMessageCreated)
    socket.on('sync.completed', onSyncCompleted)

    return () => {
      socket.off('connection.state', onState)
      socket.off('chats.set', onChatsSet)
      socket.off('chat.created', onChatCreated)
      socket.off('chat.updated', onChatUpdated)
      socket.off('message.created', onMessageCreated)
      socket.off('sync.completed', onSyncCompleted)
    }
  }, [])

  const connect = useCallback(async () => {
    setConnectionState('connecting')
    await fetch(`${import.meta.env.VITE_API_URL ?? ''}/connect`, { method: 'POST' })
    setQrCode(null)
  }, [])

  const disconnect = useCallback(async () => {
    await fetch(`${import.meta.env.VITE_API_URL ?? ''}/disconnect`, { method: 'POST' })
    setConnectionState('disconnected')
    setChats([])
    setQrCode(null)
  }, [])

  return {
    connectionState,
    qrCode,
    syncProgress,
    chats,
    setChats,
    activeChatRef,
    connect,
    disconnect,
  }
}

function messageTypeLabel(type: string | null): string {
  switch (type) {
    case 'imageMessage': return 'Photo'
    case 'videoMessage': return 'Video'
    case 'audioMessage': return 'Audio'
    case 'ptvMessage': return 'Video'
    case 'documentMessage': return 'Document'
    case 'stickerMessage': return 'Sticker'
    case 'locationMessage': return 'Location'
    case 'liveLocationMessage': return 'Live Location'
    case 'contactMessage': return 'Contact'
    case 'pollCreationMessage': return 'Poll'
    case 'reactionMessage': return 'Reaction'
    default: return 'Message'
  }
}
