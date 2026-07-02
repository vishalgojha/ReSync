export type ConnectionState = 'connecting' | 'qr' | 'connected' | 'syncing' | 'disconnected' | 'logged_out' | 'error'

export interface SyncProgress {
  type: 'chats' | 'contacts'
  current: number
  total: number
}

export interface Chat {
  id: string
  name: string
  lastMessage?: string | null
  lastMessageTimestamp?: number | null
  lastMessageFromMe?: boolean
  lastMessageType?: string | null
  unreadCount?: number
  archived?: boolean
  pinned?: boolean
  muted?: boolean
}

export interface MessageRow {
  id: string
  chatId: string
  data_json: string
  fromMe: number
  messageType: string | null
  timestamp: number | null
  textContent: string | null
  sender: string | null
  quotedMessageId: string | null
  quotedText: string | null
  mediaUrl: string | null
  mediaMimeType: string | null
  mediaSize: number | null
  mediaSha256: string | null
  mediaStoragePath: string | null
  mediaDownloadStatus: string | null
  status: string | null
}

export type Tab =
  | 'overview'
  | 'timeline'
  | 'stats'
  | 'facts'
  | 'participants'
  | 'files'
  | 'health'
  | 'graph'
