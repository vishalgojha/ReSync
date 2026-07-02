import { useEffect, useState, useCallback } from 'react'
import {
  Info,
  List,
  BarChart3,
  FileText,
  Users,
  File,
  Heart,
  GitBranch,
  Search,
  ArrowLeft,
  User,
  Phone,
  Mail,
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  Link,
  HelpCircle,
} from 'lucide-react'
import { API_BASE } from '../../config'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import { Skeleton } from '../ui/skeleton'
import type { Tab } from '../../lib/types'

const TABS: { id: Tab; label: string; icon: typeof Info }[] = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'timeline', label: 'Timeline', icon: List },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'facts', label: 'Facts', icon: FileText },
  { id: 'participants', label: 'People', icon: Users },
  { id: 'files', label: 'Files', icon: File },
  { id: 'health', label: 'Health', icon: Heart },
  { id: 'graph', label: 'Graph', icon: GitBranch },
]

interface Participant {
  jid: string
  name: string
}

interface ConversationState {
  first_message_at: number | null
  first_message_text: string | null
  first_message_from_me: number | null
  last_message_at: number | null
  last_message_text: string | null
  last_message_from_me: number | null
  last_outgoing_at: number | null
  last_incoming_at: number | null
  message_count: number
  media_count: number
  participant_count: number
  average_reply_delay: number
  health_score: number
}

interface TimelineEvent {
  id: number
  event_type: string
  label: string
  description: string | null
  created_at: number
}

interface Fact {
  id: number
  value: string
  source: string | null
  created_at: number
}

interface Entity {
  id: number
  key: string | null
  value: string
  confidence: number
}

interface TrackedFile {
  id: number
  key: string | null
  value: string
  confidence: number
}

interface ConversationData {
  chatId: string
  state: ConversationState | null
  timeline: TimelineEvent[]
  facts: Fact[]
  entities: Entity[]
  contacts: Array<{ id: number; key: string | null; value: string; confidence: number }>
  files: TrackedFile[]
  topics: Array<{ id: number; topic: string; last_mentioned_at: number; mention_count: number }>
  participants: Participant[]
}

interface GraphNode {
  id: string
  entity_type: string
  value: string
  mention_count: number
  last_seen_at: number | null
}

interface GraphEdge {
  id: number
  source_node_id: string
  target_node_id: string
  relationship: string
  strength: number
}

interface RelatedNode {
  node: GraphNode
  edge: GraphEdge
  direction: 'outgoing' | 'incoming'
}

export interface InspectorProps {
  chatId: string
  onClose: () => void
}

function formatTime(ts: number | null): string {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(ms: number): string {
  if (ms < 1000) return 'instant'
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`
  return `${Math.round(ms / 3600000)}h`
}

function healthLabel(score: number): string {
  if (score >= 0.8) return 'Excellent'
  if (score >= 0.6) return 'Good'
  if (score >= 0.4) return 'Fair'
  return 'Needs attention'
}

function healthColor(score: number): string {
  if (score >= 0.8) return 'text-success'
  if (score >= 0.6) return 'text-warning'
  if (score >= 0.4) return 'text-warning'
  return 'text-danger'
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function findChatName(participants: Participant[]): string {
  const nonMe = participants.find(
    (p) =>
      !p.jid.includes('s.whatsapp.net') && !p.jid.includes('@broadcast'),
  )
  return nonMe?.name || 'Unknown'
}

const ENTITY_ICON: Record<string, typeof User> = {
  person: User,
  phone: Phone,
  email: Mail,
  company: Building2,
  location: MapPin,
  date: Calendar,
  money: DollarSign,
  document: FileText,
  link: Link,
}

function entityIcon(type: string): typeof HelpCircle {
  return ENTITY_ICON[type] || HelpCircle
}

export default function Inspector({ chatId, onClose }: InspectorProps) {
  const [data, setData] = useState<ConversationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/conversation/${chatId}`)
      const json = await res.json()
      setData(json)
    } finally {
      setLoading(false)
    }
  }, [chatId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const state = data?.state
  const chatName = data ? findChatName(data.participants) : 'Conversation'

  return (
    <div className="flex w-80 shrink-0 flex-col border-l border-border bg-bg-secondary">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-tertiary text-[10px] font-medium text-text-secondary">
            {getInitials(chatName)}
          </div>
          <span className="truncate text-sm font-medium text-text-primary">{chatName}</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-[var(--radius-sm)] p-1 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          ✕
        </button>
      </div>

      <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-border px-2 py-2">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 text-xs transition-colors',
                activeTab === tab.id
                  ? 'bg-bg-active text-text-primary'
                  : 'text-text-muted hover:bg-bg-hover hover:text-text-secondary',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <LoadingState />
        ) : (
          <>
            {activeTab === 'overview' && <OverviewTab data={data} state={state} />}
            {activeTab === 'timeline' && <TimelineTab events={data?.timeline || []} />}
            {activeTab === 'stats' && <StatsTab state={state} />}
            {activeTab === 'facts' && <FactsTab facts={data?.facts || []} />}
            {activeTab === 'participants' && <ParticipantsTab participants={data?.participants || []} />}
            {activeTab === 'files' && <FilesTab files={data?.files || []} />}
            {activeTab === 'health' && <HealthTab state={state} />}
            {activeTab === 'graph' && <GraphSection chatId={chatId} />}
          </>
        )}
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="h-16 w-full" />
    </div>
  )
}

