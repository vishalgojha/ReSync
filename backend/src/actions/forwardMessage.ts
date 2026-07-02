import { Boom } from '@hapi/boom'
import type { Action } from './Action.js'

const forwardMessage: Action = {
  id: 'forwardMessage',
  name: 'Forward Message',
  description: 'Forward a message from one chat to another',
  inputSchema: {
    type: 'object',
    required: ['messageId', 'targetChatId'],
    properties: {
      messageId: { type: 'string' },
      targetChatId: { type: 'string' },
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
    const sent = await ctx.baileys.sendMessage(input.targetChatId, {
      forward: original,
      force: true,
    })

    return { status: 'forwarded', message: sent }
  },
}

export default forwardMessage
