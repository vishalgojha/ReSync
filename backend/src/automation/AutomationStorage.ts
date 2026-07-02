import crypto from 'crypto'
import type Database from 'better-sqlite3'
import type { AutomationConfig, ExecutionRecord, LogEntry } from './types.js'

export class AutomationStorage {
  constructor(private db: Database.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS automations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        trigger_config TEXT NOT NULL,
        conditions TEXT NOT NULL DEFAULT '[]',
        actions TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_automations_workspace ON automations(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_automations_trigger ON automations(trigger_config);

      CREATE TABLE IF NOT EXISTS automation_executions (
        id TEXT PRIMARY KEY,
        automation_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        trigger_event TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        started_at INTEGER NOT NULL DEFAULT (unixepoch()),
        completed_at INTEGER,
        error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_exec_automation ON automation_executions(automation_id);
      CREATE INDEX IF NOT EXISTS idx_exec_workspace ON automation_executions(workspace_id);

      CREATE TABLE IF NOT EXISTS automation_logs (
        id TEXT PRIMARY KEY,
        execution_id TEXT NOT NULL,
        step INTEGER NOT NULL,
        type TEXT NOT NULL,
        action_id TEXT,
        status TEXT NOT NULL,
        message TEXT,
        data TEXT,
        timestamp INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_logs_exec ON automation_logs(execution_id);
    `)
  }

  list(workspaceId: string): AutomationConfig[] {
    const rows = this.db.prepare('SELECT * FROM automations WHERE workspace_id = ? ORDER BY created_at DESC').all(workspaceId) as any[]
    return rows.map(this.rowToConfig)
  }

  getById(id: string): AutomationConfig | null {
    const row = this.db.prepare('SELECT * FROM automations WHERE id = ?').get(id) as any
    return row ? this.rowToConfig(row) : null
  }

  getByTriggerEvent(event: string, workspaceId: string): AutomationConfig[] {
    const rows = this.db.prepare(
      `SELECT * FROM automations WHERE workspace_id = ? AND enabled = 1 AND trigger_config LIKE ?`
    ).all(workspaceId, `%"event":"${event}"%`) as any[]
    return rows.map(this.rowToConfig)
  }

  create(input: Omit<AutomationConfig, 'id' | 'createdAt' | 'updatedAt'>): AutomationConfig {
    const id = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)
    this.db.prepare(`
      INSERT INTO automations (id, workspace_id, name, description, enabled, trigger_config, conditions, actions, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, input.workspaceId, input.name, input.description || '', input.enabled ? 1 : 0,
      JSON.stringify(input.trigger),
      JSON.stringify(input.conditions),
      JSON.stringify(input.actions),
      now, now,
    )
    return this.getById(id)!
  }

  update(id: string, input: Partial<Omit<AutomationConfig, 'id' | 'createdAt'>>): AutomationConfig | null {
    const existing = this.getById(id)
    if (!existing) return null
    const now = Math.floor(Date.now() / 1000)
    this.db.prepare(`
      UPDATE automations SET
        name = ?, description = ?, enabled = ?,
        trigger_config = ?, conditions = ?, actions = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      input.name ?? existing.name,
      input.description ?? existing.description,
      input.enabled !== undefined ? (input.enabled ? 1 : 0) : (existing.enabled ? 1 : 0),
      input.trigger ? JSON.stringify(input.trigger) : JSON.stringify(existing.trigger),
      input.conditions ? JSON.stringify(input.conditions) : JSON.stringify(existing.conditions),
      input.actions ? JSON.stringify(input.actions) : JSON.stringify(existing.actions),
      now, id,
    )
    return this.getById(id)
  }

  setEnabled(id: string, enabled: boolean): void {
    this.db.prepare('UPDATE automations SET enabled = ?, updated_at = unixepoch() WHERE id = ?').run(enabled ? 1 : 0, id)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM automations WHERE id = ?').run(id)
  }

  createExecution(exec: Omit<ExecutionRecord, 'startedAt'>): ExecutionRecord {
    const startedAt = Math.floor(Date.now() / 1000)
    this.db.prepare(`
      INSERT INTO automation_executions (id, automation_id, workspace_id, trigger_event, status, started_at, completed_at, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(exec.id, exec.automationId, exec.workspaceId, exec.triggerEvent, exec.status, startedAt, exec.completedAt ?? null, exec.error ?? null)
    return { ...exec, startedAt }
  }

  updateExecution(id: string, update: Partial<Pick<ExecutionRecord, 'status' | 'completedAt' | 'error'>>): void {
    this.db.prepare(`
      UPDATE automation_executions SET status = ?, completed_at = ?, error = ? WHERE id = ?
    `).run(update.status ?? 'completed', update.completedAt ?? Math.floor(Date.now() / 1000), update.error ?? null, id)
  }

  getExecutions(automationId: string, limit = 20): ExecutionRecord[] {
    return this.db.prepare('SELECT * FROM automation_executions WHERE automation_id = ? ORDER BY started_at DESC LIMIT ?').all(automationId, limit) as any[]
  }

  getAllExecutions(workspaceId: string, limit = 50): ExecutionRecord[] {
    return this.db.prepare('SELECT * FROM automation_executions WHERE workspace_id = ? ORDER BY started_at DESC LIMIT ?').all(workspaceId, limit) as any[]
  }

  appendLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
    const id = crypto.randomUUID()
    const timestamp = Math.floor(Date.now() / 1000)
    this.db.prepare(`
      INSERT INTO automation_logs (id, execution_id, step, type, action_id, status, message, data, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, entry.executionId, entry.step, entry.type, entry.actionId ?? null, entry.status, entry.message ?? null, entry.data ? JSON.stringify(entry.data) : null, timestamp)
  }

  getLogs(executionId: string): LogEntry[] {
    return this.db.prepare('SELECT * FROM automation_logs WHERE execution_id = ? ORDER BY step ASC').all(executionId) as any[]
  }

  toYaml(config: AutomationConfig): string {
    const lines: string[] = []
    lines.push(`id: ${config.id}`)
    if (config.name) lines.push(`name: ${config.name}`)
    lines.push('')
    lines.push('trigger:')
    lines.push(`  event: ${config.trigger.event}`)
    if (config.trigger.filter && Object.keys(config.trigger.filter).length) {
      lines.push('  filter:')
      for (const [k, v] of Object.entries(config.trigger.filter)) {
        lines.push(`    ${k}: ${JSON.stringify(v)}`)
      }
    }
    if (config.conditions.length) {
      lines.push('')
      lines.push('conditions:')
      for (const c of config.conditions) {
        lines.push(`  - type: ${c.type}`)
        if (c.params && Object.keys(c.params).length) {
          lines.push('    params:')
          for (const [k, v] of Object.entries(c.params)) {
            lines.push(`      ${k}: ${JSON.stringify(v)}`)
          }
        }
      }
    }
    lines.push('')
    lines.push('actions:')
    for (const a of config.actions) {
      lines.push(`  - actionId: ${a.actionId}`)
      if (a.params && Object.keys(a.params).length) {
        lines.push('    params:')
        for (const [k, v] of Object.entries(a.params)) {
          lines.push(`      ${k}: ${JSON.stringify(v)}`)
        }
      }
      if (a.continueOnError) {
        lines.push(`    continueOnError: true`)
      }
    }
    return lines.join('\n')
  }

  fromYaml(yaml: string): Omit<AutomationConfig, 'id' | 'createdAt' | 'updatedAt'> {
    const lines = yaml.split('\n').map(l => l.trimEnd())
    let current: 'root' | 'trigger' | 'condition' | 'action' = 'root'
    let currentCondition: any = null
    let currentAction: any = null
    let conditions: any[] = []
    let actions: any[] = []
    let trigger: any = { event: '' }
    let name = ''
    let description = ''

    for (const line of lines) {
      if (line.startsWith('name:')) { name = line.slice(5).trim(); continue }
      if (line.startsWith('description:')) { description = line.slice(11).trim(); continue }
      if (line.startsWith('id:')) continue
      if (line === 'trigger:') { current = 'trigger'; continue }
      if (line === 'conditions:') { current = 'condition'; continue }
      if (line === 'actions:') { current = 'action'; continue }

      if (current === 'trigger' && line.startsWith('  event:')) {
        trigger.event = line.slice(8).trim()
      }
      if (current === 'trigger' && line.startsWith('  filter:')) {
        current = 'root'
      }

      if (current === 'condition') {
        if (line.startsWith('  - type:')) {
          if (currentCondition) conditions.push(currentCondition)
          currentCondition = { type: line.slice(9).trim(), params: {} }
        } else if (line.startsWith('    params:') && currentCondition) {
          // next lines are key: value pairs
        } else if (line.startsWith('      ') && currentCondition) {
          const colon = line.indexOf(':')
          if (colon > -1) {
            const k = line.slice(6, colon).trim()
            const v = line.slice(colon + 1).trim()
            try { currentCondition.params[k] = JSON.parse(v) } catch { currentCondition.params[k] = v }
          }
        }
      }

      if (current === 'action') {
        if (line.startsWith('  - actionId:')) {
          if (currentAction) actions.push(currentAction)
          currentAction = { actionId: line.slice(13).trim(), params: {}, continueOnError: false }
        } else if (line.startsWith('    params:') && currentAction) {
        } else if (line.startsWith('      ') && currentAction) {
          const colon = line.indexOf(':')
          if (colon > -1) {
            const k = line.slice(6, colon).trim()
            const v = line.slice(colon + 1).trim()
            try { currentAction.params[k] = JSON.parse(v) } catch { currentAction.params[k] = v }
          }
        } else if (line.startsWith('    continueOnError:') && currentAction) {
          currentAction.continueOnError = line.slice(19).trim() === 'true'
        }
      }
    }

    if (currentCondition) conditions.push(currentCondition)
    if (currentAction) actions.push(currentAction)

    return {
      workspaceId: 'default',
      name,
      description,
      enabled: true,
      trigger,
      conditions,
      actions,
    }
  }

  private rowToConfig(row: any): AutomationConfig {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      description: row.description || '',
      enabled: row.enabled === 1,
      trigger: JSON.parse(row.trigger_config),
      conditions: JSON.parse(row.conditions || '[]'),
      actions: JSON.parse(row.actions || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }
}
