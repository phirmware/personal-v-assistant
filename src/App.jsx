import { useEffect, useRef, useState } from 'react'
import {
  Home as HomeIcon,
  ListTodo,
  Wallet,
  Target,
  StickyNote,
  Sparkles,
  Loader2,
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
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'insights', label: 'Insights', icon: Sparkles },
]

const PULL_TRIGGER_DISTANCE = 72
const PULL_MAX_DISTANCE = 118
const PULL_REFRESH_FEEDBACK_MS = 650

export default function App() {
  const [page, setPage] = useState('home')
  const [transitionDir, setTransitionDir] = useState('forward')
  const [tapFx, setTapFx] = useState(null)
  const [installPromptEvent, setInstallPromptEvent] = useState(null)
  const [installStatus, setInstallStatus] = useState('idle')
  const [swUpdateReady, setSwUpdateReady] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [pullReady, setPullReady] = useState(false)
  const [pullRefreshing, setPullRefreshing] = useState(false)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const navAudioCtxRef = useRef(null)
  const mainScrollRef = useRef(null)
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
    lifeStage: '',
    riskPreference: '',
    profileNotes: '',
  })

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPromptEvent(event)
    }

    const onInstalled = () => {
      setInstallStatus('installed')
      setInstallPromptEvent(null)
    }

    const onSwUpdateReady = () => {
      setSwUpdateReady(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener('va-sw-update-ready', onSwUpdateReady)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener('va-sw-update-ready', onSwUpdateReady)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mainEl = mainScrollRef.current
    if (!mainEl) return undefined

    const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches
    if (!isCoarsePointer) return undefined

    const gesture = {
      active: false,
      startY: 0,
      startX: 0,
    }

    const onTouchStart = (event) => {
      if (pullRefreshing) return
      const touch = event.touches?.[0]
      if (!touch) return
      gesture.startY = touch.clientY
      gesture.startX = touch.clientX
      gesture.active = mainEl.scrollTop <= 0
    }

    const onTouchMove = (event) => {
      if (!gesture.active || pullRefreshing) return
      const touch = event.touches?.[0]
      if (!touch) return

      const deltaY = touch.clientY - gesture.startY
      const deltaX = Math.abs(touch.clientX - gesture.startX)

      if (mainEl.scrollTop > 0 || deltaY <= 0 || deltaX > Math.abs(deltaY)) {
        setPullDistance(0)
        setPullReady(false)
        return
      }

      event.preventDefault()
      const dampedDistance = Math.min(PULL_MAX_DISTANCE, deltaY * 0.55)
      setPullDistance(dampedDistance)
      setPullReady(dampedDistance >= PULL_TRIGGER_DISTANCE)
    }

    const onTouchEnd = () => {
      if (!gesture.active || pullRefreshing) {
        setPullDistance(0)
        setPullReady(false)
        return
      }

      gesture.active = false

      if (!pullReady) {
        setPullDistance(0)
        setPullReady(false)
        return
      }

      setPullRefreshing(true)
      setPullDistance(PULL_TRIGGER_DISTANCE)
      setPullReady(false)
      if (navigator.vibrate) navigator.vibrate(12)

      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
      }

      // Ensure the user sees the refresh feedback before the reload starts.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.setTimeout(() => {
            window.location.reload()
          }, PULL_REFRESH_FEEDBACK_MS)
        })
      })
    }

    mainEl.addEventListener('touchstart', onTouchStart, { passive: true })
    mainEl.addEventListener('touchmove', onTouchMove, { passive: false })
    mainEl.addEventListener('touchend', onTouchEnd)
    mainEl.addEventListener('touchcancel', onTouchEnd)

    return () => {
      mainEl.removeEventListener('touchstart', onTouchStart)
      mainEl.removeEventListener('touchmove', onTouchMove)
      mainEl.removeEventListener('touchend', onTouchEnd)
      mainEl.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [pullReady, pullRefreshing])

  async function handleInstallApp() {
    if (!installPromptEvent) return
    setInstallStatus('prompting')
    const promptEvent = installPromptEvent
    promptEvent.prompt()
    const choice = await promptEvent.userChoice.catch(() => null)
    setInstallPromptEvent(null)
    if (choice?.outcome === 'accepted') {
      setInstallStatus('accepted')
    } else {
      setInstallStatus('dismissed')
    }
  }

  function handleRefreshForUpdate() {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
    }
    window.location.reload()
  }

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
    triggerNavFeedback()
    setTapFx(id)
    navigate(id)
    window.setTimeout(() => {
      setTapFx((prev) => (prev === id ? null : prev))
    }, 320)
  }

  function triggerNavFeedback() {
    if (typeof window === 'undefined') return
    const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches
    if (!isCoarsePointer) return

    if (navigator.vibrate) navigator.vibrate(8)

    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return

    try {
      if (!navAudioCtxRef.current) navAudioCtxRef.current = new AudioContextClass()
      const ctx = navAudioCtxRef.current
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(180, now)
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.03)

      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.055)
    } catch {
      // Ignore feedback API failures on unsupported devices/browsers.
    }
  }

  function renderPage() {
    switch (page) {
      case 'tasks':
        return <Tasks tasks={tasks} setTasks={setTasks} />
      case 'finance':
        return <Finance finances={finances} setFinances={setFinances} profile={profile} />
      case 'goals':
        return <Goals goals={goals} setGoals={setGoals} finances={finances} profile={profile} notes={notes} />
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
    <div className={`dark flex h-screen bg-gray-950 text-gray-100 app-shell page-theme-${page}`}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block h-full w-64 p-3">
        <div className="h-full rounded-3xl border border-gray-700/70 bg-gray-900/80 backdrop-blur-xl shadow-[0_12px_36px_rgba(0,0,0,0.35)] flex flex-col">
          <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-700/70">
            <Sparkles size={22} strokeWidth={2.4} className="app-accent-text" />
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
                      ? 'app-nav-active border-r-2'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="desktop-nav-icon-shell rounded-xl p-1.5">
                    <Icon
                      size={20}
                      strokeWidth={active ? 2.5 : 2.2}
                      fill={active ? 'currentColor' : 'none'}
                      fillOpacity={active ? 0.16 : 0}
                    />
                  </span>
                  <span className="desktop-nav-label">{item.label}</span>
                </button>
              )
            })}
          </nav>
          <div className="px-5 py-4 border-t border-gray-700/70 text-xs text-gray-500">
            Local-first. Your data stays on device.
          </div>
        </div>
      </aside>

      {/* Main */}
      <main ref={mainScrollRef} className="flex-1 overflow-y-auto overscroll-y-none pb-32 lg:pb-0">
        <div
          className="lg:hidden fixed top-0 inset-x-0 z-40 px-3 pb-2 pointer-events-none bg-transparent"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.1rem)' }}
        >
          <div className="mobile-topbar-shell pointer-events-auto rounded-3xl border border-gray-700/80 bg-gray-900/90 backdrop-blur shadow-[0_8px_24px_rgba(0,0,0,0.35)] px-4 py-3">
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
                className="nav-chip-enter app-accent-soft mt-0.5 text-[10px] px-2 py-1 rounded-full border shrink-0"
              >
                Active
              </span>
            </div>
          </div>
        </div>
        <div
          className="max-w-3xl mx-auto px-4 sm:px-6 pb-6 pt-[calc(env(safe-area-inset-top)+5.2rem)] lg:py-6"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className={`lg:hidden flex justify-center transition-all duration-200 overflow-hidden ${
              pullDistance > 0 || pullRefreshing ? 'max-h-14 opacity-100 mb-3' : 'max-h-0 opacity-0 mb-0'
            }`}
          >
            <div className="bg-gray-900/90 border border-gray-700 rounded-full px-3 py-1.5 flex items-center gap-2 text-[11px] text-gray-300">
              {pullRefreshing ? (
                <Loader2 size={12} className="animate-spin text-indigo-300" />
              ) : (
                <Sparkles size={12} className={pullReady ? 'text-emerald-300' : 'text-gray-400'} />
              )}
              <span className={pullRefreshing ? 'animate-pulse' : ''}>
                {pullRefreshing
                  ? 'Refreshing...'
                  : pullReady
                    ? 'Release to refresh'
                    : 'Pull to refresh'}
              </span>
            </div>
          </div>
          {swUpdateReady && (
            <div className="lg:hidden mb-3 bg-indigo-900/30 border border-indigo-700/50 rounded-xl px-3 py-2 flex items-center justify-between gap-3">
              <p className="text-xs text-indigo-200">New app update is ready.</p>
              <button
                type="button"
                onClick={handleRefreshForUpdate}
                className="app-primary-btn text-white px-3 py-1.5 rounded-lg text-xs"
              >
                Refresh
              </button>
            </div>
          )}
          {installPromptEvent && (
            <div className="lg:hidden mb-3 bg-gray-900/80 border border-gray-700 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-white font-medium">Install V-Assistant</p>
                <p className="text-[11px] text-gray-400 truncate">Add to home screen for a native feel.</p>
              </div>
              <button
                type="button"
                onClick={handleInstallApp}
                className="app-primary-btn text-white px-3 py-1.5 rounded-lg text-xs shrink-0"
              >
                {installStatus === 'prompting' ? 'Opening...' : 'Install'}
              </button>
            </div>
          )}
          {installStatus === 'accepted' && !installPromptEvent && (
            <div className="lg:hidden mb-3 bg-emerald-900/30 border border-emerald-700/40 rounded-xl px-3 py-2 text-xs text-emerald-200">
              App install started. Check your home screen.
            </div>
          )}
          <div key={page} className={`page-enter-${transitionDir}`}>
            {renderPage()}
          </div>
        </div>
      </main>

      {/* Mobile tab bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 px-3 pointer-events-none"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.7rem)' }}
      >
        <div className="pointer-events-auto rounded-3xl border border-gray-700/80 bg-gray-900/92 backdrop-blur shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
          <div className="grid grid-cols-6 gap-1.5 p-2">
            {NAV.map((item) => {
              const Icon = item.icon
              const active = page === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabTap(item.id)}
                  className={`mobile-tab-button rounded-2xl flex flex-col items-center justify-center gap-1.5 py-2.5 min-h-[58px] text-[12px] font-medium transition-all duration-200 ${
                    active ? 'is-active' : 'text-gray-400 hover:text-white'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span
                    className="tab-icon-shell relative rounded-full p-1.5 transition-all duration-200"
                  >
                    <Icon
                      size={20}
                      strokeWidth={active ? 2.5 : 2.2}
                      fill={active ? 'currentColor' : 'none'}
                      fillOpacity={active ? 0.16 : 0}
                    />
                    {tapFx === item.id && (
                      <span className="tab-ripple absolute inset-0 rounded-full border app-accent-border" />
                    )}
                    {active && (
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full app-accent-dot" />
                    )}
                  </span>
                  <span className="tab-label">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}
