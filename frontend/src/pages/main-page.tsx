import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../lib/app-context'
import { useKeyboardShortcut } from '../hooks/use-keyboard-shortcuts'
import { MessageCircle, PanelRightOpen, PanelRightClose } from 'lucide-react'
import ConnectScreen from '../components/layout/connect-screen'
import Sidebar from '../components/layout/sidebar'
import ChatList from '../components/layout/chat-list'
import ChatView from '../components/layout/chat-view'
import Inspector from '../components/layout/inspector'

export default function MainPage() {
  const { chatId } = useParams<{ chatId?: string }>()
  const { connectionState } = useApp()
  const navigate = useNavigate()
  const [showInspector, setShowInspector] = useState(false)

  const handleSelectChat = useCallback((id: string) => {
    navigate(`/chat/${id}`)
  }, [navigate])

  const focusChatSearch = useCallback(() => {
    document.dispatchEvent(new CustomEvent('focus-chat-search'))
  }, [])

  useKeyboardShortcut({ key: '/', ctrl: true }, focusChatSearch)
  useKeyboardShortcut({ key: 'i', ctrl: true }, () => setShowInspector((s) => !s))

  const isDisconnected = connectionState === 'disconnected' || connectionState === 'logged_out'

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Left Nav - 72px */}
      <Sidebar />

      {isDisconnected ? (
        <div className="flex-1 flex">
          <ConnectScreen />
        </div>
      ) : (
        <>
          {/* Chat List - 320px */}
          <ChatList onSelectChat={handleSelectChat} />

          {/* Main Conversation - Flexible */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {chatId ? (
              <ChatView chatId={chatId} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Select a conversation to start messaging</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - 360px (Collapsible) */}
          {showInspector && chatId && (
            <Inspector chatId={chatId} onClose={() => setShowInspector(false)} />
          )}
        </>
      )}

      {/* Toggle Inspector Button */}
      {chatId && (
        <button
          onClick={() => setShowInspector((s) => !s)}
          className="fixed bottom-4 right-4 z-40 text-muted-foreground hover:text-foreground transition-colors"
        >
          {showInspector ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </button>
      )}
    </div>
  )
}
