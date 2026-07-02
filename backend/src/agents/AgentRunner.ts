import type { Agent, AgentContext, AgentMessage } from './Agent.js'
import type { ToolRegistry } from './ToolRegistry.js'
import type { CapabilityRegistry } from '../core/plugin.js'

export interface RunnerOptions {
  maxIterations?: number
  model?: string
}

function extractToolCalls(content: string): Array<{ name: string; input: Record<string, any>; raw: string }> {
  const calls: Array<{ name: string; input: Record<string, any>; raw: string }> = []
  const regex = /```tool_call\n([\s\S]*?)```/g
  let match

  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (parsed.name && parsed.input) {
        calls.push({ ...parsed, raw: match[1].trim() })
      }
    } catch {}
  }

  return calls
}

export async function runAgent(
  agent: Agent,
  userMessage: string,
  ctx: AgentContext,
  tools: ToolRegistry,
  ai: any,
  options: RunnerOptions = {},
): Promise<{ content: string; messages: AgentMessage[] }> {
  const maxIter = options.maxIterations || 8
  const messages: AgentMessage[] = []
  const toolDefs = tools.getDefinitions()

  const systemPrompt = agent.getSystemPrompt(ctx)

  const toolDescriptions = toolDefs.map(t => {
    const props = t.parameters?.properties || {}
    const paramList = Object.entries(props).map(([k, v]: any) => `  - ${k} (${v.type || 'any'}): ${v.description || ''}`).join('\n')
    return `${t.name}: ${t.description}\nParameters:\n${paramList || '  none'}`
  }).join('\n\n')

  const fullSystemPrompt = `${systemPrompt}

You have access to the following tools. To call a tool, respond with:

\`\`\`tool_call
{ "name": "tool_name", "input": { "param1": "value1" } }
\`\`\`

Available tools:
${toolDescriptions}

If a tool call succeeds, you'll receive the result. Use it to decide the next action or provide a final answer. When you're done, provide a natural language response to the user. Do not explain that you're calling a tool — just output the tool_call block when needed.`

  messages.push({ role: 'user', content: userMessage })

  for (let i = 0; i < maxIter; i++) {
    const history: any[] = [
      { role: 'system', content: fullSystemPrompt },
      ...messages.map(m => {
        if (m.role === 'tool') {
          return { role: 'tool', content: m.content, tool_call_id: m.toolCallId || '' }
        }
        return { role: m.role, content: m.content }
      }),
    ]

    let reply: string
    try {
      reply = await ai.chat(history, { model: options.model })
    } catch (err: any) {
      messages.push({ role: 'assistant', content: `Error calling AI: ${err.message}` })
      break
    }

    messages.push({ role: 'assistant', content: reply })

    const toolCalls = extractToolCalls(reply)
    if (toolCalls.length === 0) {
      break
    }

    for (const call of toolCalls) {
      const tool = tools.get(call.name)
      if (!tool) {
        messages.push({ role: 'tool', content: `Unknown tool: ${call.name}`, toolCallId: call.name, name: call.name })
        continue
      }

      try {
        const result = await tool.execute(call.input)
        messages.push({
          role: 'tool',
          content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          toolCallId: call.name,
          name: call.name,
        })
      } catch (err: any) {
        messages.push({
          role: 'tool',
          content: `Error: ${err.message}`,
          toolCallId: call.name,
          name: call.name,
        })
      }
    }
  }

  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
  return {
    content: lastAssistant?.content || 'No response generated.',
    messages,
  }
}
