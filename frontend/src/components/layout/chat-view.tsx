import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import { MessageSquare, Search, Info } from 'lucide-react'
import { API_BASE, SIO_URL } from '../../config'
import { useApp } from '../../lib/app-context'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Avatar } from '../ui/avatar'
import type { MessageRow } from '../../lib/types'
import { formatTime, formatDate, isSameDay, statusIcon, msgTypeLabel } from './message-utils'

export interface ChatViewProps {
  chatId: string
}

function statusColor(status: string | null): string {
  if (status === 'read' || status === 'played') return 'text-info'
  if (status === 'delivered') return 'text-success'
  return 'text-muted-foreground'
}

export default function ChatView({ chatId }: ChatViewProps) {
  const { connectionState } = useApp()
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [input, setInput] = useState('')
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null)
  const [chatName, setChatName] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const autoScroll = useRef(true)
  const chatIdRef = useRef(chatId)
  chatIdRef.current = chatId

  const fetchMessages = useCallback(async (offset: number) => {
    const res = await fetch(`${API_BASE}/messages/${chatId}?offset=${offset}&limit=50`)
    const data = await res.json()
    return data
  }, [chatId])

  useEffect(() => {
    setLoading(true)
    setMessages([])
    setHasMore(true)
    setReplyTo(null)
    setInput('')
    autoScroll.current = true

    fetchMessages(0).then((data) => {
      setMessages(data.messages || [])
      setChatName(data.chatName || chatId)
      setLoading(false)
    })
  }, [chatId, fetchMessages])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return 0
    setLoadingMore(true)
    const el = listRef.current
    const prevHeight = el?.scrollHeight ?? 0
    const data = await fetchMessages(messages.length)
    const newMsgs: MessageRow[] = data.messages || []
    if (newMsgs.length === 0) {
      setHasMore(false)
    } else {
      setMessages((prev) => [...newMsgs, ...prev])
    }
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight
    })
    setLoadingMore(false)
    return newMsgs.length
  }, [loadingMore, hasMore, fetchMessages, messages.length])

  useEffect(() => {
    const socket = io(SIO_URL)

    const onMessageCreated = (data: { messages?: MessageRow[] }) => {
      const msgs = data.messages || []
      const filtered = msgs.filter((m) => m.chatId === chatIdRef.current)
      if (filtered.length > 0) {
        setMessages((prev) => [...prev, ...filtered])
        autoScroll.current = true
      }
    }

    const onMessageUpdated = (data: { updates?: Array<{ key?: { id?: string }; update?: { status?: string } }> }) => {
      const updates = data.updates || []
      setMessages((prev) => {
        const map = new Map(prev.map((m) => [m.id, m]))
        for (const u of updates) {
          const id = u.key?.id
          if (id && map.has(id)) {
            const existing = map.get(id)!
            map.set(id, { ...existing, status: u.update?.status ?? existing.status })
          }
        }
        return Array.from(map.values())
      })
    }

    socket.on('message.created', onMessageCreated)
    socket.on('message.updated', onMessageUpdated)

    return () => {
      socket.off('message.created', onMessageCreated)
      socket.off('message.updated', onMessageUpdated)
      socket.disconnect()
    }
  }, [])

  useEffect(() => {
    if (autoScroll.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  const handleScroll = () => {
    const el = listRef.current
    if (!el) return
    autoScroll.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 100
    if (el.scrollTop < 100 && hasMore && !loadingMore) {
      loadMore()
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    const quotedId = replyTo?.id
    setReplyTo(null)
    await fetch(`${API_BASE}/messages/${chatId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, quotedMessageId: quotedId }),
    })
    autoScroll.current = true
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasStatus = messages.some((m) => !!m.status)

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Avatar name={chatName} className="size-8" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{chatName}</span>
            {connectionState !== 'connected' && (
              <span className="text-xs text-warning">
                {connectionState === 'connecting'
                  ? 'connecting...'
                  : connectionState === 'syncing'
                    ? 'syncing...'
                    : connectionState}
              </span>
            )}
          </div>
        </div>
        <button
          className="rounded-[var(--radius-md)] p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Search in conversation"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          className="rounded-[var(--radius-md)] p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Toggle inspector"
        >
          <Info className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3"
      >
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
          </div>
        )}

        {!loading && loadingMore && (
          <div className="py-2 text-center text-xs text-muted-foreground">Loading older messages...</div>
        )}

        {!loading && !hasMore && messages.length > 0 && (
          <div className="py-2 text-center text-xs text-muted-foreground">Beginning of conversation</div>
        )}

        {!loading && messages.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No messages yet</div>
        )}

        {!loading &&
          messages.map((msg, idx) => {
            const showDateSep =
              idx === 0 ||
              (msg.timestamp &&
                messages[idx - 1]?.timestamp &&
                !isSameDay(msg.timestamp, messages[idx - 1].timestamp!))

            const fromMe = msg.fromMe === 1
            const isDeleted = msg.messageType === 'deleted'
            const mediaUrl = msg.mediaStoragePath
              ? `${API_BASE}/media/download/${msg.id}`
              : null
            const isImage = msg.messageType === 'imageMessage'
            const isVideo =
              msg.messageType === 'videoMessage' ||
              msg.messageType === 'ptvMessage'
            const isAudio = msg.messageType === 'audioMessage'
            const isSticker = msg.messageType === 'stickerMessage'
            const isDocument = msg.messageType === 'documentMessage'

            return (
              <div key={msg.id}>
                {showDateSep && msg.timestamp && (
                  <div className="flex justify-center py-3">
                    <span className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground">
                      {formatDate(msg.timestamp)}
                    </span>
                  </div>
                )}

                <div
                  className={cn('mb-1 flex', fromMe ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className="max-w-[75%] min-w-[60px] cursor-pointer"
                    onClick={() => setReplyTo(msg)}
                  >
                    {msg.quotedText && (
                      <div
                        className={cn(
                          'mb-0.5 cursor-pointer rounded-t-lg border-l-2 p-1.5 text-xs',
                          fromMe
                            ? 'border-accent bg-accent/10'
                            : 'border-border bg-secondary',
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          const el = document.getElementById(`msg-${msg.quotedMessageId}`)
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }}
                      >
                        <span className="text-[10px] text-muted-foreground">Reply to</span>
                        <p className="truncate text-muted-foreground">{msg.quotedText}</p>
                      </div>
                    )}

                    <div
                      id={`msg-${msg.id}`}
                      className={cn(
                        'rounded-lg px-3 py-2',
                        fromMe
                          ? 'bg-accent/10 text-foreground rounded-br-sm'
                          : 'bg-secondary text-foreground rounded-bl-sm',
                        isDeleted && 'italic opacity-60',
                      )}
                    >
                      {isDeleted ? (
                        <p className="text-sm italic text-muted-foreground">This message was deleted</p>
                      ) : msg.messageType === 'locationMessage' ||
                        msg.messageType === 'liveLocationMessage' ? (
                        <p className="text-sm text-foreground">
                          {msg.textContent || (msg.messageType === 'liveLocationMessage' ? 'Live Location' : 'Location')}
                        </p>
                      ) : msg.messageType === 'contactMessage' ? (
                        <p className="text-sm text-foreground">
                          Contact Card{msg.textContent ? ` - ${msg.textContent}` : ''}
                        </p>
                      ) : msg.messageType === 'pollCreationMessage' ? (
                        <p className="text-sm text-foreground">
                          Poll: {msg.textContent || 'Poll'}
                        </p>
                      ) : msg.messageType === 'reactionMessage' ? (
                        <p className="text-sm text-foreground">{msg.textContent || 'Reacted'}</p>
                      ) : isImage && mediaUrl ? (
                        <div className="-mx-3 -mt-2 mb-1 overflow-hidden rounded-t-lg">
                          <img
                            src={mediaUrl}
                            alt="Image"
                            className="h-auto max-w-full cursor-pointer"
                            loading="lazy"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(mediaUrl, '_blank')
                            }}
                          />
                        </div>
                      ) : isVideo && mediaUrl ? (
                        <div className="-mx-3 -mt-2 mb-1 overflow-hidden rounded-t-lg">
                          <video
                            src={mediaUrl}
                            controls
                            className="h-auto max-w-full"
                            preload="metadata"
                          />
                        </div>
                      ) : isAudio && mediaUrl ? (
                        <div className="py-1">
                          <audio
                            src={mediaUrl}
                            controls
                            className="h-8 w-full"
                            preload="none"
                          />
                          {msg.textContent && (
                            <p className="mt-1 text-sm text-foreground">{msg.textContent}</p>
                          )}
                        </div>
                      ) : isSticker && mediaUrl ? (
                        <div className="-mx-3 -mt-2 mb-1">
                          <img
                            src={mediaUrl}
                            alt="Sticker"
                            className="h-auto max-w-[160px]"
                            loading="lazy"
                          />
                        </div>
                      ) : isDocument && mediaUrl ? (
                        <div className="flex items-center gap-2 py-1">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-foreground">
                              {msg.textContent || 'Document'}
                            </p>
                            {msg.mediaMimeType && (
                              <p className="truncate text-[10px] text-muted-foreground">
                                {msg.mediaMimeType}
                              </p>
                            )}
                          </div>
                          <a
                            href={mediaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 text-xs text-accent"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Download
                          </a>
                        </div>
                      ) : isImage || isVideo || isAudio || isSticker || isDocument ? (
                        <p className="text-sm text-foreground">
                          {msgTypeLabel(msg.messageType)}
                          {msg.textContent ? `: ${msg.textContent}` : ''}
                        </p>
                      ) : (
                        <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                          {msg.textContent}
                        </p>
                      )}

                      <div
                        className={cn(
                          'mt-1 flex items-center justify-end gap-1',
                          fromMe ? 'text-muted-foreground' : 'text-muted-foreground',
                        )}
                      >
                        <span className="text-[10px] leading-none">{formatTime(msg.timestamp)}</span>
                        {fromMe && hasStatus && msg.status && (
                          <span className={cn('text-[10px] leading-none', statusColor(msg.status))}>
                            {statusIcon(msg.status)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="flex shrink-0 items-center gap-2 border-t border-border bg-card px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-accent">
              Replying to {replyTo.fromMe ? 'yourself' : chatName}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {replyTo.textContent || msgTypeLabel(replyTo.messageType)}
            </p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2 border-t border-border bg-card px-4 py-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1"
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim()}
          variant="default"
          size="icon"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
