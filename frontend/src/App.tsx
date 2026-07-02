import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './lib/app-context'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import MainPage from './pages/main-page'
import SettingsPage from './pages/settings'
import AutomationsPage from './pages/automations'
import AgentsPage from './pages/agents'

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <TooltipProvider>
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/chat/:chatId" element={<MainPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/automations" element={<AutomationsPage />} />
            <Route path="/agents" element={<AgentsPage />} />
          </Routes>
          <Toaster richColors closeButton />
        </TooltipProvider>
      </AppProvider>
    </BrowserRouter>
  )
}
