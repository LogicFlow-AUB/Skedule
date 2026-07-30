import { useState } from 'react'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Dashboard from './pages/Dashboard'
import AIScheduler from './pages/AIScheduler'
import SavedSchedules from './pages/SavedSchedules'
import Reviews from './pages/Reviews'
import Community from './pages/Community'
import Profile from './pages/Profile'

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

export default function App() {
  const [activePage, setActivePage] = useState<Page>('dashboard')

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
        return <Reviews activeTab={activePage as 'course-reviews' | 'professor-reviews'} />
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
  )
}