interface OverviewTabProps {
  data: ConversationData | null
  state: ConversationState | null | undefined
}

function OverviewTab({ data, state }: OverviewTabProps) {
  if (!state || !data) {
    return (
      <p className="py-8 text-center text-xs text-text-muted">
        No conversation data yet. Send or receive a message to start building intelligence.
      </p>
    )
  }

  const name = findChatName(data.participants)

  return (
    <div className="space-y-3">
      <div className="rounded-[var(--radius-md)] bg-bg-tertiary p-3">
        <h3 className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
          Conversation
        </h3>
        <p className="text-sm text-text-primary">{name}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className={cn('text-base font-semibold', healthColor(state.health_score))}>
            {healthLabel(state.health_score)}
          </span>
          <span className="text-[10px] text-text-muted">Health</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Messages" value={String(state.message_count)} />
        <MetricCard label="Media" value={String(state.media_count)} />
        <MetricCard label="Participants" value={state.participant_count ? String(state.participant_count) : '—'} />
        <MetricCard
          label="Avg Reply"
          value={state.average_reply_delay > 0 ? formatDuration(state.average_reply_delay) : '—'}
        />
      </div>

      {state.last_message_at && (
        <div className="rounded-[var(--radius-md)] bg-bg-tertiary p-3">
          <p className="mb-0.5 text-[10px] text-text-muted">Last Message</p>
          <p className="truncate text-sm text-text-primary">
            {state.last_message_from_me ? 'You: ' : ''}
            {state.last_message_text || 'Media'}
          </p>
          <p className="mt-0.5 text-[10px] text-text-muted">{formatTime(state.last_message_at)}</p>
        </div>
      )}

      {state.first_message_at && (
        <div className="rounded-[var(--radius-md)] bg-bg-tertiary p-3">
          <p className="mb-0.5 text-[10px] text-text-muted">First Message</p>
          <p className="truncate text-sm text-text-primary">
            {state.first_message_from_me ? 'You: ' : ''}
            {state.first_message_text || 'Media'}
          </p>
          <p className="mt-0.5 text-[10px] text-text-muted">{formatTime(state.first_message_at)}</p>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-bg-tertiary p-3">
      <p className="text-[10px] text-text-muted">{label}</p>
      <p className="text-base font-semibold text-text-primary">{value}</p>
    </div>
  )
}

interface TimelineTabProps {
  events: TimelineEvent[]
}

function TimelineTab({ events }: TimelineTabProps) {
  if (events.length === 0) {
    return <p className="py-8 text-center text-xs text-text-muted">No timeline events yet.</p>
  }

  const iconMap: Record<string, string> = {
    conversation_started: '💬',
    customer_replied: '📩',
    agent_replied: '📤',
    media_shared: '📎',
    document_shared: '📄',
    location_shared: '📍',
    contact_shared: '👤',
    poll_created: '📊',
    reaction: '❤️',
  }

  return (
    <div className="space-y-0.5">
      {events.map((event) => (
        <div key={event.id} className="flex items-start gap-2 py-1.5">
          <span className="mt-0.5 shrink-0 text-sm">{iconMap[event.event_type] || '📝'}</span>
          <div className="min-w-0">
            <p className="text-xs text-text-secondary">{event.description || event.label}</p>
            <p className="text-[10px] text-text-muted">{formatTime(event.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

interface StatsTabProps {
  state: ConversationState | null | undefined
}

function StatsTab({ state }: StatsTabProps) {
  if (!state) {
    return <p className="py-8 text-center text-xs text-text-muted">No statistics yet.</p>
  }

  const firstMsg = state.first_message_at
    ? new Date(state.first_message_at * 1000).toLocaleDateString()
    : '—'
  const lastMsg = state.last_message_at
    ? new Date(state.last_message_at * 1000).toLocaleDateString()
    : '—'
  const msgPerDay = state.first_message_at
    ? (state.message_count / Math.max(1, (Date.now() / 1000 - state.first_message_at) / 86400)).toFixed(1)
    : '—'

  return (
    <div className="space-y-2">
      <StatRow label="Total Messages" value={String(state.message_count)} />
      <Separator />
      <StatRow label="Media Items" value={String(state.media_count)} />
      <Separator />
      <StatRow label="Participants" value={String(state.participant_count)} />
      <Separator />
      <StatRow
        label="Avg Reply Delay"
        value={state.average_reply_delay > 0 ? formatDuration(state.average_reply_delay) : '—'}
      />
      <Separator />
      <StatRow label="Messages/Day" value={String(msgPerDay)} />
      <Separator />
      <StatRow label="First Message" value={firstMsg} />
      <Separator />
      <StatRow label="Last Message" value={lastMsg} />
      {state.last_outgoing_at && (
        <>
          <Separator />
          <StatRow label="Last Outgoing" value={formatTime(state.last_outgoing_at)} />
        </>
      )}
      {state.last_incoming_at && (
        <>
          <Separator />
          <StatRow label="Last Incoming" value={formatTime(state.last_incoming_at)} />
        </>
      )}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-xs font-medium text-text-primary">{value}</span>
    </div>
  )
}

interface FactsTabProps {
  facts: Fact[]
}

function FactsTab({ facts }: FactsTabProps) {
  if (facts.length === 0) {
    return <p className="py-8 text-center text-xs text-text-muted">No facts recorded yet.</p>
  }

  return (
    <div className="space-y-2">
      {facts.map((fact) => (
        <div key={fact.id} className="rounded-[var(--radius-md)] bg-bg-tertiary p-2.5">
          <p className="text-sm text-text-primary">{fact.value}</p>
          <div className="mt-1 flex items-center gap-2">
            {fact.source && (
              <span className="text-[10px] text-text-muted">via {fact.source}</span>
            )}
            <span className="text-[10px] text-text-muted">{formatTime(fact.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

interface ParticipantsTabProps {
  participants: Participant[]
}

function ParticipantsTab({ participants }: ParticipantsTabProps) {
  if (participants.length === 0) {
    return <p className="py-8 text-center text-xs text-text-muted">No participants identified.</p>
  }

  return (
    <div className="space-y-1">
      {participants.map((p) => (
        <div key={p.jid} className="flex items-center gap-2 py-1.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-tertiary text-[10px] font-medium text-text-secondary">
            {getInitials(p.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-text-primary">{p.name}</p>
            <p className="truncate text-[10px] text-text-muted">{p.jid.split('@')[0]}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

interface FilesTabProps {
  files: TrackedFile[]
}

function FilesTab({ files }: FilesTabProps) {
  if (files.length === 0) {
    return <p className="py-8 text-center text-xs text-text-muted">No files shared yet.</p>
  }

  return (
    <div className="space-y-1">
      {files.map((f) => {
        let meta: { mimeType?: string; size?: number } = {}
        try {
          meta = JSON.parse(f.value)
        } catch {
          meta = {}
        }
        const sizeStr =
          meta.size && meta.size > 0
            ? `${(meta.size / 1024 / 1024).toFixed(1)} MB`
            : ''

        return (
          <div key={f.id} className="flex items-center gap-2 py-1.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-bg-tertiary">
              <File className="h-3.5 w-3.5 text-text-muted" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs text-text-primary">{f.key || 'Unknown file'}</p>
              {sizeStr && <p className="text-[10px] text-text-muted">{sizeStr}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface HealthTabProps {
  state: ConversationState | null | undefined
}

function HealthTab({ state }: HealthTabProps) {
  if (!state) {
    return <p className="py-8 text-center text-xs text-text-muted">No health data yet.</p>
  }

  const metrics = [
    { label: 'Overall Health', value: state.health_score, max: 1, good: 0.6 },
    {
      label: 'Responsiveness',
      value: Math.max(0, 1 - state.average_reply_delay / (86400 * 1000)),
      max: 1,
      good: 0.5,
    },
    {
      label: 'Message Volume',
      value: Math.min(1, state.message_count / 100),
      max: 1,
      good: 0.3,
    },
    {
      label: 'Engagement',
      value: state.message_count > 0 ? (state.last_message_from_me ? 0.6 : 0.8) : 0,
      max: 1,
      good: 0.4,
    },
  ]

  return (
    <div className="space-y-3">
      {metrics.map((m) => {
        const pct = Math.round((m.value / m.max) * 100)
        const isGood = m.value >= m.good
        return (
          <div key={m.label} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">{m.label}</span>
              <span
                className={cn(
                  'text-xs font-medium',
                  isGood ? 'text-success' : 'text-warning',
                )}
              >
                {pct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  isGood ? 'bg-success' : 'bg-warning',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}

      <div className="rounded-[var(--radius-md)] bg-bg-tertiary p-3">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
          Recommendations
        </p>
        {state.health_score < 0.6 && (
          <p className="text-xs text-text-secondary">
            Response times are high. Consider responding faster to improve engagement.
          </p>
        )}
        {state.media_count === 0 && state.message_count > 10 && (
          <p className="text-xs text-text-secondary">
            No media shared yet. Sharing images or documents can improve conversation quality.
          </p>
        )}
        {state.health_score >= 0.8 && (
          <p className="text-xs text-success">
            Conversation is healthy and responsive. Keep it up!
          </p>
        )}
        {state.message_count < 5 && (
          <p className="text-xs text-text-secondary">
            Conversation is still new. More messages will improve insights.
          </p>
        )}
      </div>
    </div>
  )
}

function GraphSection({ chatId }: { chatId: string }) {
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [relatedNodes, setRelatedNodes] = useState<RelatedNode[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    setLoading(true)
    setSelectedNode(null)
    setRelatedNodes([])
    fetch(`${API_BASE}/api/graph/conversation/${chatId}`)
      .then((r) => r.json())
      .then((data) => {
        setNodes(data.nodes || [])
        setEdges(data.edges || [])
      })
      .finally(() => setLoading(false))
  }, [chatId])

  const selectNode = async (nodeId: string) => {
    setSelectedNode(nodeId)
    const res = await fetch(`${API_BASE}/api/graph/node/${nodeId}`)
    const data = await res.json()
    setRelatedNodes(data.related || [])
  }

  const filteredNodes = searchQuery
    ? nodes.filter((n) => n.value.toLowerCase().includes(searchQuery.toLowerCase()))
    : nodes

  const getEdgesForNode = (nodeId: string) =>
    edges.filter((e) => e.source_node_id === nodeId || e.target_node_id === nodeId)

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (selectedNode) {
    const node = nodes.find((n) => n.id === selectedNode)
    if (!node) return null

    return (
      <div className="space-y-3">
        <button
          onClick={() => {
            setSelectedNode(null)
            setRelatedNodes([])
          }}
          className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to graph
        </button>

        <div className="rounded-[var(--radius-md)] bg-bg-tertiary p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-bg-active">
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{node.value}</p>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-[10px]">{node.entity_type}</Badge>
                <span className="text-[10px] text-text-muted">{node.mention_count}x</span>
              </div>
            </div>
          </div>
        </div>

        {relatedNodes.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Relationships
            </p>
            <div className="space-y-1">
              {relatedNodes.map((r) => {
                const Icon = entityIcon(r.node.entity_type)
                return (
                  <div
                    key={`${r.direction}-${r.edge.id}`}
                    className="flex items-center gap-2 rounded-[var(--radius-md)] bg-bg-tertiary px-2.5 py-1.5"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-text-muted">
                          {r.direction === 'outgoing' ? `${r.edge.relationship} →` : `← ${r.edge.relationship}`}
                        </span>
                        <span className="truncate text-xs text-text-primary">{r.node.value}</span>
                      </div>
                      <p className="text-[10px] text-text-muted">{r.node.entity_type}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {relatedNodes.length === 0 && (
          <p className="py-4 text-center text-xs text-text-muted">No relationships yet</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        {showSearch && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter entities..."
              className="w-full rounded-[var(--radius-md)] border border-border bg-bg-primary py-1.5 pl-8 pr-3 text-xs text-text-primary placeholder-text-muted outline-none transition-colors focus:border-border-accent focus:ring-1 focus:ring-accent-ring"
              autoFocus
            />
          </div>
        )}
        {!showSearch && nodes.length > 3 && (
          <button
            onClick={() => setShowSearch(true)}
            className="flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-border bg-bg-primary px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-bg-hover"
          >
            <Search className="h-3.5 w-3.5" />
            Filter entities...
          </button>
        )}
      </div>

      {filteredNodes.length === 0 && (
        <p className="py-8 text-center text-xs text-text-muted">
          {searchQuery
            ? 'No matching entities found.'
            : 'No entities extracted yet. Send messages to build the graph.'}
        </p>
      )}

      <div className="space-y-0.5">
        {filteredNodes.map((node) => {
          const nodeEdges = getEdgesForNode(node.id)
          const Icon = entityIcon(node.entity_type)
          return (
            <button
              key={node.id}
              onClick={() => selectNode(node.id)}
              className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-1.5 text-left transition-colors hover:bg-bg-hover"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-text-primary">{node.value}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase text-text-muted">{node.entity_type}</span>
                  <span className="text-[10px] text-text-muted">
                    {nodeEdges.length} edge{nodeEdges.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-[10px] text-text-muted">{node.mention_count}x</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
