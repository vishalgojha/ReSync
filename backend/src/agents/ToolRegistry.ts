import type { CapabilityRegistry } from '../core/plugin.js'
import type { ActionContext } from '../actions/Action.js'
import type { ActionRunner } from '../actions/ActionRunner.js'

export interface Tool {
  name: string
  description: string
  parameters: Record<string, any>
  execute(input: Record<string, any>): Promise<any>
}

export class ToolRegistry {
  private tools = new Map<string, Tool>()

  register(tool: Tool): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values())
  }

  getDefinitions(): { name: string; description: string; parameters: Record<string, any> }[] {
    return this.getAll().map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }))
  }

  static createDefault(capabilities: CapabilityRegistry, runner: ActionRunner, ctx: () => ActionContext): ToolRegistry {
    const registry = new ToolRegistry()

    const conv = capabilities.get<any>('conversation')
    const graph = capabilities.get<any>('graph')

    // ── Conversation tools ──
    if (conv) {
      registry.register({
        name: 'conversation_get',
        description: 'Get full conversation summary including state, timeline, facts, entities, contacts, files, and topics for a chat. Returns structured data about the conversation.',
        parameters: {
          type: 'object',
          properties: {
            chatId: { type: 'string', description: 'The chat ID (JID)' },
          },
          required: ['chatId'],
        },
        async execute(input) {
          const c = ctx()
          return conv.get(c.workspaceId, input.chatId)
        },
      })

      registry.register({
        name: 'conversation_timeline',
        description: 'Get timeline of events for a conversation — when it started, replies, media shared, etc.',
        parameters: {
          type: 'object',
          properties: {
            chatId: { type: 'string', description: 'The chat ID (JID)' },
            limit: { type: 'number', description: 'Max events to return' },
          },
          required: ['chatId'],
        },
        async execute(input) {
          const c = ctx()
          return conv.timeline(c.workspaceId, input.chatId, input.limit || 30)
        },
      })

      registry.register({
        name: 'conversation_memory',
        description: 'Get tracked memory for a conversation: pinned facts, extracted entities, frequently mentioned contacts, shared files, and discussed topics. All deterministic — no AI.',
        parameters: {
          type: 'object',
          properties: {
            chatId: { type: 'string', description: 'The chat ID (JID)' },
          },
          required: ['chatId'],
        },
        async execute(input) {
          const c = ctx()
          return conv.memory(c.workspaceId, input.chatId)
        },
      })
    }

    // ── Knowledge Graph tools ──
    if (graph) {
      registry.register({
        name: 'graph_find_entity',
        description: 'Search the knowledge graph for entities by name/query. Finds all matching entities across conversations — persons, locations, phones, emails, companies, money amounts, dates, documents, links.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
        async execute(input) {
          const c = ctx()
          return graph.findEntity(c.workspaceId, input.query)
        },
      })

      registry.register({
        name: 'graph_get_related',
        description: 'Get all entities related to a specific graph node. Shows relationships (has_budget, interested_in, rejected, works_at, co_occurs_with, etc.) and direction.',
        parameters: {
          type: 'object',
          properties: {
            nodeId: { type: 'string', description: 'The graph node ID' },
          },
          required: ['nodeId'],
        },
        async execute(input) {
          const c = ctx()
          const node = graph.getNode(c.workspaceId, input.nodeId)
          if (!node) return { error: 'Node not found' }
          const related = graph.getRelated(c.workspaceId, input.nodeId)
          return { node, related }
        },
      })

      registry.register({
        name: 'graph_chat_entities',
        description: 'Get all knowledge graph entities for a specific conversation. Returns extracted entities (persons, locations, money, etc.) and their relationships.',
        parameters: {
          type: 'object',
          properties: {
            chatId: { type: 'string', description: 'The chat ID (JID)' },
          },
          required: ['chatId'],
        },
        async execute(input) {
          const c = ctx()
          return graph.getChatGraph(c.workspaceId, input.chatId)
        },
      })
    }

    // ── Search tool ──
    registry.register({
      name: 'search_messages',
      description: 'Search messages across all conversations by text query. Returns matching messages with chat name, timestamp, and sender info.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Max results' },
        },
        required: ['query'],
      },
      async execute(input) {
        const c = ctx()
        const db = c.database
        const like = `%${input.query}%`
        const messages = db.prepare(`
          SELECT m.id, m.chat_id, m.text_content, m.timestamp, m.from_me, m.message_type,
                 c.name AS chat_name
          FROM messages m
          LEFT JOIN chats c ON c.id = m.chat_id AND c.workspace_id = m.workspace_id
          WHERE m.workspace_id = ? AND m.text_content LIKE ?
          ORDER BY m.timestamp DESC
          LIMIT ?
        `).all(c.workspaceId, like, input.limit || 20) as any[]

        return messages.map((m: any) => ({
          id: m.id,
          chatId: m.chat_id,
          text: m.text_content,
          timestamp: m.timestamp,
          fromMe: !!m.from_me,
          type: m.message_type,
          chatName: m.chat_name || m.chat_id?.split('@')[0],
        }))
      },
    })

    // ── Action tools ──
    registry.register({
      name: 'send_message',
      description: 'Send a text message to a WhatsApp chat. Must include chatId and text. Optionally reply to a specific message with quotedMessageId.',
      parameters: {
        type: 'object',
        properties: {
          chatId: { type: 'string', description: 'Target chat ID (JID)' },
          text: { type: 'string', description: 'Message text' },
          quotedMessageId: { type: 'string', description: 'ID of message to reply to (optional)' },
        },
        required: ['chatId', 'text'],
      },
      async execute(input) {
        return runner.execute('sendMessage', {
          chatId: input.chatId,
          text: input.text,
          quotedMessageId: input.quotedMessageId,
        }, ctx())
      },
    })

    registry.register({
      name: 'reply_message',
      description: 'Reply to a specific message in a chat. Provide the messageId to reply to and the reply text.',
      parameters: {
        type: 'object',
        properties: {
          chatId: { type: 'string', description: 'Chat ID' },
          messageId: { type: 'string', description: 'Message ID to reply to' },
          text: { type: 'string', description: 'Reply text' },
        },
        required: ['chatId', 'messageId', 'text'],
      },
      async execute(input) {
        return runner.execute('replyMessage', input, ctx())
      },
    })

    registry.register({
      name: 'mark_read',
      description: 'Mark all messages in a chat as read.',
      parameters: {
        type: 'object',
        properties: {
          chatId: { type: 'string', description: 'Chat ID' },
        },
        required: ['chatId'],
      },
      async execute(input) {
        return runner.execute('markRead', input, ctx())
      },
    })

    registry.register({
      name: 'download_media',
      description: 'Download media from a specific message. Provide the message ID. Returns the file path and MIME type.',
      parameters: {
        type: 'object',
        properties: {
          messageId: { type: 'string', description: 'Message ID containing media' },
        },
        required: ['messageId'],
      },
      async execute(input) {
        return runner.execute('downloadMedia', input, ctx())
      },
    })

    // ── Automation tools ──
    registry.register({
      name: 'list_automations',
      description: 'List all configured automations/workflows with their status, trigger type, and action steps.',
      parameters: {
        type: 'object',
        properties: {},
      },
      async execute() {
        const c = ctx()
        const db = c.database
        const automations = db.prepare(`
          SELECT id, name, enabled, trigger_type, created_at
          FROM automations WHERE workspace_id = ?
          ORDER BY created_at DESC
        `).all(c.workspaceId) as any[]
        return automations
      },
    })

    registry.register({
      name: 'run_automation',
      description: 'Manually trigger a specific automation by ID.',
      parameters: {
        type: 'object',
        properties: {
          automationId: { type: 'string', description: 'Automation ID' },
        },
        required: ['automationId'],
      },
      async execute(input) {
        const c = ctx()
        return runner.execute('runAutomation', input, ctx())
      },
    })

    return registry
  }
}
