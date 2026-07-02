import type { DispatchContext } from '../core/dispatcher.js'
import { EventDispatcher } from '../core/dispatcher.js'
import { ConditionRegistry } from './conditions/index.js'
import { TriggerRegistry } from './triggers/index.js'
import { AutomationStorage } from './AutomationStorage.js'
import { WorkflowRunner } from './WorkflowRunner.js'
import type { ConditionConfig } from './types.js'
import type { EngineDeps } from './types.js'

export class AutomationEngine {
  private deps: EngineDeps
  private running = false

  constructor(deps: EngineDeps) {
    this.deps = deps
  }

  start(): void {
    if (this.running) return
    this.running = true

    const d = this.deps.dispatcher

    d.on('messages.upsert', (ctx, data) => {
      void this.evaluateTriggersForMessage(ctx, data)
    })

    d.on('messages.update', (ctx, data) => {
      void this.evaluate('message.updated', ctx, data)
    })

    d.on('chat.created', (ctx, data) => {
      void this.evaluate('chat.created', ctx, data)
    })

    d.on('chat.updated', (ctx, data) => {
      void this.evaluate('chat.updated', ctx, data)
    })

    d.on('contact.updated', (ctx, data) => {
      void this.evaluate('contact.created', ctx, data)
      void this.evaluate('contact.updated', ctx, data)
    })

    d.on('action.completed', (ctx, data) => {
      void this.evaluate('action.completed', ctx, data)
    })

    d.on('action.failed', (ctx, data) => {
      void this.evaluate('action.failed', ctx, data)
    })
  }

  private async evaluateTriggersForMessage(ctx: DispatchContext, data: any) {
    const msg = data.messages?.[0]
    if (!msg) return
    if (msg.key?.fromMe) {
      await this.evaluate('message.sent', ctx, data)
    } else {
      await this.evaluate('message.received', ctx, data)
    }
  }

  private async evaluate(event: string, ctx: DispatchContext, data: any) {
    const automations = this.deps.storage.getByTriggerEvent(event, ctx.workspaceId)
    if (!automations.length) return

    const triggerRegistry = this.deps.capabilities.get<TriggerRegistry>('automation.triggers')
    const conditionRegistry = this.deps.capabilities.get<ConditionRegistry>('automation.conditions')

    for (const auto of automations) {
      if (!auto.enabled) continue

      const triggerHandler = triggerRegistry?.getHandler(event)
      if (triggerHandler && !triggerHandler(data)) continue

      if (auto.conditions.length) {
        let allPassed = true
        for (const cond of auto.conditions) {
          const handler = conditionRegistry?.get(cond.type)
          if (!handler) continue

          const dataWithChatId = { ...data, chatId: ctx.workspaceId }
          const passed = await Promise.resolve(handler(cond.params, ctx, dataWithChatId))
          if (!passed) {
            allPassed = false
            break
          }
        }
        if (!allPassed) continue
      }

      const actionCtx = this.deps.buildActionContext(ctx.workspaceId)
      void this.deps.runner.execute(auto, actionCtx, event, data)
    }
  }
}
