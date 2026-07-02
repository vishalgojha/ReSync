import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './lib/app-context'
import { ToastContainer } from './components/ui/toast'
import MainPage from './pages/main-page'
import SettingsPage from './pages/settings'
import AutomationsPage from './pages/automations'
import AgentsPage from './pages/agents'

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/chat/:chatId" element={<MainPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/automations" element={<AutomationsPage />} />
          <Route path="/agents" element={<AgentsPage />} />
        </Routes>
        <ToastContainer />
      </AppProvider>
    </BrowserRouter>
  )
}
