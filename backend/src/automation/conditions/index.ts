import type { ConditionHandler } from '../types.js'

export class ConditionRegistry {
  private handlers = new Map<string, ConditionHandler>()

  register(name: string, handler: ConditionHandler): void {
    this.handlers.set(name, handler)
  }

  get(name: string): ConditionHandler | undefined {
    return this.handlers.get(name)
  }

  getAll(): string[] {
    return Array.from(this.handlers.keys())
  }
}

export function registerBuiltinConditions(registry: ConditionRegistry): void {
  registry.register('containsText', (params: { text?: string }, _ctx, data) => {
    const msg = data.messages?.[0] || data
    const text = msg.textContent || msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    if (!params.text) return true
    return text.toLowerCase().includes(params.text.toLowerCase())
  })

  registry.register('fromMe', (params: { value?: boolean }, _ctx, data) => {
    const msg = data.messages?.[0] || data
    const fromMe = msg.key?.fromMe || msg.fromMe === 1
    return params.value === undefined || fromMe === params.value
  })

  registry.register('chatMatches', (params: { jid?: string; name?: string }, _ctx, data) => {
    const chatId = data.chatId || data.id || data.chat_id || data.key?.remoteJid || ''
    const chatName = data.chatName || data.name || ''
    if (params.jid && !chatId.includes(params.jid)) return false
    if (params.name && !chatName.toLowerCase().includes(params.name.toLowerCase())) return false
    return true
  })

  registry.register('contactMatches', (params: { jid?: string; name?: string }, _ctx, data) => {
    const contactJid = data.jid || data.id || ''
    const contactName = data.name || data.pushName || data.push_name || ''
    if (params.jid && !contactJid.includes(params.jid)) return false
    if (params.name && !contactName.toLowerCase().includes(params.name.toLowerCase())) return false
    return true
  })

  registry.register('messageType', (params: { type?: string }, _ctx, data) => {
    const msg = data.messages?.[0] || data
    const type = msg.messageType || msg.message_type || ''
    if (!params.type) return true
    return type === params.type
  })

  registry.register('timeWindow', (params: { start?: string; end?: string }) => {
    const now = new Date()
    const hour = now.getHours()
    const minute = now.getMinutes()
    const total = hour * 60 + minute
    if (params.start) {
      const [h, m] = params.start.split(':').map(Number)
      if (total < h * 60 + (m || 0)) return false
    }
    if (params.end) {
      const [h, m] = params.end.split(':').map(Number)
      if (total > h * 60 + (m || 0)) return false
    }
    return true
  })
}
