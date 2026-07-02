import type { Plugin, PluginContext } from '../../core/plugin.js'

export default {
  manifest: {
    id: 'analytics',
    name: 'Analytics',
    version: '1.0.0',
    author: 'ReSync',
    description: 'Tracks message counts and activity per chat',
    permissions: ['database'],
  },

  register(context: PluginContext) {
    const logger = context.logger

    context.dispatcher.on('messages.upsert', ({ workspaceId }, data) => {
      const messages: any[] = data.messages || []
      const counts: Record<string, number> = {}
      for (const msg of messages) {
        const chatId = msg.key?.remoteJid
        if (chatId) {
          counts[chatId] = (counts[chatId] || 0) + 1
        }
      }
      const existing = context.database.getPluginSetting(workspaceId)
      const running = existing.counts || {}
      for (const [chatId, n] of Object.entries(counts)) {
        running[chatId] = (running[chatId] || 0) + (n as number)
      }
      context.database.setPluginSetting(workspaceId, { ...existing, counts: running })
      logger.info(`counted ${messages.length} messages across ${Object.keys(counts).length} chats`)
    })
  },
} satisfies Plugin
