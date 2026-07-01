import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

type ConnectionState = 'connecting' | 'qr' | 'connected' | 'reconnecting' | 'disconnected' | 'logged-out'

interface Props {
  connectionState: ConnectionState
  qrCode: string | null
  onConnect: () => void
  onSettings: () => void
}

const STATUS_LABELS: Record<ConnectionState, { text: string; color: string }> = {
  'disconnected': { text: 'Disconnected', color: 'text-zinc-500' },
  'connecting': { text: 'Connecting...', color: 'text-yellow-500' },
  'qr': { text: 'Scan QR with WhatsApp', color: 'text-green-500' },
  'connected': { text: 'Connected', color: 'text-green-500' },
  'reconnecting': { text: 'Reconnecting...', color: 'text-yellow-500' },
  'logged-out': { text: 'Logged out', color: 'text-red-500' },
}

export default function ConnectScreen({ connectionState, qrCode, onConnect, onSettings }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (connectionState === 'qr' && qrCode && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, qrCode, {
        width: 280,
        margin: 2,
        color: { dark: '#000', light: '#fff' },
      })
    }
  }, [connectionState, qrCode])

  const status = STATUS_LABELS[connectionState]

  return (
    <div className="h-screen flex items-center justify-center bg-zinc-950">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-white">ReSync</h1>
        <p className="text-zinc-400">WhatsApp to Browser</p>

        <p className={`text-sm ${status.color}`}>{status.text}</p>

        {connectionState === 'qr' && (
          <div className="bg-white p-3 rounded-xl inline-block">
            <canvas ref={canvasRef} className="w-[280px] h-[280px]" />
          </div>
        )}

        {connectionState === 'reconnecting' && (
          <div className="text-sm text-zinc-500">Auto-reconnect in 5s...</div>
        )}

        {connectionState === 'connected' && (
          <button
            onClick={onConnect}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
          >
            Reconnect
          </button>
        )}

        {(connectionState === 'disconnected' || connectionState === 'logged-out') && (
          <button
            onClick={onConnect}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
          >
            Connect WhatsApp
          </button>
        )}

        <div className="pt-4">
          <button
            onClick={onSettings}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            AI Settings
          </button>
        </div>
      </div>
    </div>
  )
}
