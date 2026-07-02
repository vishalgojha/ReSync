export class TriggerRegistry {
  private handlers = new Map<string, (data: any) => boolean>()

  register(event: string, handler?: (data: any) => boolean): void {
    this.handlers.set(event, handler || (() => true))
  }

  getHandler(event: string): ((data: any) => boolean) | undefined {
    return this.handlers.get(event)
  }

  getAll(): string[] {
    return Array.from(this.handlers.keys())
  }
}

export function registerBuiltinTriggers(registry: TriggerRegistry): void {
  registry.register('message.received', (data: any) => {
    const msg = data.messages?.[0]
    return msg && !msg.key?.fromMe
  })

  registry.register('message.sent', (data: any) => {
    const msg = data.messages?.[0]
    return msg && !!msg.key?.fromMe
  })

  registry.register('message.updated', () => true)
  registry.register('chat.created', () => true)
  registry.register('chat.updated', () => true)
  registry.register('contact.created', () => true)
  registry.register('contact.updated', () => true)
  registry.register('action.completed', () => true)
  registry.register('action.failed', () => true)
}
