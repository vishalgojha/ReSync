import { Boom } from '@hapi/boom'
import type { Server } from 'socket.io'
import type { ActionContext } from './Action.js'
import { ActionRegistry } from './ActionRegistry.js'
import { EventDispatcher, type DispatchContext } from '../core/dispatcher.js'

function validateSchema(schema: Record<string, any>, input: any): void {
  if (!schema || !schema.properties) return

  if (schema.required) {
    for (const field of schema.required) {
      if (input[field] === undefined || input[field] === null) {
        throw new Boom(`Missing required field: ${field}`, { statusCode: 400 })
      }
    }
  }

  for (const [key, prop] of Object.entries(schema.properties)) {
    if (input[key] === undefined) continue
    const p = prop as any
    const val = input[key]

    if (p.type === 'array') {
      if (!Array.isArray(val)) {
        throw new Boom(`Field "${key}" must be an array`, { statusCode: 400 })
      }
    } else if (p.type && typeof val !== p.type) {
      throw new Boom(`Field "${key}" must be of type ${p.type}`, { statusCode: 400 })
    }

    if (p.enum && !p.enum.includes(val)) {
      throw new Boom(`Field "${key}" must be one of: ${p.enum.join(', ')}`, { statusCode: 400 })
    }
  }
}

export class ActionRunner {
  constructor(
    private registry: ActionRegistry,
    private dispatcher: EventDispatcher,
    private io: Server,
  ) {}

  async execute(actionId: string, input: any, ctx: ActionContext): Promise<any> {
    const action = this.registry.get(actionId)
    if (!action) {
      throw new Boom(`Unknown action: ${actionId}`, { statusCode: 404 })
    }

    validateSchema(action.inputSchema, input)

    const dc: DispatchContext = { workspaceId: ctx.workspaceId, io: this.io }

    this.dispatcher.dispatch('action.started', dc, { actionId, input })

    try {
      const result = await action.execute(ctx, input)
      this.dispatcher.dispatch('action.completed', dc, { actionId, result })
      return result
    } catch (err: any) {
      const error = err?.message || String(err)
      this.dispatcher.dispatch('action.failed', dc, { actionId, error })
      throw err
    }
  }
}
