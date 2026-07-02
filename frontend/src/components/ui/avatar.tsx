import { type HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const sizeMap = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
  xl: 'h-12 w-12 text-lg',
} as const

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string
  src?: string
  size?: keyof typeof sizeMap
}

function Avatar({ name, src, size = 'md', className, ...props }: AvatarProps) {
  if (src) {
    return (
      <div
        className={cn('overflow-hidden rounded-full', sizeMap[size], className)}
        {...props}
      >
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-bg-tertiary text-text-secondary font-medium',
        sizeMap[size],
        className,
      )}
      {...props}
    >
      {getInitials(name)}
    </div>
  )
}

export { Avatar }
