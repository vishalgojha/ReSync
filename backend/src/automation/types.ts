import type { EventDispatcher, DispatchContext } from '../core/dispatcher.js'
import type { ActionContext, ActionMeta } from '../actions/Action.js'

export interface AutomationConfig {
  id: string
  workspaceId: string
  name: string
  description: string
  enabled: boolean
  trigger: TriggerConfig
  conditions: ConditionConfig[]
  actions: ActionStep[]
  createdAt: number
  updatedAt: number
}

export interface TriggerConfig {
  event: string
  filter?: Record<string, any>
}

export interface ConditionConfig {
  type: string
  params: Record<string, any>
}

export interface ActionStep {
  actionId: string
  params: Record<string, any>
  continueOnError?: boolean
}

export interface ExecutionRecord {
  id: string
  automationId: string
  workspaceId: string
  triggerEvent: string
  status: 'running' | 'completed' | 'failed' | 'partial'
  startedAt: number
  completedAt: number | null
  error: string | null
}

export interface LogEntry {
  id: string
  executionId: string
  step: number
  type: 'trigger' | 'condition' | 'action'
  actionId: string | null
  status: 'success' | 'failure' | 'skipped'
  message: string | null
  data: any
  timestamp: number
}

export type ConditionHandler = (params: any, ctx: DispatchContext, data: any) => boolean | Promise<boolean>

export interface AutomationAPI {
  register: {
    trigger: (event: string, handler?: (data: any) => boolean) => void
    condition: (name: string, handler: ConditionHandler) => void
  }
  getConfig: () => AutomationConfig[]
  getActions: () => ActionMeta[]
  getTriggers: () => string[]
  getConditions: () => string[]
}

export interface EngineDeps {
  dispatcher: EventDispatcher
  db: import('better-sqlite3').Database
  runner: import('./WorkflowRunner.js').WorkflowRunner
  storage: import('./AutomationStorage.js').AutomationStorage
  executionLog: import('./ExecutionLog.js').ExecutionLog
  capabilities: import('../core/plugin.js').CapabilityRegistry
  actionRegistry: import('../actions/ActionRegistry.js').ActionRegistry
  buildActionContext: (wid: string) => ActionContext
  io: import('socket.io').Server
}
