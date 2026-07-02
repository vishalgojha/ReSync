import type { Router } from 'express'
import { getDb } from '../core/db.js'
import { Boom } from '@hapi/boom'
import type { ConversationCapability } from './ConversationCapability.js'

export function createConversationRouter(router: Router, conversation: ConversationCapability) {
  router.get('/conversation/:chatId', (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || 'default'
    const chatId = req.params.chatId
    if (!chatId) throw new Boom('Missing chatId', { statusCode: 400 })

    const summary = conversation.get(workspaceId, chatId)
    if (!summary.state) {
      res.json({
        chatId,
        state: null,
        timeline: [],
        facts: [],
        entities: [],
        contacts: [],
        files: [],
        topics: [],
        participants: [],
      })
      return
    }

    const db = getDb()
    const participants = db.prepare(`
      SELECT DISTINCT sender as jid FROM messages
      WHERE workspace_id = ? AND chat_id = ? AND sender IS NOT NULL
    `).all(workspaceId, chatId) as { jid: string }[]

    const enrichedParticipants = participants.map((p: { jid: string }) => {
      const contact = db.prepare(`
        SELECT name, push_name FROM contacts WHERE jid = ? AND workspace_id = ?
      `).get(p.jid, workspaceId) as { name: string | null, push_name: string | null } | undefined
      return {
        jid: p.jid,
        name: contact?.name || contact?.push_name || p.jid.split('@')[0],
      }
    })

    res.json({
      ...summary,
      participants: enrichedParticipants,
    })
  })

  router.get('/conversation/:chatId/timeline', (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || 'default'
    const chatId = req.params.chatId
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    const timeline = conversation.timeline(workspaceId, chatId, limit, offset)
    res.json({ timeline })
  })

  router.post('/conversation/:chatId/facts', (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || 'default'
    const chatId = req.params.chatId
    const { fact } = req.body
    if (!fact) throw new Boom('Missing fact', { statusCode: 400 })

    conversation.addFact(workspaceId, chatId, fact, 'manual')
    res.json({ success: true })
  })

  router.get('/conversation/:chatId/facts', (req, res) => {
    const workspaceId = (req.query.workspaceId as string) || 'default'
    const chatId = req.params.chatId
    const facts = conversation.getFacts(workspaceId, chatId)
    res.json({ facts })
  })

  return router
}
