import { type HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export interface SeparatorProps extends HTMLAttributes<HTMLHRElement> {}

function Separator({ className, ...props }: SeparatorProps) {
  return (
    <hr
      className={cn('border-border', className)}
      {...props}
    />
  )
}

export { Separator }
