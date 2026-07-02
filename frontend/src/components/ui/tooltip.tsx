import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface TooltipProps {
  content: string
  children: ReactNode
  className?: string
}

function Tooltip({ content, children, className }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={cn(
            'absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] bg-bg-tertiary px-2 py-1 text-xs text-text-secondary',
            className,
          )}
        >
          {content}
        </div>
      )}
    </div>
  )
}

export { Tooltip }
