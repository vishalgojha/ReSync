import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../lib/app-context'
import { useKeyboardShortcut } from '../hooks/use-keyboard-shortcuts'
import { EmptyState } from '../components/ui/empty-state'
import { MessageCircle, PanelRightOpen, PanelRightClose } from 'lucide-react'
import ConnectScreen from '../components/layout/connect-screen'
import Sidebar from '../components/layout/sidebar'
import ChatList from '../components/layout/chat-list'
import ChatView from '../components/layout/chat-view'
import Inspector from '../components/layout/inspector'
import CommandPalette from '../components/layout/command-palette'
import ShortcutsHelp from '../components/layout/shortcuts-help'

export default function MainPage() {
  const { chatId } = useParams<{ chatId?: string }>()
  const { connectionState } = useApp()
  const navigate = useNavigate()
  const [showInspector, setShowInspector] = useState(false)

  const handleSelectChat = (id: string) => {
    navigate(`/chat/${id}`)
    setShowInspector(false)
  }

  const focusChatSearch = useCallback(() => {
    document.dispatchEvent(new CustomEvent('focus-chat-search'))
  }, [])

  useKeyboardShortcut({ key: '1', ctrl: true }, () => navigate('/'))
  useKeyboardShortcut({ key: '2', ctrl: true }, () => navigate('/automations'))
  useKeyboardShortcut({ key: '3', ctrl: true }, () => navigate('/agents'))
  useKeyboardShortcut({ key: '4', ctrl: true }, () => navigate('/settings'))
  useKeyboardShortcut({ key: '/', ctrl: true }, focusChatSearch)
  useKeyboardShortcut({ key: 'i', ctrl: true }, () => setShowInspector((s) => !s))

  const isDisconnected = connectionState === 'disconnected' || connectionState === 'logged_out'

  return (
    <div className="flex h-screen bg-bg-primary">
      <Sidebar />
      {isDisconnected ? (
        <div className="flex-1 flex">
          <ConnectScreen />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[300px] border-r border-border flex-shrink-0">
            <ChatList onSelectChat={handleSelectChat} />
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            {chatId ? (
              <ChatView chatId={chatId} />
            ) : (
              <EmptyState
                icon={<MessageCircle className="h-8 w-8" />}
                title="Select a conversation to start messaging"
                description="Choose a chat from the sidebar to view messages"
              />
            )}
          </div>
          {showInspector && chatId && (
            <div className="w-[350px] border-l border-border flex-shrink-0">
              <Inspector chatId={chatId} onClose={() => setShowInspector(false)} />
            </div>
          )}
        </div>
      )}
      {chatId && (
        <button
          onClick={() => setShowInspector(s => !s)}
          className="fixed bottom-4 right-4 z-40 text-text-muted hover:text-text-primary"
        >
          {showInspector ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </button>
      )}

      <CommandPalette onFocusSearch={focusChatSearch} />
      <ShortcutsHelp />
    </div>
  )
}
