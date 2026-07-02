import { Boom } from '@hapi/boom'
import type { Action } from './Action.js'

const archiveChat: Action = {
  id: 'archiveChat',
  name: 'Archive Chat',
  description: 'Archive or unarchive a chat',
  inputSchema: {
    type: 'object',
    required: ['chatId', 'archive'],
    properties: {
      chatId: { type: 'string' },
      archive: { type: 'boolean' },
    },
  },
  permissions: [],

  async execute(ctx, input) {
    if (!ctx.baileys) {
      throw new Boom('Session not ready', { statusCode: 400 })
    }

    await ctx.baileys.chatModify(
      { archive: input.archive },
      input.chatId,
    )

    ctx.database
      .prepare('UPDATE chats SET archived = ? WHERE id = ? AND workspace_id = ?')
      .run(input.archive ? 1 : 0, input.chatId, ctx.workspaceId)

    return { status: input.archive ? 'archived' : 'unarchived', chatId: input.chatId }
  },
}

export default archiveChat
