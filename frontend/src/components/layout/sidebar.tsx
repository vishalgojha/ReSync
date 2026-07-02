import { useNavigate, useLocation } from 'react-router-dom'
import { MessageSquare, Zap, Bot, Settings, Power } from 'lucide-react'
import { useApp } from '../../lib/app-context'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import type { ConnectionState } from '../../lib/types'

const NAV_ITEMS = [
  { path: '/', label: 'Messages', icon: MessageSquare },
  { path: '/automations', label: 'Automations', icon: Zap },
  { path: '/agents', label: 'Agents', icon: Bot },
  { path: '/settings', label: 'Settings', icon: Settings },
]

function connectionDot(state: ConnectionState): string {
  switch (state) {
    case 'connected':
    case 'syncing':
      return 'bg-success'
    case 'connecting':
    case 'qr':
      return 'bg-warning'
    case 'disconnected':
    case 'logged_out':
    case 'error':
      return 'bg-danger'
  }
}

function connectionLabel(state: ConnectionState): string {
  switch (state) {
    case 'connected':
      return 'Connected'
    case 'syncing':
      return 'Syncing...'
    case 'connecting':
      return 'Connecting...'
    case 'qr':
      return 'QR Ready'
    case 'disconnected':
      return 'Disconnected'
    case 'logged_out':
      return 'Logged Out'
    case 'error':
      return 'Error'
  }
}

export default function Sidebar() {
  const { connectionState, disconnect } = useApp()
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-border bg-bg-sidebar">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] bg-accent text-xs font-bold text-text-accent">
          R
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-text-primary">ReSync</span>
          <span className="text-[10px] text-text-muted">v0.1.0</span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-bg-active text-text-primary'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <div className="mb-3 flex items-center gap-2 px-1">
          <span className={cn('inline-block h-2 w-2 rounded-full', connectionDot(connectionState))} />
          <span className="text-xs text-text-secondary">{connectionLabel(connectionState)}</span>
        </div>
        <Button
          onClick={disconnect}
          variant="secondary"
          size="sm"
          className="w-full"
        >
          <Power className="h-3.5 w-3.5" />
          Disconnect
        </Button>
      </div>
    </aside>
  )
}
