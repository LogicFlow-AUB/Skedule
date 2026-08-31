import { Component, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Dashboard from './pages/Dashboard'
import AIScheduler from './pages/AIScheduler'
import SavedSchedules from './pages/SavedSchedules'
import Reviews from './pages/Reviews'
import Community from './pages/Community'
import CommonFreeTime from './pages/CommonFreeTime'
import StudyGroupsPage from './pages/StudyGroups'
import Profile from './pages/Profile'
import Login from './pages/Login'
import { AuthProvider, useAuth } from './lib/auth'

export type Page =
  | 'dashboard'
  | 'ai-scheduler'
  | 'manual-builder'
  | 'saved-schedules'
  | 'course-reviews'
  | 'professor-reviews'
  | 'community'
  | 'study-groups'
  | 'common-free-time'
  | 'friends'       // kept for backwards-compat, resolves to community
  | 'profile'
  | 'settings'      // merged into profile

const PAGE_PATHS: Record<Page, string> = {
  dashboard: '/dashboard', 'ai-scheduler': '/optimized-builder', 'manual-builder': '/manual-builder',
  'saved-schedules': '/saved-schedules', 'course-reviews': '/course-reviews',
  'professor-reviews': '/professor-reviews', community: '/community',
  'study-groups': '/study-groups', 'common-free-time': '/common-free-time',
  friends: '/community', profile: '/profile', settings: '/profile',
}

function pageFromPath(pathname: string): Page {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
  const match = Object.entries(PAGE_PATHS).find(([, route]) => route === path)
  return (match?.[0] as Page | undefined) ?? 'dashboard'
}

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <AppGate />
      </ErrorBoundary>
    </AuthProvider>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-screen flex items-center justify-center p-8" style={{ background: '#F8FAFC' }}>
          <div className="max-w-xl w-full rounded-2xl p-6" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#B91C1C', marginBottom: 8 }}>The app crashed</p>
            <pre style={{ fontSize: 12, color: '#7F1D1D', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {String(this.state.error?.message ?? this.state.error)}
            </pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function AppGate() {
  const { user, initializing } = useAuth()
  const [activePage, setActivePage] = useState<Page>(() => pageFromPath(window.location.pathname))
  const navigateToPage = useCallback((page: Page) => {
    const destination: Page = page === 'friends' ? 'community' : page === 'settings' ? 'profile' : page
    const path = PAGE_PATHS[destination]
    if (window.location.pathname !== path) window.history.pushState({ page: destination }, '', path)
    setActivePage(destination)
  }, [])

  useEffect(() => {
    const handlePopState = () => setActivePage(pageFromPath(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  if (initializing) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#F8FAFC' }}>
        <div className="rounded-xl p-3" style={{ background: 'var(--color-primary-grad, linear-gradient(135deg, #7f1d2d 0%, #8b1e2d 100%))' }} />
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard setPage={navigateToPage} />
      case 'ai-scheduler':
      case 'manual-builder':
        return <AIScheduler activeMode={activePage} setPage={navigateToPage} />
      case 'saved-schedules':
        return <SavedSchedules setPage={navigateToPage} />
      case 'course-reviews':
      case 'professor-reviews':
        return <Reviews activeTab={activePage as 'course-reviews' | 'professor-reviews'} />
      case 'community':
      case 'friends':
        return <Community />
      case 'study-groups':
        return <StudyGroupsPage />
      case 'common-free-time':
        return <CommonFreeTime />
      case 'profile':
      case 'settings':
        return <Profile />
      default:
        return <Dashboard setPage={navigateToPage} />
    }
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: '#F8FAFC', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}
    >
      <Sidebar activePage={activePage} setActivePage={navigateToPage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar activePage={activePage} />
        <main className="flex-1 overflow-hidden">{renderPage()}</main>
      </div>
    </div>
  )
}
