import crypto from 'crypto'
import type { ActionContext } from '../actions/Action.js'
import type { ActionRunner } from '../actions/ActionRunner.js'
import type { AutomationConfig, ExecutionRecord, LogEntry } from './types.js'
import { AutomationStorage } from './AutomationStorage.js'

export class WorkflowRunner {
  constructor(
    private runner: ActionRunner,
    private storage: AutomationStorage,
  ) {}

  async execute(
    automation: AutomationConfig,
    ctx: ActionContext,
    triggerEvent: string,
    triggerData: any,
  ): Promise<ExecutionRecord> {
    const exec: ExecutionRecord = {
      id: crypto.randomUUID(),
      automationId: automation.id,
      workspaceId: automation.workspaceId,
      triggerEvent,
      status: 'running',
      startedAt: Math.floor(Date.now() / 1000),
      completedAt: null,
      error: null,
    }

    this.storage.createExecution(exec)
    this.appendLog(exec.id, 0, 'trigger', null, 'success', `Triggered by ${triggerEvent}`, { event: triggerEvent })

    let allSucceeded = true
    let step = 1

    for (const actionStep of automation.actions) {
      const actionCtx: ActionContext = {
        ...ctx,
        config: { ...ctx.config, ...actionStep.params, _triggerData: triggerData, _automationId: automation.id, _executionId: exec.id },
      }

      try {
        const result = await this.runner.execute(actionStep.actionId, actionStep.params, actionCtx)
        this.appendLog(exec.id, step, 'action', actionStep.actionId, 'success', `Executed ${actionStep.actionId}`, result)
      } catch (err: any) {
        this.appendLog(exec.id, step, 'action', actionStep.actionId, 'failure', err.message, { error: String(err) })
        if (!actionStep.continueOnError) {
          allSucceeded = false
          exec.status = 'failed'
          exec.error = err.message
          exec.completedAt = Math.floor(Date.now() / 1000)
          this.storage.updateExecution(exec.id, { status: 'failed', error: err.message })
          return exec
        }
      }
      step++
    }

    exec.status = allSucceeded ? 'completed' : 'partial'
    exec.completedAt = Math.floor(Date.now() / 1000)
    this.storage.updateExecution(exec.id, { status: exec.status })
    return exec
  }

  private appendLog(executionId: string, step: number, type: LogEntry['type'], actionId: string | null, status: LogEntry['status'], message: string | null, data: any): void {
    this.storage.appendLog({ executionId, step, type, actionId, status, message, data })
  }
}
