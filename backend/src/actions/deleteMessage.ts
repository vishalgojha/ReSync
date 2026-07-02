import { Boom } from '@hapi/boom'
import type { Action } from './Action.js'

const deleteMessage: Action = {
  id: 'deleteMessage',
  name: 'Delete Message',
  description: 'Delete a message for yourself (or for everyone where supported)',
  inputSchema: {
    type: 'object',
    required: ['chatId', 'messageId'],
    properties: {
      chatId: { type: 'string' },
      messageId: { type: 'string' },
      forEveryone: { type: 'boolean' },
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
    const deleteForEveryone = input.forEveryone === true

    await ctx.baileys.sendMessage(input.chatId, {
      delete: { remoteJid: input.chatId, fromMe: original.key?.fromMe, id: original.key?.id, participant: original.key?.participant },
    })

    const parsed = JSON.parse(row.data_json)
    parsed.message = null
    parsed._deleted = true
    ctx.database
      .prepare('UPDATE messages SET message_type = ?, text_content = ?, data_json = ? WHERE id = ? AND workspace_id = ?')
      .run('deleted', 'This message was deleted', JSON.stringify(parsed), input.messageId, ctx.workspaceId)

    return { status: 'deleted', messageId: input.messageId, forEveryone: deleteForEveryone }
  },
}

export default deleteMessage
