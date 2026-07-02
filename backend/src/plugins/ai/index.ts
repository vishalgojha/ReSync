import type { Plugin, PluginContext } from '../../core/plugin.js'
import express from 'express'

export default {
  manifest: {
    id: 'ai',
    name: 'AI',
    version: '1.0.0',
    author: 'ReSync',
    description: 'AI provider abstraction — OpenAI, Anthropic, Gemini, OpenRouter, Ollama, and any OpenAI-compatible API',
    permissions: ['database'],
    settingsSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['openai', 'anthropic', 'gemini', 'openrouter', 'custom'] },
        apiKey: { type: 'string' },
        model: { type: 'string' },
        baseUrl: { type: 'string' },
      },
    },
  },

  register(context: PluginContext) {
    const db = context.database

    const getConfig = () => ({
      kind: db.getSetting('ai_kind') as any,
      apiKey: db.getSetting('ai_apiKey') ?? '',
      model: db.getSetting('ai_model') ?? '',
      baseUrl: db.getSetting('ai_baseUrl'),
    })

    context.capabilities.register('ai', {
      getConfig,
      async chat(messages: any[], options?: any) {
        const config = getConfig()
        if (!config.kind) throw new Error('AI not configured')
        const { ProviderFactory } = await import('./factory.js')
        const provider = ProviderFactory.create(config)
        return provider.chat(messages, options)
      },
      async embeddings(texts: string[]) {
        const config = getConfig()
        if (!config.kind) throw new Error('AI not configured')
        const { ProviderFactory } = await import('./factory.js')
        const provider = ProviderFactory.create(config)
        return provider.embeddings(texts)
      },
    })

    context.http.get('/settings', (_req: express.Request, res: express.Response) => {
      const kind = db.getSetting('ai_kind')
      const model = db.getSetting('ai_model')
      const baseUrl = db.getSetting('ai_baseUrl')
      const hasKey = !!db.getSetting('ai_apiKey')
      res.json({ kind, model, baseUrl, hasKey })
    })

    context.http.put('/settings', (req: express.Request, res: express.Response) => {
      const { kind, apiKey, model, baseUrl } = req.body
      if (kind) db.setSetting('ai_kind', kind)
      if (apiKey) db.setSetting('ai_apiKey', apiKey)
      if (model) db.setSetting('ai_model', model)
      if (baseUrl !== undefined) db.setSetting('ai_baseUrl', baseUrl ?? '')
      res.json({ status: 'saved' })
    })

    context.http.post('/settings/test', async (req: express.Request, res: express.Response) => {
      const config = getConfig()
      if (!config.kind) {
        res.status(400).json({ error: 'AI not configured' })
        return
      }
      try {
        const { ProviderFactory } = await import('./factory.js')
        const provider = ProviderFactory.create({
          ...config,
          apiKey: req.body.apiKey ?? config.apiKey,
          model: req.body.model ?? config.model,
          baseUrl: req.body.baseUrl ?? config.baseUrl,
        })
        const reply = await provider.chat([{ role: 'user', content: 'Reply with just: ok' }])
        res.json({ status: 'ok', reply })
      } catch (err: any) {
        res.json({ status: 'error', error: err.message })
      }
    })
  },
} satisfies Plugin
