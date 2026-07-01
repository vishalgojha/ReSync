import { useEffect, useState, useCallback, useRef } from 'react'
import io from 'socket.io-client'
import ConnectScreen from './ConnectScreen'
import ChatList from './ChatList'
import ChatView from './ChatView'
import Settings from './Settings'

type View = 'connect' | 'chats' | 'chat' | 'settings'
type ConnectionState = 'connecting' | 'qr' | 'connected' | 'reconnecting' | 'disconnected' | 'logged-out'

interface Chat {
  id: string
  name: string
  lastMessage?: string | null
  lastMessageTimestamp?: number | null
  unreadCount?: number
}

interface Message {
  key: { id: string; remoteJid?: string; fromMe?: boolean; participant?: string }
  message?: any
  pushName?: string
  messageTimestamp?: number
}

export default function App() {
  const [view, setView] = useState<View>('connect')
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChat, setActiveChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  const activeChatRef = useRef(activeChat)
  activeChatRef.current = activeChat

  useEffect(() => {
    const s = io('http://localhost:4000')

    s.on('qr.updated', ({ qr }: { qr: string }) => {
      setQrCode(qr)
      setConnectionState('qr')
    })

    s.on('connection.state', ({ state }: { state: string }) => {
      if (state === 'connected') {
        setConnectionState('connected')
        setView('chats')
      } else if (state === 'reconnecting') {
        setConnectionState('reconnecting')
      } else if (state === 'logged-out') {
        setConnectionState('disconnected')
        setView('connect')
        setQrCode(null)
        setChats([])
      } else if (state === 'disconnected') {
        setConnectionState('disconnected')
      }
    })

    s.on('chats.set', ({ chats }: { chats: Chat[] }) => {
      setChats(chats)
    })

    s.on('chats.update', ({ chats }: { chats: Chat[] }) => {
      setChats(prev => {
        const map = new Map(prev.map(c => [c.id, c]))
        for (const update of chats) {
          map.set(update.id, { ...map.get(update.id), ...update })
        }
        return Array.from(map.values())
      })
    })

    s.on('message.new', ({ messages }: { messages: Message[] }) => {
      if (activeChatRef.current) {
        const filtered = messages.filter(m => m.key?.remoteJid === activeChatRef.current!.id)
        if (filtered.length) {
          setMessages(prev => [...prev, ...filtered])
        }
      }
    })

    return () => { s.close() }
  }, [])

  useEffect(() => {
    if (!activeChat) return
    fetch(`http://localhost:4000/messages/${activeChat.id}`)
      .then(r => r.json())
      .then(data => setMessages(data.messages || []))
  }, [activeChat])

  const handleConnect = useCallback(async () => {
    setConnectionState('connecting')
    await fetch('http://localhost:4000/connect', { method: 'POST' })
  }, [])

  const handleDisconnect = useCallback(async () => {
    await fetch('http://localhost:4000/disconnect', { method: 'POST' })
    setView('connect')
    setConnectionState('disconnected')
    setActiveChat(null)
    setChats([])
    setMessages([])
    setQrCode(null)
  }, [])

  const handleSelectChat = (chat: Chat) => {
    setActiveChat(chat)
    setView('chat')
  }

  const handleOpenSettings = useCallback(() => {
    setView('settings')
  }, [])

  if (view === 'settings') {
    return <Settings onClose={() => setView('connect')} />
  }

  if (view === 'connect') {
    return (
      <ConnectScreen
        connectionState={connectionState}
        qrCode={qrCode}
        onConnect={handleConnect}
        onSettings={handleOpenSettings}
      />
    )
  }

  if (view === 'chat' && activeChat) {
    return (
      <ChatView
        chat={activeChat}
        messages={messages}
        onBack={() => {
          setActiveChat(null)
          setView('chats')
        }}
      />
    )
  }

  return (
    <ChatList
      chats={chats}
      onSelectChat={handleSelectChat}
      onDisconnect={handleDisconnect}
      onSettings={handleOpenSettings}
    />
  )
}
