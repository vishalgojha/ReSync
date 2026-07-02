import { getDb } from '../core/db.js'
import { getConversationState } from './ConversationState.js'

export interface TimelineEvent {
  id: number
  chat_id: string
  workspace_id: string
  event_type: string
  label: string
  description: string | null
  message_id: string | null
  metadata: string | null
  created_at: number
}

export function addTimelineEvent(workspaceId: string, chatId: string, event: {
  eventType: string
  label: string
  description?: string
  messageId?: string
  metadata?: Record<string, any>
}): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO conversation_timeline (chat_id, workspace_id, event_type, label, description, message_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    chatId, workspaceId,
    event.eventType,
    event.label,
    event.description || null,
    event.messageId || null,
    event.metadata ? JSON.stringify(event.metadata) : null,
  )
}

export function getTimeline(workspaceId: string, chatId: string, limit = 50, offset = 0): TimelineEvent[] {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM conversation_timeline
    WHERE workspace_id = ? AND chat_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(workspaceId, chatId, limit, offset) as TimelineEvent[]
}

export function generateMessageEvents(workspaceId: string, chatId: string, msg: {
  id: string
  fromMe: number
  timestamp: number
  textContent: string | null
  messageType: string | null
  quotedMessageId: string | null
}): void {
  const state = getConversationState(workspaceId, chatId)

  if (!state || !state.first_message_at || state.first_message_at === msg.timestamp) {
    addTimelineEvent(workspaceId, chatId, {
      eventType: 'conversation_started',
      label: 'Conversation Started',
      description: msg.textContent || undefined,
      messageId: msg.id,
    })
    return
  }

  if (msg.messageType === 'imageMessage') {
    addTimelineEvent(workspaceId, chatId, {
      eventType: 'media_shared',
      label: 'Media Shared',
      description: 'Shared a photo',
      messageId: msg.id,
    })
  } else if (msg.messageType === 'documentMessage') {
    addTimelineEvent(workspaceId, chatId, {
      eventType: 'document_shared',
      label: 'Document Shared',
      description: msg.textContent || 'Shared a document',
      messageId: msg.id,
    })
  } else if (msg.messageType === 'videoMessage' || msg.messageType === 'ptvMessage') {
    addTimelineEvent(workspaceId, chatId, {
      eventType: 'media_shared',
      label: 'Media Shared',
      description: 'Shared a video',
      messageId: msg.id,
    })
  } else if (msg.messageType === 'audioMessage') {
    addTimelineEvent(workspaceId, chatId, {
      eventType: 'media_shared',
      label: 'Media Shared',
      description: 'Shared an audio message',
      messageId: msg.id,
    })
  } else if (msg.messageType === 'stickerMessage') {
    // skip sticker events — too noisy
    return
  } else if (msg.messageType === 'locationMessage') {
    addTimelineEvent(workspaceId, chatId, {
      eventType: 'location_shared',
      label: 'Location Shared',
      description: msg.textContent || 'Shared a location',
      messageId: msg.id,
    })
  } else if (msg.messageType === 'contactMessage') {
    addTimelineEvent(workspaceId, chatId, {
      eventType: 'contact_shared',
      label: 'Contact Shared',
      description: msg.textContent || 'Shared a contact',
      messageId: msg.id,
    })
  } else if (msg.messageType === 'pollCreationMessage') {
    addTimelineEvent(workspaceId, chatId, {
      eventType: 'poll_created',
      label: 'Poll Created',
      description: msg.textContent || 'Created a poll',
      messageId: msg.id,
    })
  } else if (msg.messageType === 'reactionMessage') {
    addTimelineEvent(workspaceId, chatId, {
      eventType: 'reaction',
      label: 'Reaction',
      description: msg.textContent || 'Reacted to a message',
      messageId: msg.id,
    })
  }

  if (msg.fromMe) {
    addTimelineEvent(workspaceId, chatId, {
      eventType: 'agent_replied',
      label: 'Agent Replied',
      description: msg.textContent || undefined,
      messageId: msg.id,
    })
  } else {
    addTimelineEvent(workspaceId, chatId, {
      eventType: 'customer_replied',
      label: 'Customer Replied',
      description: msg.textContent || undefined,
      messageId: msg.id,
    })
  }
}
