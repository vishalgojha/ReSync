interface Chat {
  id: string
  name: string
  lastMessage?: string | null
  lastMessageTimestamp?: number | null
  unreadCount?: number
}

interface Props {
  chats: Chat[]
  onSelectChat: (chat: Chat) => void
  onDisconnect: () => void
  onSettings: () => void
}

function formatTime(ts?: number | null): string {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

export default function ChatList({ chats, onSelectChat, onDisconnect, onSettings }: Props) {
  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h1 className="text-lg font-semibold text-white">Chats</h1>
        <div className="flex gap-3">
          <button
            onClick={onSettings}
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            AI
          </button>
          <button
            onClick={onDisconnect}
            className="text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="text-center text-zinc-500 mt-8">No chats yet</div>
        ) : (
          chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => onSelectChat(chat)}
              className="w-full text-left px-4 py-3 hover:bg-zinc-900 transition-colors border-b border-zinc-800/50"
            >
              <div className="flex items-center justify-between">
                <span className="text-white font-medium truncate mr-2">{chat.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {chat.unreadCount ? (
                    <span className="bg-green-600 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {chat.unreadCount}
                    </span>
                  ) : null}
                  <span className="text-zinc-600 text-xs">{formatTime(chat.lastMessageTimestamp)}</span>
                </div>
              </div>
              {chat.lastMessage && (
                <p className="text-zinc-500 text-sm truncate mt-0.5">{chat.lastMessage}</p>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
