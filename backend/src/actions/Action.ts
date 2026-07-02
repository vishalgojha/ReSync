import type { EventDispatcher } from '../core/dispatcher.js'
import type { CapabilityRegistry } from '../core/plugin.js'
import type Database from 'better-sqlite3'

export interface ActionContext {
  workspaceId: string
  dispatcher: EventDispatcher
  database: Database.Database
  logger: {
    info: (msg: string, ...args: any[]) => void
    warn: (msg: string, ...args: any[]) => void
    error: (msg: string, ...args: any[]) => void
  }
  storage: string
  capabilities: CapabilityRegistry
  baileys: any
  config: Record<string, any>
}

export interface Action<Input = any, Output = any> {
  id: string
  name: string
  description: string
  inputSchema: Record<string, any>
  permissions: string[]
  execute(ctx: ActionContext, input: Input): Promise<Output>
}

export interface ActionMeta {
  id: string
  name: string
  description: string
  inputSchema: Record<string, any>
  permissions: string[]
}
