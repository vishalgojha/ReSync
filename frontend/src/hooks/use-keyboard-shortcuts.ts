import { useEffect, useRef } from 'react'

export interface KeyCombo {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
}

const MODAL_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export function useKeyboardShortcut(
  combo: KeyCombo,
  handler: (e: KeyboardEvent) => void,
  enabled = true,
) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      const target = e.target as HTMLElement
      const inInput = MODAL_TAGS.has(target.tagName) || target.isContentEditable
      const isCtrlK = combo.key === 'k' && combo.ctrl
      const isEscape = combo.key === 'Escape'
      if (inInput && !isCtrlK && !isEscape) return

      const matchKey = e.key === combo.key
      const matchCtrl = !!e.ctrlKey === !!combo.ctrl
      const matchMeta = !!e.metaKey === !!combo.meta
      const matchShift = !!e.shiftKey === !!combo.shift
      const matchAlt = !!e.altKey === !!combo.alt

      if (matchKey && matchCtrl && matchMeta && matchShift && matchAlt) {
        e.preventDefault()
        e.stopPropagation()
        handlerRef.current(e)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [combo.key, combo.ctrl, combo.meta, combo.shift, combo.alt, enabled])
}
