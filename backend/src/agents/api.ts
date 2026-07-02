import type { Router } from 'express'
import type { CapabilityRegistry } from '../core/plugin.js'
import type { ActionRunner } from '../actions/ActionRunner.js'
import type { ActionContext } from '../actions/Action.js'
import { ToolRegistry } from './ToolRegistry.js'
import { runAgent } from './AgentRunner.js'
import { buildAgentContext } from './ContextBuilder.js'
import ConversationAssistant from './agents/ConversationAssistant.js'
import type { Agent } from './Agent.js'
import { Boom } from '@hapi/boom'

const AGENTS: Agent[] = [ConversationAssistant]

export function createAgentRouter(
  router: Router,
  capabilities: CapabilityRegistry,
  runner: ActionRunner,
  buildActionContext: (wid: string) => ActionContext,
) {
  router.get('/agents', (_req, res) => {
    res.json({ agents: AGENTS.map(a => a.manifest) })
  })

  router.get('/agents/:agentId', (req, res) => {
    const agent = AGENTS.find(a => a.manifest.id === req.params.agentId)
    if (!agent) throw new Boom('Agent not found', { statusCode: 404 })
    res.json({ agent: agent.manifest })
  })

  router.post('/agents/:agentId/chat', async (req, res) => {
    const agent = AGENTS.find(a => a.manifest.id === req.params.agentId)
    if (!agent) throw new Boom('Agent not found', { statusCode: 404 })

    const workspaceId = (req.query.workspaceId as string) || 'default'
    const chatId = req.body.chatId as string | undefined
    const message = req.body.message as string | undefined
    if (!message) throw new Boom('Missing message', { statusCode: 400 })

    const ai = capabilities.get<any>('ai')
    if (!ai) throw new Boom('AI capability not available — configure AI provider in Settings', { statusCode: 400 })

    const actionCtx = buildActionContext(workspaceId)
    const tools = ToolRegistry.createDefault(capabilities, runner, () => actionCtx)
    const agentCtx = {
      workspaceId,
      chatId,
      capabilities,
      tools,
      conversation: [],
    }

    try {
      const result = await runAgent(agent, message, agentCtx, tools, ai)

      if ('handleResult' in agent && agent.handleResult) {
        await agent.handleResult(agentCtx, result)
      }

      res.json({
        status: 'ok',
        reply: result.content,
        toolCalls: result.messages
          .filter((m: any) => m.role === 'tool' && m.name)
          .map((m: any) => ({ name: m.name, result: m.content })),
      })
    } catch (err: any) {
      res.json({ status: 'error', error: err.message })
    }
  })

  return router
}
