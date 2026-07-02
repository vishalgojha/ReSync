import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, Star, Archive, MessageSquare } from 'lucide-react'
import { useApp } from '../../lib/app-context'
import { cn } from '../../lib/utils'
import { Input } from '../ui/input'
import { Avatar } from '../ui/avatar'
import { EmptyState } from '../ui/empty-state'
import { formatTime, msgTypeLabel } from './message-utils'

export interface ChatListProps {
  onSelectChat: (id: string) => void
}

function messagePreview(lastMessage: string | null | undefined, lastMessageType: string | null | undefined, lastMessageFromMe: boolean | undefined): string {
  if (lastMessage) return lastMessage
  const label = lastMessageType ? msgTypeLabel(lastMessageType) : null
  if (label && lastMessageFromMe) return label
  if (label) return label
  return 'No messages'
}

export default function ChatList({ onSelectChat }: ChatListProps) {
  const { chats, connectionState, connect, syncProgress } = useApp()
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onFocus = () => searchRef.current?.focus()
    document.addEventListener('focus-chat-search', onFocus)
    return () => document.removeEventListener('focus-chat-search', onFocus)
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return chats
    const q = query.toLowerCase()
    return chats.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.lastMessage?.toLowerCase().includes(q)),
    )
  }, [chats, query])

  const pinned = useMemo(() => filtered.filter((c) => c.pinned), [filtered])
  const regular = useMemo(() => filtered.filter((c) => !c.pinned && !c.archived), [filtered])
  const archived = useMemo(() => filtered.filter((c) => c.archived), [filtered])

  const isDisconnected =
    connectionState === 'disconnected' || connectionState === 'logged_out'
  const isSyncing =
    connectionState === 'syncing' || connectionState === 'connected'
  const progress =
    syncProgress && syncProgress.total > 0
      ? Math.round((syncProgress.current / syncProgress.total) * 100)
      : null

  if (chats.length === 0 && isDisconnected) {
    return (
      <div className="flex min-w-[320px] max-w-[420px] flex-1 flex-col border-r border-border bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-foreground">Chats</h1>
        </div>
        <EmptyState
          icon={<MessageSquare className="h-8 w-8" />}
          title="Not connected"
          description="Connect your WhatsApp to view chats"
          action={{ label: 'Connect', onClick: connect }}
          className="flex-1"
        />
      </div>
    )
  }

  if (chats.length === 0 && isSyncing) {
    return (
      <div className="flex min-w-[320px] max-w-[420px] flex-1 flex-col border-r border-border bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-foreground">Chats</h1>
        </div>
        <EmptyState
          icon={<MessageSquare className="h-8 w-8" />}
          title="Syncing chats"
          description={progress !== null ? `${syncProgress?.current}/${syncProgress?.total}` : 'Preparing...'}
          className="flex-1"
        />
      </div>
    )
  }

  if (chats.length === 0) {
    return (
      <div className="flex min-w-[320px] max-w-[420px] flex-1 flex-col border-r border-border bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-foreground">Chats</h1>
        </div>
        <EmptyState
          icon={<MessageSquare className="h-8 w-8" />}
          title="No chats found"
          className="flex-1"
        />
      </div>
    )
  }

  return (
    <div className="flex min-w-[320px] max-w-[420px] flex-1 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-lg font-semibold text-foreground">Chats</h1>
      </div>

      <div className="relative px-3 pb-2">
        <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats..."
          className="pl-9"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {pinned.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-4 py-1.5">
              <Star className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Pinned</span>
            </div>
            {pinned.map((chat) => (
              <ChatRow key={chat.id} chat={chat} onSelect={onSelectChat} />
            ))}
          </div>
        )}

        {regular.length > 0 && (
          <div>
            {pinned.length > 0 && (
              <div className="flex items-center gap-1.5 px-4 py-1.5">
                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">All Chats</span>
              </div>
            )}
            {regular.map((chat) => (
              <ChatRow key={chat.id} chat={chat} onSelect={onSelectChat} />
            ))}
          </div>
        )}

        {archived.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-4 py-1.5">
              <Archive className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Archived</span>
            </div>
            {archived.map((chat) => (
              <ChatRow key={chat.id} chat={chat} onSelect={onSelectChat} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface ChatRowProps {
  chat: {
    id: string
    name: string
    lastMessage?: string | null
    lastMessageTimestamp?: number | null
    lastMessageFromMe?: boolean
    lastMessageType?: string | null
    unreadCount?: number
  }
  onSelect: (id: string) => void
}

function ChatRow({ chat, onSelect }: ChatRowProps) {
  return (
    <button
      onClick={() => onSelect(chat.id)}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary"
    >
      <Avatar name={chat.name} className="size-10" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-medium text-foreground">{chat.name}</span>
          <span className="ml-2 shrink-0 text-xs text-muted-foreground">
            {formatTime(chat.lastMessageTimestamp)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between">
          <span className="truncate text-sm text-muted-foreground">
            {chat.lastMessageFromMe && (
              <span className="mr-0.5 text-muted-foreground">You: </span>
            )}
            {messagePreview(chat.lastMessage, chat.lastMessageType, chat.lastMessageFromMe)}
          </span>
          {chat.unreadCount ? (
            <span
              className={cn(
                'ml-2 shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-center text-xs font-medium text-primary-foreground',
                'min-w-[18px]',
              )}
            >
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  )
}
