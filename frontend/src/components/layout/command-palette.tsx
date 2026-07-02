import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../lib/app-context'
import { useKeyboardShortcut } from '../../hooks/use-keyboard-shortcuts'
import {
  MessageSquare,
  Settings,
  Bot,
  Zap,
  Search,
  PanelRightOpen,
  Wifi,
  WifiOff,
  Keyboard,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../../lib/utils'

interface Command {
  id: string
  label: string
  section: string
  icon: LucideIcon
  shortcut?: string
  action: () => void
}

interface CommandPaletteProps {
  onFocusSearch?: () => void
}

export default function CommandPalette({ onFocusSearch }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { connectionState, connect, disconnect } = useApp()

  const toggle = useCallback(() => {
    setOpen((s) => {
      if (!s) {
        setQuery('')
        setSelectedIndex(0)
      }
      return !s
    })
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  useKeyboardShortcut({ key: 'k', ctrl: true }, toggle)
  useKeyboardShortcut({ key: 'Escape' }, () => { if (open) close() }, open)

  const isConnected = connectionState === 'connected' || connectionState === 'syncing'

  const allCommands: Command[] = useMemo(() => [
    {
      id: 'nav-messages',
      label: 'Go to Messages',
      section: 'Navigation',
      icon: MessageSquare,
      shortcut: 'Ctrl+1',
      action: () => { navigate('/'); close() },
    },
    {
      id: 'nav-automations',
      label: 'Go to Automations',
      section: 'Navigation',
      icon: Zap,
      shortcut: 'Ctrl+2',
      action: () => { navigate('/automations'); close() },
    },
    {
      id: 'nav-agents',
      label: 'Go to Agents',
      section: 'Navigation',
      icon: Bot,
      shortcut: 'Ctrl+3',
      action: () => { navigate('/agents'); close() },
    },
    {
      id: 'nav-settings',
      label: 'Go to Settings',
      section: 'Navigation',
      icon: Settings,
      shortcut: 'Ctrl+4',
      action: () => { navigate('/settings'); close() },
    },
    {
      id: 'action-focus-search',
      label: 'Focus Chat Search',
      section: 'Actions',
      icon: Search,
      shortcut: 'Ctrl+/',
      action: () => { close(); onFocusSearch?.() },
    },
    {
      id: 'action-toggle-inspector',
      label: 'Toggle Inspector',
      section: 'Actions',
      icon: PanelRightOpen,
      shortcut: 'Ctrl+I',
      action: () => {
        document.dispatchEvent(new CustomEvent('toggle-inspector'))
        close()
      },
    },
    ...(isConnected
      ? [{
          id: 'action-disconnect',
          label: 'Disconnect WhatsApp',
          section: 'Actions',
          icon: WifiOff,
          action: () => { disconnect(); close() },
        } as Command]
      : [{
          id: 'action-connect',
          label: 'Connect WhatsApp',
          section: 'Actions',
          icon: Wifi,
          action: () => { connect(); close() },
        } as Command]),
    {
      id: 'help-shortcuts',
      label: 'Keyboard Shortcuts',
      section: 'Help',
      icon: Keyboard,
      shortcut: '?',
      action: () => {
        document.dispatchEvent(new CustomEvent('show-shortcuts'))
        close()
      },
    },
  ], [navigate, onFocusSearch, connect, disconnect, isConnected, close])

  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands
    const q = query.toLowerCase()
    return allCommands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.section.toLowerCase().includes(q),
    )
  }, [allCommands, query])

  const selectedCommand = filtered[selectedIndex]

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        selectedCommand?.action()
      }
    },
    [filtered, selectedCommand],
  )

  const sections = useMemo(() => {
    const map = new Map<string, Command[]>()
    for (const cmd of filtered) {
      const list = map.get(cmd.section)
      if (list) list.push(cmd)
      else map.set(cmd.section, [cmd])
    }
    return map
  }, [filtered])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh]">
      <div
        className="fixed inset-0 bg-bg-overlay"
        onClick={close}
      />
      <div className="relative z-[61] w-full max-w-lg rounded-[var(--radius-lg)] border border-border bg-bg-secondary shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent py-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          <kbd className="hidden shrink-0 rounded-[var(--radius-sm)] border border-border bg-bg-primary px-1.5 py-0.5 text-[10px] font-medium text-text-muted sm:inline-block">
            ESC
          </kbd>
        </div>

        <div className="max-h-[360px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            Array.from(sections.entries()).map(([section, commands]) => (
              <div key={section}>
                <div className="px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  {section}
                </div>
                {commands.map((cmd) => {
                  const globalIndex = filtered.indexOf(cmd)
                  const selected = globalIndex === selectedIndex
                  return (
                    <button
                      key={cmd.id}
                      onClick={cmd.action}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors',
                        selected ? 'bg-bg-hover' : '',
                      )}
                    >
                      <cmd.icon className="h-4 w-4 shrink-0 text-text-muted" />
                      <span className="flex-1 text-text-primary">{cmd.label}</span>
                      {cmd.shortcut && (
                        <kbd className="rounded-[var(--radius-sm)] border border-border bg-bg-primary px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
