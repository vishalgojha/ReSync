import type { Plugin, PluginContext } from '../../../core/plugin.js'

export default {
  manifest: {
    id: 'example-logger',
    name: 'Example Logger',
    version: '1.0.0',
    author: 'ReSync',
    description: 'Logs all incoming WhatsApp messages to the console',
    permissions: [],
  },

  register(context: PluginContext) {
    const logger = context.logger

    context.dispatcher.on('messages.upsert', ({ workspaceId }, data) => {
      const messages: any[] = data.messages || []
      for (const msg of messages) {
        const chatId = msg.key?.remoteJid
        const fromMe = msg.key?.fromMe
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          '(non-text)'
        logger.info(`[${fromMe ? 'sent' : 'recv'}] ${chatId}: ${text}`)
      }
    })
  },
} satisfies Plugin
