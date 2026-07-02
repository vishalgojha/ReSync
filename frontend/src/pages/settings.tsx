import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../lib/app-context'
import { API_BASE } from '../config'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import { Server, Smartphone, Bot, Puzzle, Info } from 'lucide-react'
import Sidebar from '../components/layout/sidebar'

type ProviderKind = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'custom'

interface AiSettings {
  kind: ProviderKind | null
  model: string | null
  baseUrl: string | null
  hasKey: boolean
}

interface Section {
  id: string
  label: string
  icon: typeof Server
}

const SECTIONS: Section[] = [
  { id: 'general', label: 'General', icon: Server },
  { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
  { id: 'ai', label: 'AI', icon: Bot },
  { id: 'plugins', label: 'Plugins', icon: Puzzle },
  { id: 'about', label: 'About', icon: Info },
]

const PROVIDERS: { kind: ProviderKind; label: string }[] = [
  { kind: 'openai', label: 'OpenAI' },
  { kind: 'anthropic', label: 'Claude (Anthropic)' },
  { kind: 'gemini', label: 'Gemini' },
  { kind: 'openrouter', label: 'OpenRouter' },
  { kind: 'custom', label: 'Custom (Ollama / vLLM / LiteLLM)' },
]

function AiSettingsSection() {
  const [kind, setKind] = useState<ProviderKind>('openai')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/plugins/ai/settings`)
      .then(r => r.json())
      .then((s: AiSettings) => {
        if (s.kind) setKind(s.kind)
        if (s.model) setModel(s.model)
        if (s.baseUrl) setBaseUrl(s.baseUrl)
      })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await fetch(`${API_BASE}/api/plugins/ai/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, apiKey, model, baseUrl }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`${API_BASE}/api/plugins/ai/settings/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, model, baseUrl }),
      })
      const data = await res.json()
      if (data.status === 'ok') {
        setTestResult({ ok: true, message: `Connected: ${data.reply}` })
      } else {
        setTestResult({ ok: false, message: `Error: ${data.error}` })
      }
    } catch (err: unknown) {
      setTestResult({ ok: false, message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` })
    }
    setTesting(false)
  }

  const showBaseUrl = kind === 'openrouter' || kind === 'custom'

  const modelPlaceholder: Record<string, string> = {
    openai: 'gpt-4o',
    anthropic: 'claude-opus-4',
    gemini: 'gemini-2.5-pro',
    openrouter: 'qwen/qwen3-235b-a22b',
    custom: 'qwen3:32b',
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm text-text-secondary block mb-2">Provider</label>
        <div className="flex flex-wrap gap-2">
          {PROVIDERS.map(p => (
            <Button
              key={p.kind}
              variant={kind === p.kind ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setKind(p.kind)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm text-text-secondary block mb-1">API Key</label>
        <Input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="sk-..."
        />
      </div>

      <div>
        <label className="text-sm text-text-secondary block mb-1">Model</label>
        <Input
          type="text"
          value={model}
          onChange={e => setModel(e.target.value)}
          placeholder={modelPlaceholder[kind]}
        />
      </div>

      {showBaseUrl && (
        <div>
          <label className="text-sm text-text-secondary block mb-1">
            Base URL {kind === 'custom' && '(e.g. http://localhost:11434/v1)'}
          </label>
          <Input
            type="text"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder={kind === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'http://localhost:11434/v1'}
          />
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
        </Button>
        <Button variant="secondary" onClick={handleTest} disabled={testing}>
          {testing ? 'Testing...' : 'Test Connection'}
        </Button>
      </div>

      {testResult && (
        <Badge variant={testResult.ok ? 'success' : 'danger'} className="w-full justify-center py-2">
          {testResult.message}
        </Badge>
      )}
    </div>
  )
}

function GeneralSection() {
  const [serverUrl] = useState(API_BASE || 'http://localhost:3000')

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-text-secondary block mb-1">Server URL</label>
        <p className="text-text-primary text-sm font-mono bg-bg-secondary rounded-[var(--radius-md)] px-3 py-2 border border-border">
          {serverUrl}
        </p>
      </div>
      <div>
        <label className="text-sm text-text-secondary block mb-1">Status</label>
        <Badge variant="success">Running</Badge>
      </div>
    </div>
  )
}

function WhatsAppSection() {
  const { connectionState, connect, disconnect } = useApp()

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-text-secondary block mb-1">Connection</label>
        <Badge
          variant={
            connectionState === 'connected' || connectionState === 'syncing'
              ? 'success'
              : connectionState === 'connecting' || connectionState === 'qr'
                ? 'warning'
                : 'danger'
          }
        >
          {connectionState}
        </Badge>
      </div>
      {(connectionState === 'disconnected' || connectionState === 'logged_out') && (
        <Button onClick={connect}>Connect</Button>
      )}
      {(connectionState === 'connected' || connectionState === 'syncing') && (
        <Button variant="danger" onClick={disconnect}>Disconnect</Button>
      )}
    </div>
  )
}

function PluginsSection() {
  const [plugins, setPlugins] = useState<string[]>([])

  useEffect(() => {
    fetch(`${API_BASE}/api/plugins`)
      .then(r => r.json())
      .then(data => setPlugins(data.plugins || []))
      .catch(() => setPlugins(['ai']))
  }, [])

  return (
    <div className="space-y-3">
      {plugins.length === 0 ? (
        <p className="text-sm text-text-muted">No plugins available</p>
      ) : (
        plugins.map(p => (
          <div key={p} className="flex items-center justify-between py-2">
            <span className="text-sm text-text-primary capitalize">{p}</span>
            <Badge variant="default">active</Badge>
          </div>
        ))
      )}
    </div>
  )
}

function AboutSection() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-2xl font-bold text-text-primary">ReSync</p>
        <p className="text-sm text-text-secondary mt-1">WhatsApp Web Client</p>
      </div>
      <Separator />
      <div>
        <label className="text-sm text-text-secondary block mb-1">Version</label>
        <p className="text-text-primary text-sm">0.1.0</p>
      </div>
      <div>
        <label className="text-sm text-text-secondary block mb-1">Links</label>
        <div className="space-y-1">
          <a
            href="https://github.com/your-org/resync"
            target="_blank"
            rel="noreferrer"
            className="block text-sm text-accent hover:text-accent-hover transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://discord.gg/WeJM5FP9GG"
            target="_blank"
            rel="noreferrer"
            className="block text-sm text-accent hover:text-accent-hover transition-colors"
          >
            Discord
          </a>
        </div>
      </div>
    </div>
  )
}

import type { JSX } from 'react'

const SECTION_COMPONENTS: Record<string, () => JSX.Element> = {
  general: GeneralSection,
  whatsapp: WhatsAppSection,
  ai: AiSettingsSection,
  plugins: PluginsSection,
  about: AboutSection,
}

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSection = searchParams.get('section') || 'general'

  const setSection = (id: string) => {
    setSearchParams({ section: id })
  }

  const ActiveComponent = SECTION_COMPONENTS[activeSection] || GeneralSection

  return (
    <div className="flex h-screen bg-bg-primary">
      <Sidebar />
      <div className="flex flex-1 overflow-hidden">
        <nav className="w-48 border-r border-border flex-shrink-0 pt-4 px-2 space-y-1">
          {SECTIONS.map(s => {
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-sm transition-colors text-left',
                  activeSection === s.id
                    ? 'bg-accent-muted text-accent'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {s.label}
              </button>
            )
          })}
        </nav>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-lg">
            <ActiveComponent />
          </div>
        </div>
      </div>
    </div>
  )
}
