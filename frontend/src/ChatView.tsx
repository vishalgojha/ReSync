import { useEffect, useRef } from 'react'

interface Chat {
  id: string
  name: string
}

interface Message {
  key: { id: string; fromMe?: boolean }
  message?: any
  pushName?: string
  messageTimestamp?: number
}

interface Props {
  chat: Chat
  messages: Message[]
  onBack: () => void
}

function getMessageText(msg: Message): string {
  const m = msg.message
  if (!m) return ''
  if (m.conversation) return m.conversation
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text
  if (m.imageMessage?.caption) return m.imageMessage.caption
  if (m.videoMessage?.caption) return m.videoMessage.caption
  if (m.documentMessage?.caption) return m.documentMessage.caption
  if (m.imageMessage) return 'Photo'
  if (m.videoMessage) return 'Video'
  if (m.audioMessage) return 'Audio'
  if (m.documentMessage) return 'Document'
  if (m.stickerMessage) return 'Sticker'
  if (m.locationMessage) return 'Location'
  if (m.contactMessage) return 'Contact'
  if (m.pollCreationMessage) return 'Poll'
  return 'Message'
}

function formatTime(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function ChatView({ chat, messages, onBack }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      <div className="flex items-center px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <button
          onClick={onBack}
          className="text-zinc-400 hover:text-white mr-3 transition-colors text-lg"
        >
          ←
        </button>
        <span className="text-white font-medium">{chat.name}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {messages.length === 0 ? (
          <div className="text-center text-zinc-500 mt-8">No messages</div>
        ) : (
          messages.map(msg => {
            const fromMe = msg.key?.fromMe
            return (
              <div
                key={msg.key.id}
                className={`flex ${fromMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 ${
                    fromMe
                      ? 'bg-green-800 text-white rounded-br-sm'
                      : 'bg-zinc-800 text-zinc-100 rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{getMessageText(msg)}</p>
                  <p className={`text-xs mt-1 ${fromMe ? 'text-green-300' : 'text-zinc-500'}`}>
                    {formatTime(msg.messageTimestamp)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
