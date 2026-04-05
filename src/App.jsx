import { useRef, useState } from 'react'
import {
  Home as HomeIcon,
  CheckSquare,
  DollarSign,
  Target,
  StickyNote,
  Brain,
} from 'lucide-react'
import { useLocalStorage } from './hooks/useLocalStorage'
import Home from './pages/Home'
import Tasks from './pages/Tasks'
import Finance from './pages/Finance'
import Goals from './pages/Goals'
import Notes from './pages/Notes'
import Insights from './pages/Insights'

const NAV = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'finance', label: 'Finance', icon: DollarSign },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'insights', label: 'Insights', icon: Brain },
]

export default function App() {
  const [page, setPage] = useState('home')
  const [transitionDir, setTransitionDir] = useState('forward')
  const [tapFx, setTapFx] = useState(null)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const [tasks, setTasks] = useLocalStorage('va-tasks', [])
  const [finances, setFinances] = useLocalStorage('va-finances', {
    monthlyIncome: 0,
    savingsAccounts: [],
    creditCards: [],
    investments: [],
    pensions: [],
    upcomingExpenses: [],
    monthlyContributions: [],
  })
  const [goals, setGoals] = useLocalStorage('va-goals', [])
  const [notes, setNotes] = useLocalStorage('va-notes', [])
  const [insights, setInsights] = useLocalStorage('va-insights', [])
  const [profile, setProfile] = useLocalStorage('va-profile', {
    name: '',
    birthday: '',
    currency: 'GBP',
  })

  function navigate(id) {
    if (id === page) return
    const currentIndex = NAV.findIndex((item) => item.id === page)
    const nextIndex = NAV.findIndex((item) => item.id === id)
    if (currentIndex !== -1 && nextIndex !== -1) {
      setTransitionDir(nextIndex > currentIndex ? 'forward' : 'back')
    }
    setPage(id)
  }

  const activeNav = NAV.find((item) => item.id === page) || NAV[0]

  function navigateByOffset(offset) {
    const currentIndex = NAV.findIndex((item) => item.id === page)
    const nextIndex = currentIndex + offset
    if (nextIndex < 0 || nextIndex >= NAV.length) return
    navigate(NAV[nextIndex].id)
  }

  function handleTouchStart(e) {
    const touch = e.touches?.[0] || e.changedTouches?.[0]
    if (!touch) return
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  function handleTouchEnd(e) {
    const touch = e.changedTouches?.[0] || e.touches?.[0]
    if (!touch) return

    const deltaX = touch.clientX - touchStartRef.current.x
    const deltaY = touch.clientY - touchStartRef.current.y
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (absX < 55 || absX < absY * 1.2) return

    if (deltaX < 0) {
      navigateByOffset(1)
    } else {
      navigateByOffset(-1)
    }
  }

  function handleTabTap(id) {
    setTapFx(id)
    navigate(id)
    window.setTimeout(() => {
      setTapFx((prev) => (prev === id ? null : prev))
    }, 320)
  }

  function renderPage() {
    switch (page) {
      case 'tasks':
        return <Tasks tasks={tasks} setTasks={setTasks} />
      case 'finance':
        return <Finance finances={finances} setFinances={setFinances} goals={goals} profile={profile} setProfile={setProfile} />
      case 'goals':
        return <Goals goals={goals} setGoals={setGoals} finances={finances} profile={profile} />
      case 'notes':
        return <Notes notes={notes} setNotes={setNotes} />
      case 'insights':
        return <Insights insights={insights} setInsights={setInsights} />
      default:
        return (
          <Home
            tasks={tasks}
            setTasks={setTasks}
            goals={goals}
            setGoals={setGoals}
            finances={finances}
            setFinances={setFinances}
            notes={notes}
            setNotes={setNotes}
            insights={insights}
            setInsights={setInsights}
            profile={profile}
            setProfile={setProfile}
            setPage={setPage}
          />
        )
    }
  }

  return (
    <div className="dark flex h-screen bg-gray-950 text-gray-100">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex h-full w-56 bg-gray-900 border-r border-gray-800 flex-col">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-800">
          <Brain size={24} className="text-blue-500" />
          <span className="font-bold text-lg text-white tracking-tight">
            V-Assistant
          </span>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = page === item.id
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'text-blue-300 bg-gradient-to-r from-blue-500/15 to-transparent border-r-2 border-blue-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="px-5 py-4 border-t border-gray-800 text-xs text-gray-600">
          Local-first. Your data stays on device.
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto pb-28 lg:pb-0">
        <div className="lg:hidden sticky top-0 z-20 px-3 pt-2.5 pb-2 bg-gradient-to-b from-gray-950 via-gray-950/95 to-transparent backdrop-blur-sm">
          <div className="mobile-topbar-shell rounded-3xl border border-gray-700/80 bg-gray-900/90 backdrop-blur shadow-[0_8px_24px_rgba(0,0,0,0.35)] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.12em] text-gray-500">V-Assistant</p>
                <h1
                  key={activeNav.id}
                  className="mobile-page-title-enter text-lg font-semibold text-white leading-tight"
                >
                  {activeNav.label}
                </h1>
              </div>
              <span
                key={`${activeNav.id}-chip`}
                className="nav-chip-enter mt-0.5 text-[10px] px-2 py-1 rounded-full border border-blue-800/60 bg-blue-900/20 text-blue-300 shrink-0"
              >
                Active
              </span>
            </div>
          </div>
        </div>
        <div
          className="max-w-3xl mx-auto px-4 sm:px-6 py-6"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div key={page} className={`page-enter-${transitionDir}`}>
            {renderPage()}
          </div>
        </div>
      </main>

      {/* Mobile tab bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 px-3 pointer-events-none"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.55rem)' }}
      >
        <div className="pointer-events-auto rounded-3xl border border-gray-700/80 bg-gray-900/92 backdrop-blur shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
          <div className="grid grid-cols-6 gap-1 p-1.5">
            {NAV.map((item) => {
              const Icon = item.icon
              const active = page === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabTap(item.id)}
                  className={`mobile-tab-button rounded-2xl flex flex-col items-center justify-center gap-1 py-2 text-[11px] transition-all duration-200 ${
                    active
                      ? 'text-blue-300 bg-blue-500/12'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span
                    className={`relative rounded-full p-1 transition-all duration-200 ${
                      active ? 'bg-blue-500/20 scale-105' : ''
                    }`}
                  >
                    <Icon size={17} />
                    {tapFx === item.id && (
                      <span className="tab-ripple absolute inset-0 rounded-full border border-blue-300/60" />
                    )}
                    {active && (
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-blue-400" />
                    )}
                  </span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}
