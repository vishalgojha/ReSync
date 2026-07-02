import { getDb } from '../core/db.js'
import type { EventDispatcher, DispatchContext } from '../core/dispatcher.js'
import {
  updateMessageCounts,
  getConversationState,
} from './ConversationState.js'
import type { ConversationStateRow } from './ConversationState.js'
import { generateMessageEvents, getTimeline } from './Timeline.js'
import type { TimelineEvent } from './Timeline.js'
import {
  addFact,
  getFacts,
  addEntity,
  getEntities,
  getTrackedContacts,
  trackFileShare,
  getTrackedFiles,
  trackTopics,
  getTopics,
} from './Memory.js'
import type { MemoryItem, TopicItem } from './Memory.js'

export interface ConversationSummary {
  chatId: string
  workspaceId: string
  state: ConversationStateRow | null
  timeline: TimelineEvent[]
  facts: MemoryItem[]
  entities: MemoryItem[]
  contacts: MemoryItem[]
  files: MemoryItem[]
  topics: TopicItem[]
}

export class ConversationCapability {
  private dispatcher: EventDispatcher | null = null

  setDispatcher(d: EventDispatcher) {
    this.dispatcher = d
  }

  get(workspaceId: string, chatId: string): ConversationSummary {
    const state = getConversationState(workspaceId, chatId)
    return {
      chatId,
      workspaceId,
      state,
      timeline: getTimeline(workspaceId, chatId, 30),
      facts: getFacts(workspaceId, chatId),
      entities: getEntities(workspaceId, chatId),
      contacts: getTrackedContacts(workspaceId, chatId),
      files: getTrackedFiles(workspaceId, chatId),
      topics: getTopics(workspaceId, chatId),
    }
  }

  state(workspaceId: string, chatId: string): ConversationStateRow | null {
    return getConversationState(workspaceId, chatId)
  }

  timeline(workspaceId: string, chatId: string, limit = 50, offset = 0): TimelineEvent[] {
    return getTimeline(workspaceId, chatId, limit, offset)
  }

  memory(workspaceId: string, chatId: string) {
    return {
      facts: getFacts(workspaceId, chatId),
      entities: getEntities(workspaceId, chatId),
      contacts: getTrackedContacts(workspaceId, chatId),
      files: getTrackedFiles(workspaceId, chatId),
      topics: getTopics(workspaceId, chatId),
    }
  }

  addFact(workspaceId: string, chatId: string, fact: string, source?: string): void {
    addFact(workspaceId, chatId, fact, source)
  }

  getFacts(workspaceId: string, chatId: string): MemoryItem[] {
    return getFacts(workspaceId, chatId)
  }

  // Message processing — called on messages.upsert
  processMessage(ctx: DispatchContext, data: any): void {
    const workspaceId = ctx.workspaceId
    const raw: any[] = data.messages || []

    for (const msg of raw) {
      const chatId = msg.key?.remoteJid
      if (!chatId) continue

      const fromMe = msg.key?.fromMe ? 1 : 0
      const timestamp = msg.messageTimestamp || Math.floor(Date.now() / 1000)
      const msgContent = msg.message
      const msgId = msg.key?.id

      let textContent: string | null = null
      let messageType: string | null = null

      if (msgContent) {
        const types = ['conversation', 'extendedTextMessage', 'imageMessage', 'videoMessage',
          'audioMessage', 'ptvMessage', 'documentMessage', 'stickerMessage',
          'locationMessage', 'liveLocationMessage', 'contactMessage',
          'pollCreationMessage', 'reactionMessage']
        for (const t of types) {
          if (msgContent[t]) {
            messageType = t
            textContent = msgContent[t]?.text || msgContent[t]?.caption || msgContent.conversation || null
            break
          }
        }
      }

      const quotedMsgId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId || null

      updateMessageCounts(workspaceId, chatId, {
        fromMe,
        timestamp,
        textContent,
        messageType,
      })

      generateMessageEvents(workspaceId, chatId, {
        id: msgId,
        fromMe,
        timestamp,
        textContent,
        messageType,
        quotedMessageId: quotedMsgId,
      })

      if (textContent) {
        trackTopics(workspaceId, chatId, textContent, msgId, timestamp)
      }

      if (messageType === 'documentMessage' && msgContent?.documentMessage) {
        const doc = msgContent.documentMessage
        trackFileShare(workspaceId, chatId, doc.fileName || 'document', doc.mimetype || 'application/octet-stream', doc.fileLength || 0)
      }
      if (messageType === 'imageMessage' && msgContent?.imageMessage) {
        trackFileShare(workspaceId, chatId, 'photo', msgContent.imageMessage.mimetype || 'image/jpeg', msgContent.imageMessage.fileLength || 0)
      }

      if (textContent) {
        const priceMatch = textContent.match(/(?:price|cost|budget|spend|worth|value)[:\s]*[$€£]?\s*(\d[\d,.]*)/i)
        if (priceMatch) {
          addEntity(workspaceId, chatId, 'price', priceMatch[1], 'text')
        }

        const emailMatch = textContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
        if (emailMatch) {
          addEntity(workspaceId, chatId, 'email', emailMatch[0], 'text')
        }

        const phoneMatch = textContent.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/)
        if (phoneMatch) {
          addEntity(workspaceId, chatId, 'phone', phoneMatch[0], 'text')
        }
      }

      if (this.dispatcher) {
        this.dispatcher.dispatch('conversation.updated', ctx, {
          workspaceId,
          chatId,
          messageId: msgId,
          messageType,
          textContent,
          fromMe,
          timestamp,
        })
      }
    }
  }
}
