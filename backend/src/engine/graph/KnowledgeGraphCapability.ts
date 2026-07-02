import type { EventDispatcher, DispatchContext } from '../../core/dispatcher.js'
import { initGraphTables, upsertNode, upsertEdge, getNode, findNodesByValue, findNodesByType, getChatNodes, getRelatedEntities, getChatGraph, getAllEntityTypes } from './db.js'
import { extractEntities, extractPersonFromContact } from './EntityExtractor.js'
import { buildRelationships } from './RelationshipBuilder.js'
import type { GraphNode, GraphEdge, RelatedEntity } from './types.js'

export class KnowledgeGraphCapability {
  private dispatcher: EventDispatcher | null = null

  constructor() {
    initGraphTables()
  }

  setDispatcher(d: EventDispatcher) {
    this.dispatcher = d
  }

  // Query by chat
  getChatNodes(workspaceId: string, chatId: string): GraphNode[] {
    return getChatNodes(workspaceId, chatId)
  }

  getChatGraph(workspaceId: string, chatId: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return getChatGraph(workspaceId, chatId)
  }

  // Query by entity
  findEntity(workspaceId: string, query: string): GraphNode[] {
    return findNodesByValue(workspaceId, query)
  }

  findByType(workspaceId: string, type: string): GraphNode[] {
    return findNodesByType(workspaceId, type as any)
  }

  // Get related entities for a node
  getRelated(workspaceId: string, nodeId: string): RelatedEntity[] {
    return getRelatedEntities(workspaceId, nodeId)
  }

  // Get a single node
  getNode(workspaceId: string, nodeId: string): GraphNode | undefined {
    return getNode(workspaceId, nodeId)
  }

  // Stats
  getEntityTypes(workspaceId: string): { type: string; count: number }[] {
    return getAllEntityTypes(workspaceId)
  }

  // Process message — extract entities + build relationships
  processMessage(ctx: DispatchContext, data: any): void {
    const workspaceId = ctx.workspaceId
    const raw: any[] = data.messages || []

    for (const msg of raw) {
      const chatId = msg.key?.remoteJid
      if (!chatId) continue

      const msgId = msg.key?.id
      const msgContent = msg.message
      const timestamp = msg.messageTimestamp || Math.floor(Date.now() / 1000)

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

      const entities = textContent ? extractEntities(textContent) : []

      // Extract person from contact card
      if (messageType === 'contactMessage' && msgContent?.contactMessage) {
        const displayName = msgContent.contactMessage.displayName
        if (displayName) {
          const person = extractPersonFromContact(displayName)
          if (person) entities.push(person)
        }
      }

      if (entities.length === 0) continue

      // Upsert all entity nodes
      const nodeIds: Map<number, string> = new Map()
      for (let i = 0; i < entities.length; i++) {
        const e = entities[i]
        const metadata: Record<string, any> = {}
        if (e.metadata) Object.assign(metadata, e.metadata)
        metadata.messageType = messageType

        const id = upsertNode(workspaceId, chatId, e.type, e.value, e.normalized, metadata)
        nodeIds.set(i, id)
      }

      // Build relationships
      const pairs = buildRelationships(entities, textContent || '')

      for (const pair of pairs) {
        const sourceId = nodeIds.get(pair.sourceIdx)
        const targetId = nodeIds.get(pair.targetIdx)
        if (!sourceId || !targetId) continue

        upsertEdge(workspaceId, chatId, sourceId, targetId, pair.relationship, msgId)
      }

      if (this.dispatcher) {
        this.dispatcher.dispatch('graph.updated', ctx, {
          workspaceId,
          chatId,
          messageId: msgId,
          entities: entities.map(e => ({ type: e.type, value: e.value })),
          relationshipCount: pairs.length,
        })
      }
    }
  }
}
