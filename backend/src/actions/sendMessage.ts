import { Boom } from '@hapi/boom'
import type { Action } from './Action.js'

const sendMessage: Action = {
  id: 'sendMessage',
  name: 'Send Message',
  description: 'Send a text message to a chat',
  inputSchema: {
    type: 'object',
    required: ['chatId', 'text'],
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

    const msg: any = { text: input.text }
    if (input.quotedMessageId) {
      const row = ctx.database
        .prepare('SELECT data_json FROM messages WHERE id = ? AND workspace_id = ?')
        .get(input.quotedMessageId, ctx.workspaceId) as any
      if (row) {
        const original = JSON.parse(row.data_json)
        msg.quoted = { key: original.key, message: original.message }
      }
    }

    const sent = await ctx.baileys.sendMessage(input.chatId, msg)
    return { status: 'sent', message: sent }
  },
}

export default sendMessage
