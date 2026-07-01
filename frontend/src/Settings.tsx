import { useEffect, useState } from 'react'

type ProviderKind = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'custom'

interface Settings {
  kind: ProviderKind | null
  model: string | null
  baseUrl: string | null
  hasKey: boolean
}

const PROVIDERS: { kind: ProviderKind; label: string }[] = [
  { kind: 'openai', label: 'OpenAI' },
  { kind: 'anthropic', label: 'Claude (Anthropic)' },
  { kind: 'gemini', label: 'Gemini' },
  { kind: 'openrouter', label: 'OpenRouter' },
  { kind: 'custom', label: 'Custom (Ollama / vLLM / LiteLLM)' },
]

interface Props {
  onClose: () => void
}

export default function Settings({ onClose }: Props) {
  const [kind, setKind] = useState<ProviderKind>('openai')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('http://localhost:4000/settings')
      .then(r => r.json())
      .then((s: Settings) => {
        if (s.kind) setKind(s.kind)
        if (s.model) setModel(s.model)
        if (s.baseUrl) setBaseUrl(s.baseUrl)
      })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await fetch('http://localhost:4000/settings', {
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
      const res = await fetch('http://localhost:4000/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, model, baseUrl }),
      })
      const data = await res.json()
      setTestResult(data.status === 'ok' ? `Connected: ${data.reply}` : `Error: ${data.error}`)
    } catch (err: any) {
      setTestResult(`Error: ${err.message}`)
    }
    setTesting(false)
  }

  const showBaseUrl = kind === 'openrouter' || kind === 'custom'

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      <div className="flex items-center px-4 py-3 border-b border-zinc-800">
        <button onClick={onClose} className="text-zinc-400 hover:text-white mr-3 transition-colors">
          ←
        </button>
        <h1 className="text-lg font-semibold text-white">AI Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 max-w-lg">
        <div>
          <label className="text-sm text-zinc-400 block mb-2">Provider</label>
          <div className="space-y-2">
            {PROVIDERS.map(p => (
              <label
                key={p.kind}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-900 cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name="provider"
                  value={p.kind}
                  checked={kind === p.kind}
                  onChange={() => setKind(p.kind)}
                  className="accent-green-600"
                />
                <span className="text-white text-sm">{p.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-zinc-400 block mb-1">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full bg-zinc-900 text-white px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-600 outline-none text-sm"
          />
        </div>

        <div>
          <label className="text-sm text-zinc-400 block mb-1">Model</label>
          <input
            type="text"
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder={kind === 'openai' ? 'gpt-4o' : kind === 'anthropic' ? 'claude-opus-4' : kind === 'gemini' ? 'gemini-2.5-pro' : kind === 'openrouter' ? 'qwen/qwen3-235b-a22b' : 'qwen3:32b'}
            className="w-full bg-zinc-900 text-white px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-600 outline-none text-sm"
          />
        </div>

        {showBaseUrl && (
          <div>
            <label className="text-sm text-zinc-400 block mb-1">
              Base URL {kind === 'custom' && '(e.g. http://localhost:11434/v1)'}
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder={kind === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'http://localhost:11434/v1'}
              className="w-full bg-zinc-900 text-white px-3 py-2 rounded-lg border border-zinc-800 focus:border-zinc-600 outline-none text-sm"
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 text-white py-2 px-4 rounded-lg text-sm transition-colors"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        </div>

        {testResult && (
          <div className={`text-sm p-3 rounded-lg ${testResult.startsWith('Connected') ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
            {testResult}
          </div>
        )}
      </div>
    </div>
  )
}
