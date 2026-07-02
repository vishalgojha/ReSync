import type { Router } from 'express'
import { Boom } from '@hapi/boom'
import type { KnowledgeGraphCapability } from './KnowledgeGraphCapability.js'

export function createGraphRouter(router: Router, graph: KnowledgeGraphCapability) {
  // Get graph for a conversation
  router.get('/graph/conversation/:chatId', (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || 'default'
    const chatId = req.params.chatId
    if (!chatId) throw new Boom('Missing chatId', { statusCode: 400 })

    const data = graph.getChatGraph(workspaceId, chatId)
    res.json(data)
  })

  // Find entities by search query
  router.get('/graph/search', (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || 'default'
    const query = (req.query.q as string) || ''
    if (!query.trim()) throw new Boom('Missing query', { statusCode: 400 })

    const nodes = graph.findEntity(workspaceId, query)
    res.json({ nodes })
  })

  // Get entities by type
  router.get('/graph/type/:type', (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || 'default'
    const type = req.params.type

    const nodes = graph.findByType(workspaceId, type)
    res.json({ nodes })
  })

  // Get a specific node
  router.get('/graph/node/:nodeId', (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || 'default'
    const nodeId = req.params.nodeId
    if (!nodeId) throw new Boom('Missing nodeId', { statusCode: 400 })

    const node = graph.getNode(workspaceId, nodeId)
    if (!node) {
      res.status(404).json({ error: 'Node not found' })
      return
    }

    const related = graph.getRelated(workspaceId, nodeId)
    res.json({ node, related })
  })

  // Get all entity type stats
  router.get('/graph/stats', (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || 'default'

    const types = graph.getEntityTypes(workspaceId)
    const totalNodes = types.reduce((sum, t) => sum + t.count, 0)
    res.json({ types, totalNodes })
  })

  return router
}
