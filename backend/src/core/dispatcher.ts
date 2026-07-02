import { Server } from 'socket.io'

export interface DispatchContext {
  workspaceId: string
  io: Server
}

type EventHandler = (ctx: DispatchContext, data: any) => void

export class EventDispatcher {
  private handlers = new Map<string, EventHandler[]>()

  on(event: string, handler: EventHandler): void {
    const list = this.handlers.get(event)
    if (list) {
      list.push(handler)
    } else {
      this.handlers.set(event, [handler])
    }
  }

  dispatch(event: string, ctx: DispatchContext, data: any): void {
    const handlers = this.handlers.get(event)
    if (!handlers) return
    for (const handler of handlers) {
      try {
        handler(ctx, data)
      } catch (err) {
        console.error(`[dispatcher] ${event}:`, err)
      }
    }
  }
}
