import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../lib/app-context'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import type { ConnectionState } from '../../lib/types'

const STATUS_CONFIG: Record<ConnectionState, { label: string; color: string }> = {
  disconnected: { label: 'Disconnected', color: 'text-danger' },
  connecting: { label: 'Connecting...', color: 'text-warning' },
  qr: { label: 'Scan QR Code', color: 'text-success' },
  connected: { label: 'Connected', color: 'text-success' },
  syncing: { label: 'Syncing...', color: 'text-success' },
  logged_out: { label: 'Session Expired', color: 'text-danger' },
  error: { label: 'Connection Error', color: 'text-danger' },
}

function dotColor(textColor: string): string {
  return textColor.replace('text-', 'bg-')
}

export default function ConnectScreen() {
  const { connectionState, qrCode, syncProgress, connect } = useApp()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (connectionState === 'qr' && qrCode && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, qrCode, {
        width: 280,
        margin: 2,
        color: { dark: '#000', light: '#fff' },
      })
    }
  }, [connectionState, qrCode])

  const status = STATUS_CONFIG[connectionState]
  const progress =
    syncProgress && syncProgress.total > 0
      ? Math.round((syncProgress.current / syncProgress.total) * 100)
      : null

  const showConnect = connectionState === 'disconnected' || connectionState === 'logged_out'
  const showRetry = connectionState === 'error'

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">ReSync</h1>
          <p className="text-sm text-muted-foreground">WhatsApp to Browser</p>
        </div>

        <div className={cn('flex items-center gap-2 text-sm', status.color)}>
          <span className={cn('inline-block h-2 w-2 rounded-full', dotColor(status.color))} />
          <span>{status.label}</span>
        </div>

        {connectionState === 'qr' && (
          <div className="rounded-[var(--radius-xl)] bg-white p-3">
            <canvas ref={canvasRef} className="h-[280px] w-[280px]" />
          </div>
        )}

        {connectionState === 'connecting' && (
          <div className="flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-warning border-t-transparent" />
          </div>
        )}

        {(connectionState === 'syncing' || connectionState === 'connected') && progress !== null && (
          <div className="w-full max-w-xs space-y-1">
            <div className="h-2 rounded-full bg-border">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {syncProgress?.type === 'chats' ? 'Syncing chats' : 'Syncing contacts'} ({syncProgress?.current}/{syncProgress?.total})
            </p>
          </div>
        )}

        {(connectionState === 'syncing' || connectionState === 'connected') && progress === null && (
          <p className="text-xs text-muted-foreground">Preparing...</p>
        )}

        {showRetry && (
          <Button onClick={connect} variant="default" size="lg">
            Retry
          </Button>
        )}

        {showConnect && (
          <Button onClick={connect} variant="default" size="lg">
            {connectionState === 'logged_out' ? 'Reconnect' : 'Connect WhatsApp'}
          </Button>
        )}

        <Button onClick={() => navigate('/settings')} variant="ghost" size="sm">
          AI Settings
        </Button>
      </div>
    </div>
  )
}
