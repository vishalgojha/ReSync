import { Boom } from '@hapi/boom'
import type { Action } from './Action.js'

const replyMessage: Action = {
  id: 'replyMessage',
  name: 'Reply to Message',
  description: 'Reply to a specific message in a chat',
  inputSchema: {
    type: 'object',
    required: ['chatId', 'text', 'quotedMessageId'],
    properties: {
      chatId: { type: 'string' },
      text: { type: 'string' },
      quotedMessageId: { type: 'string' },
    },
  },
  permissions: [],

  async execute(ctx, input) {
    if (!ctx.baileys) {
      throw new Boom('Session not ready', { statusCode: 400 })
    }

    const row = ctx.database
      .prepare('SELECT data_json FROM messages WHERE id = ? AND workspace_id = ?')
      .get(input.quotedMessageId, ctx.workspaceId) as any
    if (!row) {
      throw new Boom('Quoted message not found', { statusCode: 404 })
    }

    const original = JSON.parse(row.data_json)
    const sent = await ctx.baileys.sendMessage(input.chatId, {
      text: input.text,
      quoted: { key: original.key, message: original.message },
    })

    return { status: 'sent', message: sent }
  },
}

export default replyMessage
