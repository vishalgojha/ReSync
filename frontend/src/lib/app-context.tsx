import { createContext, useContext, type ReactNode } from 'react'
import { useSocket } from '../hooks/use-socket'
import type { ConnectionState, SyncProgress, Chat } from './types'

interface AppContextValue {
  connectionState: ConnectionState
  qrCode: string | null
  syncProgress: SyncProgress | null
  chats: Chat[]
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const socket = useSocket()

  return (
    <AppContext.Provider value={socket}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
