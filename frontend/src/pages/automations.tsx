import { useEffect, useState, useCallback } from 'react'
import { API_BASE } from '../config'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { EmptyState } from '../components/ui/empty-state'
import { Dialog } from '../components/ui/dialog'
import { Separator } from '../components/ui/separator'
import { Skeleton } from '../components/ui/skeleton'
import { useToast } from '../components/ui/toast'
import { Zap, Plus, Play, Download, Upload, Trash2, Edit3, Clock } from 'lucide-react'
import Sidebar from '../components/layout/sidebar'

interface Automation {
  id: string
  name: string
  description: string
  enabled: boolean
  trigger: { event: string; filter?: Record<string, unknown> }
  conditions: Array<{ type: string; params: Record<string, unknown> }>
  actions: Array<{ actionId: string; params: Record<string, unknown>; continueOnError?: boolean }>
  createdAt: number
}

interface Execution {
  id: string
  automationId: string
  status: string
  triggerEvent: string
  startedAt: number
  completedAt: number | null
  error: string | null
}

interface LogEntry {
  id: string
  step: number
  type: string
  actionId: string | null
  status: string
  message: string | null
  data: unknown
  timestamp: number
}

interface AvailableAction {
  id: string
  name: string
  description: string
}

interface FormState {
  name: string
  description: string
  triggerEvent: string
  conditions: Array<{ type: string; params: string }>
  actions: Array<{ actionId: string; params: string; continueOnError: boolean }>
}

const TRIGGER_LABELS: Record<string, string> = {
  'message.received': 'Message Received',
  'message.sent': 'Message Sent',
  'message.updated': 'Message Updated',
  'chat.created': 'Chat Created',
  'chat.updated': 'Chat Updated',
  'contact.created': 'Contact Created',
  'contact.updated': 'Contact Updated',
  'action.completed': 'Action Completed',
  'action.failed': 'Action Failed',
}

const STATUS_COLORS: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  completed: 'success',
  failed: 'danger',
  running: 'warning',
  partial: 'warning',
}

function safeParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s) } catch { return {} }
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [availableTriggers, setAvailableTriggers] = useState<string[]>([])
  const [availableConditions, setAvailableConditions] = useState<string[]>([])
  const [availableActions, setAvailableActions] = useState<AvailableAction[]>([])
  const [showEditor, setShowEditor] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [executions, setExecutions] = useState<Record<string, Execution[]>>({})
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({})
  const [showExecutions, setShowExecutions] = useState<string | null>(null)
  const [importYaml, setImportYaml] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)
  const [form, setForm] = useState<FormState>({
    name: '',
    description: '',
    triggerEvent: 'message.received',
    conditions: [],
    actions: [],
  })
  const { addToast } = useToast()

  const load = useCallback(() => {
    setFetching(true)
    Promise.all([
      fetch(`${API_BASE}/api/automations`).then(r => r.json()),
      fetch(`${API_BASE}/api/automations/triggers`).then(r => r.json()),
      fetch(`${API_BASE}/api/automations/conditions`).then(r => r.json()),
      fetch(`${API_BASE}/api/automations/actions`).then(r => r.json()),
    ])
      .then(([autoData, triggerData, condData, actionData]) => {
        setAutomations(autoData.automations || [])
        setAvailableTriggers(triggerData.triggers || [])
        setAvailableConditions(condData.conditions || [])
        setAvailableActions(actionData.actions || [])
      })
      .catch(() => {
        addToast({ message: 'Failed to load automations', type: 'danger' })
      })
      .finally(() => setFetching(false))
  }, [addToast])

  useEffect(() => { load() }, [load])

  const toggleEnabled = async (id: string, enabled: boolean) => {
    await fetch(`${API_BASE}/api/automations/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    load()
  }

  const deleteAuto = async (id: string) => {
    await fetch(`${API_BASE}/api/automations/${id}`, { method: 'DELETE' })
    setDeleteConfirm(null)
    addToast({ message: 'Automation deleted', type: 'success' })
    load()
  }

  const runNow = async (id: string) => {
    await fetch(`${API_BASE}/api/automations/${id}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggerData: { manual: true } }),
    })
    addToast({ message: 'Automation triggered', type: 'success' })
    loadExecutions(id)
  }

  const loadExecutions = async (id: string) => {
    const r = await fetch(`${API_BASE}/api/automations/executions?automationId=${id}`)
    const d = await r.json()
    setExecutions(prev => ({ ...prev, [id]: d.executions || [] }))
  }

  const loadLogs = async (executionId: string) => {
    if (logs[executionId]) {
      setShowExecutions(showExecutions === executionId ? null : executionId)
      return
    }
    const r = await fetch(`${API_BASE}/api/automations/executions/${executionId}/logs`)
    const d = await r.json()
    setLogs(prev => ({ ...prev, [executionId]: d.logs || [] }))
    setShowExecutions(executionId)
  }

  const toggleExecutions = (id: string) => {
    if (showExecutions === id) { setShowExecutions(null); return }
    loadExecutions(id)
    setShowExecutions(id)
  }

  const exportYaml = async (id: string) => {
    const r = await fetch(`${API_BASE}/api/automations/${id}/export`)
    const yaml = await r.text()
    const blob = new Blob([yaml], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `automation-${id.slice(0, 8)}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async () => {
    await fetch(`${API_BASE}/api/automations/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml: importYaml }),
    })
    setShowImport(false)
    setImportYaml('')
    addToast({ message: 'Automation imported', type: 'success' })
    load()
  }

  const startEdit = (auto?: Automation) => {
    if (auto) {
      setEditingId(auto.id)
      setForm({
        name: auto.name,
        description: auto.description,
        triggerEvent: auto.trigger.event,
        conditions: auto.conditions.map(c => ({ type: c.type, params: JSON.stringify(c.params) })),
        actions: auto.actions.map(a => ({
          actionId: a.actionId,
          params: JSON.stringify(a.params),
          continueOnError: a.continueOnError || false,
        })),
      })
    } else {
      setEditingId(null)
      setForm({ name: '', description: '', triggerEvent: 'message.received', conditions: [], actions: [] })
    }
    setShowEditor(true)
  }

  const saveForm = async () => {
    const body = {
      name: form.name,
      description: form.description,
      trigger: { event: form.triggerEvent },
      conditions: form.conditions.map(c => ({ type: c.type, params: safeParse(c.params) })),
      actions: form.actions.map(a => ({
        actionId: a.actionId,
        params: safeParse(a.params),
        continueOnError: a.continueOnError,
      })),
    }
    if (editingId) {
      await fetch(`${API_BASE}/api/automations/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } else {
      await fetch(`${API_BASE}/api/automations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }
    setShowEditor(false)
    addToast({ message: editingId ? 'Automation updated' : 'Automation created', type: 'success' })
    load()
  }

  if (showEditor) {
    return (
      <div className="flex h-screen bg-bg-primary">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-secondary flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setShowEditor(false)}>
              <Edit3 className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-semibold text-text-primary">
              {editingId ? 'Edit Automation' : 'New Automation'}
            </h1>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl space-y-5">
              <div>
                <label className="text-sm text-text-secondary block mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="flex h-9 w-full rounded-[var(--radius-md)] border border-border bg-bg-secondary px-3 py-1 text-sm text-text-primary shadow-sm transition-colors placeholder:text-text-muted focus-visible:border-border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-ring"
                  placeholder="Automation name"
                />
              </div>
              <div>
                <label className="text-sm text-text-secondary block mb-1">Description</label>
                <input
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="flex h-9 w-full rounded-[var(--radius-md)] border border-border bg-bg-secondary px-3 py-1 text-sm text-text-primary shadow-sm transition-colors placeholder:text-text-muted focus-visible:border-border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-ring"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="text-sm text-text-secondary block mb-2">Trigger</label>
                <select
                  value={form.triggerEvent}
                  onChange={e => setForm({ ...form, triggerEvent: e.target.value })}
                  className="flex h-9 w-full rounded-[var(--radius-md)] border border-border bg-bg-secondary px-3 py-1 text-sm text-text-primary shadow-sm transition-colors focus-visible:border-border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-ring"
                >
                  {availableTriggers.map(t => (
                    <option key={t} value={t}>{TRIGGER_LABELS[t] || t}</option>
                  ))}
                </select>
              </div>
              <Separator />
              <div>
                <label className="text-sm text-text-secondary block mb-2">Conditions</label>
                {form.conditions.map((c, i) => (
                  <div key={i} className="flex gap-2 mb-2 items-start">
                    <select
                      value={c.type}
                      onChange={e => {
                        const upd = [...form.conditions]
                        upd[i] = { ...upd[i], type: e.target.value }
                        setForm({ ...form, conditions: upd })
                      }}
                      className="flex h-9 rounded-[var(--radius-md)] border border-border bg-bg-secondary px-3 py-1 text-sm text-text-primary shadow-sm transition-colors focus-visible:border-border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-ring flex-1"
                    >
                      {availableConditions.map(ac => (
                        <option key={ac} value={ac}>{ac}</option>
                      ))}
                    </select>
                    <input
                      value={c.params}
                      onChange={e => {
                        const upd = [...form.conditions]
                        upd[i] = { ...upd[i], params: e.target.value }
                        setForm({ ...form, conditions: upd })
                      }}
                      placeholder='{"text":"hello"}'
                      className="flex h-9 rounded-[var(--radius-md)] border border-border bg-bg-secondary px-3 py-1 text-sm text-text-primary shadow-sm transition-colors placeholder:text-text-muted focus-visible:border-border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-ring flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setForm({ ...form, conditions: form.conditions.filter((_, j) => j !== i) })}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setForm({
                    ...form,
                    conditions: [...form.conditions, { type: availableConditions[0] || 'containsText', params: '{}' }],
                  })}
                >
                  + Add Condition
                </Button>
              </div>
              <Separator />
              <div>
                <label className="text-sm text-text-secondary block mb-2">Actions</label>
                {form.actions.map((a, i) => (
                  <div key={i} className="flex gap-2 mb-2 items-start">
                    <select
                      value={a.actionId}
                      onChange={e => {
                        const upd = [...form.actions]
                        upd[i] = { ...upd[i], actionId: e.target.value }
                        setForm({ ...form, actions: upd })
                      }}
                      className="flex h-9 rounded-[var(--radius-md)] border border-border bg-bg-secondary px-3 py-1 text-sm text-text-primary shadow-sm transition-colors focus-visible:border-border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-ring flex-1"
                    >
                      {availableActions.map(aa => (
                        <option key={aa.id} value={aa.id}>{aa.name}</option>
                      ))}
                    </select>
                    <input
                      value={a.params}
                      onChange={e => {
                        const upd = [...form.actions]
                        upd[i] = { ...upd[i], params: e.target.value }
                        setForm({ ...form, actions: upd })
                      }}
                      placeholder='{"text":"Hi"}'
                      className="flex h-9 rounded-[var(--radius-md)] border border-border bg-bg-secondary px-3 py-1 text-sm text-text-primary shadow-sm transition-colors placeholder:text-text-muted focus-visible:border-border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-ring flex-[2]"
                    />
                    <label className="flex items-center gap-1 text-xs text-text-muted shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={a.continueOnError}
                        onChange={e => {
                          const upd = [...form.actions]
                          upd[i] = { ...upd[i], continueOnError: e.target.checked }
                          setForm({ ...form, actions: upd })
                        }}
                        className="accent-accent"
                      />
                      continue
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setForm({ ...form, actions: form.actions.filter((_, j) => j !== i) })}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setForm({
                    ...form,
                    actions: [...form.actions, {
                      actionId: availableActions[0]?.id || 'sendMessage',
                      params: '{}',
                      continueOnError: false,
                    }],
                  })}
                >
                  + Add Action
                </Button>
              </div>
              <Separator />
              <Button onClick={saveForm} disabled={!form.name}>
                {editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-bg-primary">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-secondary flex-shrink-0">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-text-primary" />
            <h1 className="text-lg font-semibold text-text-primary">Automations</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button size="sm" onClick={() => startEdit()}>
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>
        </div>

        {showImport && (
          <div className="border-b border-border p-4 space-y-2 bg-bg-secondary">
            <textarea
              value={importYaml}
              onChange={e => setImportYaml(e.target.value)}
              className="w-full h-32 rounded-[var(--radius-md)] border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-muted focus-visible:border-border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-ring"
              placeholder="Paste YAML..."
            />
            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={!importYaml.trim()} size="sm">
                Import
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowImport(false); setImportYaml('') }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {fetching ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="rounded-[var(--radius-lg)] border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-5 w-10 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-64" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-[var(--radius-sm)]" />
                    <Skeleton className="h-5 w-16 rounded-[var(--radius-sm)]" />
                  </div>
                </div>
              ))}
            </div>
          ) : automations.length === 0 ? (
            <EmptyState
              icon={<Zap className="h-8 w-8" />}
              title="No automations yet"
              description="Create one to automate your WhatsApp workflows."
              action={{
                label: 'Create Automation',
                onClick: () => startEdit(),
              }}
            />
          ) : (
            automations.map(auto => (
              <div
                key={auto.id}
                className="rounded-[var(--radius-lg)] border border-border bg-bg-secondary p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-text-primary font-medium text-sm">{auto.name || 'Unnamed'}</h3>
                      <Badge variant="default">
                        {TRIGGER_LABELS[auto.trigger.event] || auto.trigger.event}
                      </Badge>
                    </div>
                    {auto.description && (
                      <p className="text-text-muted text-xs mt-0.5">{auto.description}</p>
                    )}
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                    <input
                      type="checkbox"
                      checked={auto.enabled}
                      onChange={e => toggleEnabled(auto.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-bg-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent" />
                  </label>
                </div>

                {auto.conditions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {auto.conditions.map((c, i) => (
                      <Badge key={i} variant="default">{c.type}</Badge>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex flex-wrap gap-1">
                  {auto.actions.map((a, i) => (
                    <Badge key={i} variant="info">{a.actionId}</Badge>
                  ))}
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(auto)}>
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => runNow(auto.id)}>
                    <Play className="h-3.5 w-3.5" />
                    Run Now
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleExecutions(auto.id)}>
                    <Clock className="h-3.5 w-3.5" />
                    History
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => exportYaml(auto.id)}>
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm(auto.id)}
                    className="text-danger hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>

                {showExecutions === auto.id && executions[auto.id] && (
                  <div className="mt-3 border-t border-border pt-3 space-y-1">
                    {executions[auto.id]!.map(ex => (
                      <div key={ex.id} className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={STATUS_COLORS[ex.status] || 'default'} className="capitalize">
                            {ex.status}
                          </Badge>
                          <span className="text-text-muted">{ex.triggerEvent}</span>
                          <span className="text-text-muted">
                            {new Date(ex.startedAt * 1000).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {ex.error && (
                            <span className="text-danger max-w-[200px] truncate">{ex.error}</span>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => loadLogs(ex.id)}>
                            Logs
                          </Button>
                        </div>
                      </div>
                    ))}
                    {logs[showExecutions!] && (
                      <div className="mt-2 bg-bg-primary rounded-[var(--radius-md)] p-2 space-y-1 max-h-40 overflow-y-auto">
                        {logs[showExecutions!]!.map(log => (
                          <div key={log.id} className="flex items-center gap-2 text-xs">
                            <Badge
                              variant={log.status === 'success' ? 'success' : 'danger'}
                              className="w-12 shrink-0 justify-center"
                            >
                              {log.status}
                            </Badge>
                            <span className="text-text-muted w-12 shrink-0">{log.type}</span>
                            {log.actionId && (
                              <span className="text-text-primary">{log.actionId}</span>
                            )}
                            {log.message && (
                              <span className="text-text-muted truncate">{log.message}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <Dialog
          open={!!deleteConfirm}
          onOpenChange={() => setDeleteConfirm(null)}
          title="Delete Automation"
          description="Are you sure you want to delete this automation? This action cannot be undone."
        >
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteConfirm && deleteAuto(deleteConfirm)}
            >
              Delete
            </Button>
          </div>
        </Dialog>
      </div>
    </div>
  )
}
