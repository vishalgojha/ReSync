import type express from 'express'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { EventDispatcher } from './dispatcher.js'
import { getDb } from './db.js'

export interface PluginManifest {
  id: string
  name: string
  version: string
  author: string
  description: string
  requires?: string[]
  permissions?: string[]
  settingsSchema?: Record<string, any>
}

export interface Plugin {
  manifest: PluginManifest
  register(context: PluginContext): void
  start?(): Promise<void>
  stop?(): Promise<void>
}

export interface PluginContext {
  dispatcher: EventDispatcher
  capabilities: CapabilityRegistry
  database: {
    query: (sql: string, params?: any[]) => any[]
    get: (sql: string, params?: any[]) => any
    run: (sql: string, params?: any[]) => void
    getSetting: (key: string) => string | undefined
    setSetting: (key: string, value: string) => void
    getPluginSetting: (workspaceId: string) => any
    setPluginSetting: (workspaceId: string, settings: any) => void
  }
  logger: {
    info: (msg: string, ...args: any[]) => void
    warn: (msg: string, ...args: any[]) => void
    error: (msg: string, ...args: any[]) => void
  }
  storage: string
  http: {
    get: (path: string, handler: express.RequestHandler) => void
    post: (path: string, handler: express.RequestHandler) => void
    put: (path: string, handler: express.RequestHandler) => void
  }
}

export class CapabilityRegistry {
  private capabilities = new Map<string, any>()

  register<T>(name: string, implementation: T): void {
    this.capabilities.set(name, implementation)
  }

  get<T = any>(name: string): T | undefined {
    return this.capabilities.get(name)
  }

  has(name: string): boolean {
    return this.capabilities.has(name)
  }
}

export class PluginLoader {
  private plugins: Plugin[] = []

  constructor(
    private dispatcher: EventDispatcher,
    private capabilities: CapabilityRegistry,
    private router: express.Router,
    private storageDir: string,
  ) {}

  register(plugin: Plugin): void {
    const id = plugin.manifest.id
    const pluginStorage = path.join(this.storageDir, id)
    fs.mkdirSync(pluginStorage, { recursive: true })

    const db = getDb()

    const database = {
      query: (sql: string, params?: any[]) => db.prepare(sql).all(...(params || [])),
      get: (sql: string, params?: any[]) => db.prepare(sql).get(...(params || [])),
      run: (sql: string, params?: any[]) => { db.prepare(sql).run(...(params || [])) },
      getSetting: (key: string) => {
        const row = db.prepare('SELECT value FROM workspace_settings WHERE workspace_id = ? AND key = ?').get('default', key) as any
        return row?.value
      },
      setSetting: (key: string, value: string) => {
        db.prepare('INSERT OR REPLACE INTO workspace_settings (workspace_id, key, value) VALUES (?, ?, ?)').run('default', key, value)
      },
      getPluginSetting: (workspaceId: string) => {
        const row = db.prepare('SELECT settings FROM workspace_plugin_settings WHERE workspace_id = ? AND plugin_id = ?').get(workspaceId, id) as any
        return row ? JSON.parse(row.settings) : {}
      },
      setPluginSetting: (workspaceId: string, settings: any) => {
        db.prepare('INSERT OR REPLACE INTO workspace_plugin_settings (workspace_id, plugin_id, settings) VALUES (?, ?, ?)').run(workspaceId, id, JSON.stringify(settings))
      },
    }

    const logger = {
      info: (msg: string, ...args: any[]) => console.log(`[${id}] ${msg}`, ...args),
      warn: (msg: string, ...args: any[]) => console.warn(`[${id}] ${msg}`, ...args),
      error: (msg: string, ...args: any[]) => console.error(`[${id}] ${msg}`, ...args),
    }

    const httpCtx = {
      get: (p: string, handler: express.RequestHandler) => this.router.get(`/api/plugins/${id}${p}`, handler),
      post: (p: string, handler: express.RequestHandler) => this.router.post(`/api/plugins/${id}${p}`, handler),
      put: (p: string, handler: express.RequestHandler) => this.router.put(`/api/plugins/${id}${p}`, handler),
    }

    const context: PluginContext = {
      dispatcher: this.dispatcher,
      capabilities: this.capabilities,
      database,
      logger,
      storage: pluginStorage,
      http: httpCtx,
    }

    plugin.register(context)
    this.plugins.push(plugin)
    logger.info('registered')
  }

  async startAll(): Promise<void> {
    for (const p of this.plugins) {
      if (p.start) {
        await p.start()
      }
    }
  }

  async stopAll(): Promise<void> {
    for (const p of this.plugins.reverse()) {
      if (p.stop) {
        await p.stop()
      }
    }
  }
}
