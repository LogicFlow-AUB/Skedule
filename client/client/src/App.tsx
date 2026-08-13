import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Dashboard from './pages/Dashboard'
import AIScheduler from './pages/AIScheduler'
import SavedSchedules from './pages/SavedSchedules'
import Reviews from './pages/Reviews'
import Community from './pages/Community'
import Profile from './pages/Profile'
import { AppContext } from './context'

export type Page =
  | 'dashboard'
  | 'ai-scheduler'
  | 'manual-builder'
  | 'saved-schedules'
  | 'course-reviews'
  | 'professor-reviews'
  | 'community'
  | 'friends'       // kept for backwards-compat, resolves to community
  | 'profile'
  | 'settings'      // merged into profile

const THEMES: Record<string, { primary: string, light: string, grad: string, border: string, dark: string }> = {
  'Indigo': { primary: '#4338CA', light: '#EEF2FF', grad: '#6366F1', border: '#C7D2FE', dark: '#3730A3' },
  'Emerald': { primary: '#059669', light: '#ECFDF5', grad: '#10B981', border: '#A7F3D0', dark: '#047857' },
  'Sky': { primary: '#0284C7', light: '#F0F9FF', grad: '#38BDF8', border: '#BAE6FD', dark: '#0369A1' },
  'Violet': { primary: '#7C3AED', light: '#F5F3FF', grad: '#8B5CF6', border: '#DDD6FE', dark: '#6D28D9' },
  'Baby Pink': { primary: '#EC4899', light: '#FDF2F8', grad: '#F472B6', border: '#FBCFE8', dark: '#DB2777' },
  'Baby Blue': { primary: '#38BDF8', light: '#F0F9FF', grad: '#7DD3FC', border: '#BAE6FD', dark: '#0284C7' },
  'Navy': { primary: '#1E3A8A', light: '#EFF6FF', grad: '#1E40AF', border: '#BFDBFE', dark: '#172554' },
  'Red': { primary: '#DC2626', light: '#FEF2F2', grad: '#EF4444', border: '#FECACA', dark: '#B91C1C' }
}

export default function App() {
  const [activePage, setActivePage] = useState<Page>('dashboard')
  const [userName, setUserName] = useState('Alex Hassan')
  const [aiName, setAiName] = useState('AI Assistant')
  const [theme, setTheme] = useState('Indigo')

  const activeTheme = THEMES[theme] || THEMES['Indigo']

  useEffect(() => {
    document.documentElement.style.setProperty('--color-primary', activeTheme.primary)
    document.documentElement.style.setProperty('--color-primary-light', activeTheme.light)
    document.documentElement.style.setProperty('--color-primary-grad', activeTheme.grad)
    document.documentElement.style.setProperty('--color-primary-border', activeTheme.border)
    document.documentElement.style.setProperty('--color-primary-dark', activeTheme.dark)
  }, [theme])

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard setPage={setActivePage} />
      case 'ai-scheduler':
      case 'manual-builder':
        return <AIScheduler activeMode={activePage} setPage={setActivePage} />
      case 'saved-schedules':
        return <SavedSchedules />
      case 'course-reviews':
      case 'professor-reviews':
        return <Reviews activeTab={activePage as 'course-reviews' | 'professor-reviews'} setPage={setActivePage} />
      case 'community':
      case 'friends':
        return <Community />
      case 'profile':
      case 'settings':
        return <Profile />
      default:
        return <Dashboard setPage={setActivePage} />
    }
  }

  return (
    <AppContext.Provider value={{ userName, setUserName, aiName, setAiName, theme, setTheme }}>
      <div
        className="flex h-screen overflow-hidden"
        style={{ background: '#F8FAFC', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}
      >
        <Sidebar activePage={activePage} setActivePage={setActivePage} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar activePage={activePage} />
          <main className="flex-1 overflow-hidden">{renderPage()}</main>
        </div>
      </div>
    </AppContext.Provider>
  )
}
