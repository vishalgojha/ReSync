import express from 'express'
import { Boom } from '@hapi/boom'
import type { EngineDeps } from './types.js'
import { ExecutionLog } from './ExecutionLog.js'

export function createAutomationRouter(deps: EngineDeps): express.Router {
  const router = express.Router()

  router.get('/', (_req, res) => {
    const wid = (_req.query.workspaceId as string) || 'default'
    const list = deps.storage.list(wid)
    res.json({ automations: list })
  })

  router.get('/actions', (_req, res) => {
    res.json({ actions: deps.actionRegistry.getAll() })
  })

  router.get('/triggers', (_req, res) => {
    const triggers = deps.capabilities.get<any>('automation.triggers')?.getAll() || []
    res.json({ triggers })
  })

  router.get('/conditions', (_req, res) => {
    const conditions = deps.capabilities.get<any>('automation.conditions')?.getAll() || []
    res.json({ conditions })
  })

  router.get('/executions', (req, res) => {
    const wid = (req.query.workspaceId as string) || 'default'
    const automationId = req.query.automationId as string
    const log = new ExecutionLog(deps.storage)
    const executions = automationId ? log.getExecutions(automationId) : log.getAllExecutions(wid)
    res.json({ executions })
  })

  router.get('/executions/:id/logs', (req, res) => {
    const log = new ExecutionLog(deps.storage)
    const logs = log.getLogs(req.params.id)
    res.json({ logs })
  })

  router.get('/:id', (req, res) => {
    const auto = deps.storage.getById(req.params.id)
    if (!auto) throw new Boom('Not found', { statusCode: 404 })
    res.json({ automation: auto })
  })

  router.get('/:id/export', (req, res) => {
    const auto = deps.storage.getById(req.params.id)
    if (!auto) throw new Boom('Not found', { statusCode: 404 })
    const yaml = deps.storage.toYaml(auto)
    res.setHeader('Content-Type', 'text/yaml')
    res.setHeader('Content-Disposition', `attachment; filename="${auto.name || auto.id}.yaml"`)
    res.send(yaml)
  })

  router.post('/', (req, res) => {
    const wid = (req.query.workspaceId as string) || 'default'
    const { name, description, trigger, conditions, actions, enabled } = req.body
    if (!name || !trigger?.event) throw new Boom('name and trigger.event are required', { statusCode: 400 })
    const auto = deps.storage.create({
      workspaceId: wid,
      name,
      description: description || '',
      enabled: enabled !== false,
      trigger,
      conditions: conditions || [],
      actions: actions || [],
    })
    res.json({ automation: auto })
  })

  router.post('/import', (req, res) => {
    const wid = (req.query.workspaceId as string) || 'default'
    const { yaml } = req.body
    if (!yaml) throw new Boom('yaml field is required', { statusCode: 400 })
    const parsed = deps.storage.fromYaml(yaml)
    const auto = deps.storage.create({
      ...parsed,
      workspaceId: wid,
      name: parsed.name || 'Imported Automation',
    })
    res.json({ automation: auto })
  })

  router.put('/:id', (req, res) => {
    const { name, description, trigger, conditions, actions, enabled } = req.body
    const auto = deps.storage.update(req.params.id, { name, description, trigger, conditions, actions, enabled })
    if (!auto) throw new Boom('Not found', { statusCode: 404 })
    res.json({ automation: auto })
  })

  router.patch('/:id/toggle', (req, res) => {
    const { enabled } = req.body
    if (enabled === undefined) throw new Boom('enabled field required', { statusCode: 400 })
    deps.storage.setEnabled(req.params.id, enabled)
    res.json({ id: req.params.id, enabled })
  })

  router.post('/:id/run', async (req, res) => {
    const auto = deps.storage.getById(req.params.id)
    if (!auto) throw new Boom('Not found', { statusCode: 404 })
    if (!auto.enabled) throw new Boom('Automation is disabled', { statusCode: 400 })

    const actionCtx = deps.buildActionContext(auto.workspaceId)
    if (!actionCtx.baileys) throw new Boom('Session not ready', { statusCode: 400 })

    const fakeData = req.body.triggerData || {}
    const exec = await deps.runner.execute(auto, actionCtx, 'manual', fakeData)
    res.json({ execution: exec })
  })

  router.delete('/:id', (req, res) => {
    deps.storage.delete(req.params.id)
    res.json({ status: 'deleted' })
  })

  return router
}
