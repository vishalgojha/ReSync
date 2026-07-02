import type { CapabilityRegistry } from '../core/plugin.js'

export interface BuiltContext {
  summary: string
  conversationState: any
  memory: any
  entities: any[]
  timeline: any[]
  graph: any
}

export async function buildAgentContext(workspaceId: string, chatId: string, capabilities: CapabilityRegistry): Promise<BuiltContext> {
  const conv = capabilities.get<any>('conversation')
  const graph = capabilities.get<any>('graph')

  let conversationState = null
  let memory = null
  let timeline: any[] = []
  let entities: any[] = []
  let graphData = null

  if (conv) {
    try {
      conversationState = conv.state(workspaceId, chatId)
      memory = conv.memory(workspaceId, chatId)
      timeline = conv.timeline(workspaceId, chatId, 15)
    } catch {}
  }

  if (graph) {
    try {
      graphData = graph.getChatGraph(workspaceId, chatId)
      entities = graphData?.nodes || []
    } catch {}
  }

  const parts: string[] = []

  if (conversationState) {
    parts.push(`Conversation: ${conversationState.message_count} messages, ${conversationState.media_count} media, ${conversationState.participant_count} participants. Health: ${Math.round(conversationState.health_score * 100)}%.`)
  }

  if (memory) {
    if (memory.facts?.length) {
      parts.push(`Facts: ${memory.facts.map((f: any) => f.value).join('; ')}`)
    }
    if (memory.topics?.length) {
      parts.push(`Recent topics: ${memory.topics.slice(0, 5).map((t: any) => t.topic).join(', ')}`)
    }
    if (memory.contacts?.length) {
      parts.push(`Tracked contacts: ${memory.contacts.map((c: any) => c.value).join(', ')}`)
    }
  }

  if (entities?.length) {
    const byType = new Map<string, string[]>()
    for (const e of entities) {
      const list = byType.get(e.entity_type) || []
      list.push(e.value)
      byType.set(e.entity_type, list)
    }
    const summaries: string[] = []
    for (const [type, vals] of byType) {
      summaries.push(`${type}s (${vals.slice(0, 5).join(', ')})`)
    }
    if (summaries.length) parts.push(`Extracted entities: ${summaries.join('; ')}`)
  }

  return {
    summary: parts.join('\n'),
    conversationState,
    memory,
    entities,
    timeline,
    graph: graphData,
  }
}
