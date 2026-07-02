import { Boom } from '@hapi/boom'
import type { Action } from './Action.js'

const markRead: Action = {
  id: 'markRead',
  name: 'Mark Chat Read',
  description: 'Mark all messages in a chat as read',
  inputSchema: {
    type: 'object',
    required: ['chatId'],
    properties: {
      chatId: { type: 'string' },
    },
  },
  permissions: [],

  async execute(ctx, input) {
    if (!ctx.baileys) {
      throw new Boom('Session not ready', { statusCode: 400 })
    }

    await ctx.baileys.readMessages([{ remoteJid: input.chatId, id: undefined as any }])

    ctx.database
      .prepare('UPDATE chats SET unread_count = 0 WHERE id = ? AND workspace_id = ?')
      .run(input.chatId, ctx.workspaceId)

    return { status: 'read', chatId: input.chatId }
  },
}

export default markRead
