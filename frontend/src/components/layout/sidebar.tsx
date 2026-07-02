import { useNavigate, useLocation } from 'react-router-dom'
import {
  MessageSquare,
  Zap,
  Bot,
  Settings,
  Wifi,
  WifiOff,
  User,
  LogOut,
} from 'lucide-react'
import { useApp } from '../../lib/app-context'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import type { ConnectionState } from '../../lib/types'

const NAV_ITEMS = [
  { path: '/', label: 'Messages', icon: MessageSquare },
  { path: '/automations', label: 'Automations', icon: Zap },
  { path: '/agents', label: 'Agents', icon: Bot },
]

function connectionDot(state: ConnectionState): string {
  switch (state) {
    case 'connected':
    case 'syncing':
      return 'bg-green-500'
    case 'connecting':
    case 'qr':
      return 'bg-amber-500'
    case 'disconnected':
    case 'logged_out':
    case 'error':
      return 'bg-red-500'
  }
}

export default function Sidebar() {
  const { connectionState, connect, disconnect } = useApp()
  const navigate = useNavigate()
  const location = useLocation()

  const isConnected = connectionState === 'connected' || connectionState === 'syncing'

  return (
    <div className="w-[72px] bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4 gap-4 flex-shrink-0">
      {/* Logo */}
      <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-accent-foreground font-bold text-sm">
        R
      </div>

      {/* Navigation Items */}
      <div className="flex-1 flex flex-col items-center gap-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)

          return (
            <Tooltip key={item.path}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? 'default' : 'ghost'}
                  size="icon"
                  className="w-10 h-10 rounded-lg"
                  onClick={() => navigate(item.path)}
                >
                  <Icon className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="ml-2">
                {item.label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      {/* Bottom Section */}
      <div className="flex flex-col items-center gap-2 pt-4 border-t border-sidebar-border w-full px-4">
        {/* Connection Status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-lg relative"
              onClick={() => isConnected ? disconnect() : connect()}
            >
              {isConnected ? (
                <Wifi className="w-5 h-5 text-green-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-500" />
              )}
              <span className={cn(
                'absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full ring-1 ring-sidebar',
                connectionDot(connectionState)
              )} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="ml-2">
            {isConnected ? 'Connected' : 'Disconnected'}
          </TooltipContent>
        </Tooltip>

        {/* Settings */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={location.pathname === '/settings' ? 'default' : 'ghost'}
              size="icon"
              className="w-10 h-10 rounded-lg"
              onClick={() => navigate('/settings')}
            >
              <Settings className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="ml-2">
            Settings
          </TooltipContent>
        </Tooltip>

        {/* Profile Menu */}
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 rounded-lg"
                >
                  <User className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Preferences
                </DropdownMenuItem>
                <DropdownMenuItem onClick={disconnect} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipTrigger>
          <TooltipContent side="right" className="ml-2">
            Profile
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
