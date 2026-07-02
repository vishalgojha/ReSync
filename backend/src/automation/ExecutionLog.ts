import type { AutomationStorage } from './AutomationStorage.js'
import type { LogEntry } from './types.js'

export class ExecutionLog {
  constructor(private storage: AutomationStorage) {}

  getExecutions(automationId: string, limit = 20) {
    return this.storage.getExecutions(automationId, limit)
  }

  getAllExecutions(workspaceId: string, limit = 50) {
    return this.storage.getAllExecutions(workspaceId, limit)
  }

  getLogs(executionId: string): LogEntry[] {
    return this.storage.getLogs(executionId)
  }
}
