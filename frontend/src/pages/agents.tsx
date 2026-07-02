import { useState, useRef, useEffect, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from '../config'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Avatar } from '../components/ui/avatar'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { Bot, Send, ArrowLeft, AlertCircle } from 'lucide-react'
import Sidebar from '../components/layout/sidebar'

interface AgentManifest {
  id: string
  name: string
  description: string
  version: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: { name: string; result: string }[]
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentManifest[]>([])
  const [selectedAgent, setSelectedAgent] = useState<AgentManifest | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/agents`)
      .then(r => r.json())
      .then(data => setAgents(data.agents || []))
      .catch(() => setAgents([]))
      .finally(() => setFetching(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || !selectedAgent || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/api/agents/${selectedAgent.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      const data = await res.json()

      if (data.status === 'ok') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.reply,
          toolCalls: data.toolCalls || [],
        }])
      } else if (data.status === 'error') {
        setError(data.error || 'Unknown error')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const selectAgent = (agent: AgentManifest) => {
    setSelectedAgent(agent)
    setMessages([{
      role: 'assistant',
      content: `Hi! I'm the ${agent.name}. I can help you understand your conversations, search messages, look up entities in the knowledge graph, and take actions like sending messages. What would you like to know?`,
    }])
    setError(null)
  }

  const handleBack = () => {
    setSelectedAgent(null)
    setMessages([])
    setError(null)
  }

  if (!selectedAgent) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <Bot className="h-6 w-6 text-accent" />
              <h1 className="text-lg font-semibold text-foreground">Agents</h1>
            </div>

            {fetching ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="rounded-[var(--radius-lg)] border border-border p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-3 w-64" />
                  </div>
                ))}
              </div>
            ) : agents.length === 0 ? (
              <EmptyState
                icon={<Bot className="h-8 w-8" />}
                title="No agents available"
                description="No AI agents are configured. Set up your AI provider in Settings first."
                action={{
                  label: 'Configure AI',
                  onClick: () => window.location.href = '/settings?section=ai',
                }}
              />
            ) : (
              <div className="space-y-2">
                {agents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => selectAgent(agent)}
                    className="w-full text-left rounded-[var(--radius-lg)] border border-border bg-card p-4 hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={agent.name} className="size-10" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{agent.name}</span>
                          <Badge variant="default">v{agent.version}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{agent.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar name={selectedAgent.name} className="size-8" />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-medium text-foreground">{selectedAgent.name}</h1>
            <p className="text-[10px] text-muted-foreground">{selectedAgent.id}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((msg, idx) => (
            <div key={idx}>
              <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-[var(--radius-lg)] px-3 py-2 ${
                    msg.role === 'user'
                      ? 'bg-accent text-primary-foreground rounded-br-sm'
                      : 'bg-secondary text-foreground rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {msg.toolCalls.map((tc, tci) => (
                    <div key={tci} className="flex items-center gap-1 text-[10px] text-muted-foreground px-1">
                      <span>{tc.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-secondary rounded-[var(--radius-lg)] px-3 py-2">
                <p className="text-sm text-muted-foreground">Thinking...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-[var(--radius-lg)] border border-danger-bg bg-danger-bg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-danger">{error}</p>
                  {error.includes('AI not configured') && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Configure your AI provider in{' '}
                      <Link to="/settings?section=ai" className="text-accent hover:text-accent-hover">
                        Settings
                      </Link>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="px-4 py-3 border-t border-border bg-card flex-shrink-0">
          <form
            onSubmit={(e: FormEvent) => { e.preventDefault(); handleSend() }}
            className="flex items-center gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your conversations..."
              disabled={loading}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={!input.trim() || loading}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
