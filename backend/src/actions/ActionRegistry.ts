import type { Action, ActionMeta } from './Action.js'

export class ActionRegistry {
  private actions = new Map<string, Action>()

  register(action: Action): void {
    if (this.actions.has(action.id)) {
      throw new Error(`Action already registered: ${action.id}`)
    }
    this.actions.set(action.id, action)
  }

  get(id: string): Action | undefined {
    return this.actions.get(id)
  }

  getAll(): ActionMeta[] {
    return Array.from(this.actions.values()).map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      inputSchema: a.inputSchema,
      permissions: a.permissions,
    }))
  }
}
