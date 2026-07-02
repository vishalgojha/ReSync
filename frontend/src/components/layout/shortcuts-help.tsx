import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface Shortcut {
  label: string
  keys: string
}

const SECTIONS: { title: string; items: Shortcut[] }[] = [
  {
    title: 'Navigation',
    items: [
      { label: 'Command Palette', keys: 'Ctrl+K' },
      { label: 'Messages', keys: 'Ctrl+1' },
      { label: 'Automations', keys: 'Ctrl+2' },
      { label: 'Agents', keys: 'Ctrl+3' },
      { label: 'Settings', keys: 'Ctrl+4' },
    ],
  },
  {
    title: 'Actions',
    items: [
      { label: 'Focus Chat Search', keys: 'Ctrl+/' },
      { label: 'Toggle Inspector', keys: 'Ctrl+I' },
      { label: 'Close Panel / Dialog', keys: 'Esc' },
    ],
  },
]

export default function ShortcutsHelp() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onShow = () => setOpen(true)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        const target = e.target as HTMLElement
        const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
        if (!inInput) {
          e.preventDefault()
          setOpen((s) => !s)
        }
      }
    }
    document.addEventListener('show-shortcuts', onShow)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('show-shortcuts', onShow)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-bg-overlay" onClick={() => setOpen(false)} />
      <div className="relative z-50 w-full max-w-md rounded-[var(--radius-xl)] border border-border bg-bg-secondary p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Keyboard Shortcuts</h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-[var(--radius-sm)] p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-4 last:mb-0">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-[var(--radius-sm)] px-2 py-1.5 text-sm"
                >
                  <span className="text-text-primary">{item.label}</span>
                  <kbd className="rounded-[var(--radius-sm)] border border-border bg-bg-primary px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                    {item.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}

        <p className="mt-4 text-xs text-text-muted">
          Press <kbd className="rounded-[var(--radius-sm)] border border-border bg-bg-primary px-1 py-0.5 text-[10px] font-medium">?</kbd> to toggle this dialog
        </p>
      </div>
    </div>,
    document.body,
  )
}
