import { Boom } from '@hapi/boom'
import type { Action } from './Action.js'

const reactMessage: Action = {
  id: 'reactMessage',
  name: 'React to Message',
  description: 'Send an emoji reaction to a message',
  inputSchema: {
    type: 'object',
    required: ['chatId', 'messageId', 'emoji'],
    properties: {
      chatId: { type: 'string' },
      messageId: { type: 'string' },
      emoji: { type: 'string' },
    },
  },
  permissions: [],

  async execute(ctx, input) {
    if (!ctx.baileys) {
      throw new Boom('Session not ready', { statusCode: 400 })
    }

    const row = ctx.database
      .prepare('SELECT data_json FROM messages WHERE id = ? AND workspace_id = ?')
      .get(input.messageId, ctx.workspaceId) as any
    if (!row) {
      throw new Boom('Message not found', { statusCode: 404 })
    }

    const original = JSON.parse(row.data_json)
    await ctx.baileys.sendMessage(input.chatId, {
      react: { text: input.emoji, key: original.key },
    })

    return { status: 'reacted', emoji: input.emoji, messageId: input.messageId }
  },
}

export default reactMessage
