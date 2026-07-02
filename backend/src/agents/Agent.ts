import type { Tool, ToolRegistry } from './ToolRegistry.js'
import type { CapabilityRegistry } from '../core/plugin.js'

export interface AgentManifest {
  id: string
  name: string
  description: string
  version: string
}

export interface AgentContext {
  workspaceId: string
  chatId?: string
  userId?: string
  capabilities: CapabilityRegistry
  tools: ToolRegistry
  conversation: Array<{ role: 'user' | 'assistant' | 'tool'; content: string; toolCallId?: string; name?: string }>
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  name?: string
}

export interface AgentResult {
  content: string
  toolCalls?: { name: string; input: Record<string, any> }[]
}

export interface Agent {
  manifest: AgentManifest
  getSystemPrompt(ctx: AgentContext): string
  handleResult?(ctx: AgentContext, result: AgentResult): Promise<void>
}
