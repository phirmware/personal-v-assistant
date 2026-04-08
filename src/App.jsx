import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Home as HomeIcon,
  ListTodo,
  Wallet,
  Target,
  StickyNote,
  Sparkles,
  Loader2,
  Eye,
  EyeOff,
  Bell,
  BellOff,
} from 'lucide-react'
import { useLocalStorage } from './hooks/useLocalStorage'
import Home from './pages/Home'
import Tasks from './pages/Tasks'
import Finance from './pages/Finance'
import Goals from './pages/Goals'
import Notes from './pages/Notes'
import Insights from './pages/Insights'
import ToastContainer from './components/Toast'
import { useToast } from './hooks/useToast'
import {
  checkAllReminders,
  requestNotificationPermission,
  getNotificationSettings,
  saveNotificationSettings,
  isNotificationSupported,
} from './utils/notifications'
import NotificationBanner from './components/NotificationBanner'

function getAmbientClass() {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 10) return 'ambient-morning'
  if (hour >= 10 && hour < 17) return 'ambient-day'
  if (hour >= 17 && hour < 21) return 'ambient-evening'
  return 'ambient-night'
}

function useSectionMemory(storageKey) {
  const [sections, setSections] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })

  const toggle = useCallback((key, defaultOpen = false) => {
    setSections((prev) => {
      const current = key in prev ? prev[key] : defaultOpen
      const next = { ...prev, [key]: !current }
      localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }, [storageKey])

  const isOpen = useCallback((key, defaultOpen = false) => {
    return key in sections ? sections[key] : defaultOpen
  }, [sections])

  return { isOpen, toggle }
}

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
  const [privacyMode, setPrivacyMode] = useState(() => {
    try { return localStorage.getItem('va-privacy') !== 'off' } catch { return true }
  })
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => getNotificationSettings().enabled)
  const [activeNotifications, setActiveNotifications] = useState([])
  const [ambientClass, setAmbientClass] = useState(getAmbientClass)
  const { toasts, show: showToast, dismiss: dismissToast } = useToast()
  const homeSections = useSectionMemory('va-sections-home')
  const financeSections = useSectionMemory('va-sections-finance')
  const goalsSections = useSectionMemory('va-sections-goals')
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
    const interval = setInterval(() => setAmbientClass(getAmbientClass()), 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!notificationsEnabled) return
    function runCheck() {
      const fired = checkAllReminders(tasks)
      if (fired.length > 0) {
        setActiveNotifications(fired)
      }
    }
    runCheck()
    const interval = setInterval(runCheck, 60 * 1000)
    return () => clearInterval(interval)
  }, [notificationsEnabled, tasks])

  useEffect(() => {
    if (!navigator.serviceWorker) return
    function onSwMessage(event) {
      const data = event.data
      if (data?.type !== 'NOTIFICATION_ACTION') return
      if (data.action === 'done') {
        // Try to find task by matching the tag (contains task id)
        const matchingTask = tasks.find((t) => data.tag?.includes(String(t.id)))
        if (matchingTask) {
          setTasks((prev) => prev.map((t) => t.id === matchingTask.id ? { ...t, done: true } : t))
        }
      }
    }
    navigator.serviceWorker.addEventListener('message', onSwMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage)
  }, [tasks, setTasks])

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

  function togglePrivacy() {
    setPrivacyMode((prev) => {
      const next = !prev
      localStorage.setItem('va-privacy', next ? 'on' : 'off')
      return next
    })
  }

  async function toggleNotifications() {
    if (notificationsEnabled) {
      setNotificationsEnabled(false)
      saveNotificationSettings({ enabled: false })
      showToast('Notifications disabled', { type: 'default', duration: 2500 })
      return
    }
    if (!isNotificationSupported()) {
      showToast('Notifications not supported in this browser', { type: 'danger', duration: 3000 })
      return
    }
    const permission = await requestNotificationPermission()
    if (permission === 'granted') {
      setNotificationsEnabled(true)
      saveNotificationSettings({ enabled: true })
      showToast('Notifications enabled — you\'ll get task reminders', { type: 'success', duration: 3000 })
    } else if (permission === 'denied') {
      showToast('Notification permission denied — enable in browser settings', { type: 'danger', duration: 4000 })
    } else {
      showToast('Notifications not available', { type: 'danger', duration: 3000 })
    }
  }

  function handleNotifDismiss() {}

  function handleNotifMarkDone(notification) {
    const taskId = notification.task?.id
    if (!taskId) return
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, done: true } : t))
    showToast('Task completed', { type: 'success', duration: 2500 })
  }

  function handleNotifSnooze(notification) {
    const taskId = notification.task?.id
    if (!taskId) return
    // Reset the interval timer by clearing the notified entry so it re-fires in 15m
    try {
      const raw = localStorage.getItem('va-notified')
      const parsed = raw ? JSON.parse(raw) : {}
      const snoozeKey = `snooze-${taskId}`
      parsed[snoozeKey] = Date.now()
      // Remove the interval key so it fires again after 15 min
      delete parsed[`interval-${taskId}`]
      localStorage.setItem('va-notified', JSON.stringify(parsed))
    } catch { /* ignore */ }
    showToast('Snoozed for 15 minutes', { type: 'default', duration: 2500 })
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
        return <Tasks tasks={tasks} setTasks={setTasks} showToast={showToast} />
      case 'finance':
        return <Finance finances={finances} setFinances={setFinances} profile={profile} privacyMode={privacyMode} showToast={showToast} sectionMemory={financeSections} />
      case 'goals':
        return (
          <Goals
            goals={goals}
            setGoals={setGoals}
            finances={finances}
            profile={profile}
            notes={notes}
            tasks={tasks}
            setTasks={setTasks}
            privacyMode={privacyMode}
            showToast={showToast}
            sectionMemory={goalsSections}
          />
        )
      case 'notes':
        return <Notes notes={notes} setNotes={setNotes} showToast={showToast} />
      case 'insights':
        return <Insights insights={insights} setInsights={setInsights} showToast={showToast} />
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
            privacyMode={privacyMode}
            showToast={showToast}
            sectionMemory={homeSections}
          />
        )
    }
  }

  return (
    <div className={`dark flex h-screen bg-gray-950 text-gray-100 app-shell page-theme-${page} ${ambientClass}`}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block h-full w-60 p-3">
        <div className="h-full rounded-2xl bg-white/[0.02] backdrop-blur-xl flex flex-col">
          <div className="flex items-center gap-2.5 px-5 py-5">
            <Sparkles size={20} strokeWidth={2.4} className="app-accent-text" />
            <span className="font-bold text-base text-white tracking-tight">
              V-Assistant
            </span>
          </div>
          <div className="mx-4 h-px bg-white/[0.04]" />
          <nav className="flex-1 py-3 px-2">
            {NAV.map((item) => {
              const Icon = item.icon
              const active = page === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                    active
                      ? 'app-nav-active'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="desktop-nav-icon-shell rounded-lg p-1.5">
                    <Icon
                      size={18}
                      strokeWidth={active ? 2.4 : 2}
                      fill={active ? 'currentColor' : 'none'}
                      fillOpacity={active ? 0.15 : 0}
                    />
                  </span>
                  <span className="desktop-nav-label">{item.label}</span>
                </button>
              )
            })}
          </nav>
          <div className="px-3 py-4 flex items-center justify-between">
            <span className="text-[11px] text-slate-600 px-2">Local-first · On device</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleNotifications}
                className={`p-1.5 rounded-lg transition-all text-xs flex items-center gap-1.5 ${notificationsEnabled ? 'bg-indigo-500/15 text-indigo-300' : 'text-gray-600 hover:text-gray-400 hover:bg-white/[0.03]'}`}
                title={notificationsEnabled ? 'Notifications on' : 'Enable notifications'}
              >
                {notificationsEnabled ? <Bell size={14} /> : <BellOff size={14} />}
              </button>
              <button
                type="button"
                onClick={togglePrivacy}
                className={`p-1.5 rounded-lg transition-all text-xs flex items-center gap-1.5 ${privacyMode ? 'bg-amber-500/15 text-amber-300' : 'text-gray-600 hover:text-gray-400 hover:bg-white/[0.03]'}`}
                title={privacyMode ? 'Privacy mode on' : 'Enable privacy mode'}
              >
                {privacyMode ? <EyeOff size={14} /> : <Eye size={14} />}
                <span className="hidden xl:inline">{privacyMode ? 'Private' : 'Privacy'}</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main ref={mainScrollRef} className="flex-1 overflow-y-auto overscroll-y-none pb-28 lg:pb-0">
        <div
          className="lg:hidden fixed top-0 inset-x-0 z-40 px-4 pb-1.5 pointer-events-none"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.25rem)' }}
        >
          <div
            className={`mobile-topbar-shell pointer-events-auto rounded-2xl bg-[#080a12]/90 backdrop-blur-2xl px-4 py-2.5 ${
              pullRefreshing ? 'is-refreshing' : ''
            }`}
          >
            {pullRefreshing && <span aria-hidden="true" className="mobile-topbar-refresh-wave" />}
            <div className="relative z-[1] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[0.18em] text-slate-600 font-bold">V-Assistant</p>
                <h1
                  key={activeNav.id}
                  className="mobile-page-title-enter text-[22px] font-extrabold text-white leading-tight tracking-[-0.03em]"
                >
                  {activeNav.label}
                </h1>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={toggleNotifications}
                  className={`p-1.5 rounded-full transition-all ${notificationsEnabled ? 'bg-indigo-500/15 text-indigo-300' : 'text-gray-600 hover:text-gray-400'}`}
                  title={notificationsEnabled ? 'Notifications on' : 'Enable notifications'}
                >
                  {notificationsEnabled ? <Bell size={16} strokeWidth={2} /> : <BellOff size={16} strokeWidth={1.6} />}
                </button>
                <button
                  type="button"
                  onClick={togglePrivacy}
                  className={`p-1.5 rounded-full transition-all ${privacyMode ? 'bg-amber-500/15 text-amber-300' : 'text-gray-600 hover:text-gray-400'}`}
                  title={privacyMode ? 'Privacy mode on — tap to show values' : 'Tap to hide sensitive values'}
                >
                  {privacyMode ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={1.6} />}
                </button>
                <span
                  key={`${activeNav.id}-chip`}
                  className="nav-chip-enter app-accent-soft text-[9px] font-bold px-2 py-0.5 rounded-full"
                >
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
        <div
          className="max-w-3xl mx-auto px-4 sm:px-6 pb-6 pt-[calc(env(safe-area-inset-top)+5rem)] lg:py-6"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className={`lg:hidden flex justify-center transition-all duration-200 overflow-hidden ${
              pullDistance > 0 || pullRefreshing ? 'max-h-14 opacity-100 mb-3' : 'max-h-0 opacity-0 mb-0'
            }`}
          >
            <div className="bg-white/[0.04] rounded-full px-3 py-1.5 flex items-center gap-2 text-[11px] text-slate-400">
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
            <div className="lg:hidden mb-3 bg-indigo-500/8 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3">
              <p className="text-xs text-indigo-300">New app update is ready.</p>
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
            <div className="lg:hidden mb-3 bg-white/[0.03] rounded-xl px-3 py-2.5 flex items-center justify-between gap-3">
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
            <div className="lg:hidden mb-3 bg-emerald-500/8 rounded-xl px-3 py-2.5 text-xs text-emerald-300">
              App install started. Check your home screen.
            </div>
          )}
          <div key={page} className={`page-enter-${transitionDir}`}>
            {renderPage()}
          </div>
        </div>
      </main>

      <NotificationBanner
        notifications={activeNotifications}
        onDismiss={handleNotifDismiss}
        onMarkDone={handleNotifMarkDone}
        onSnooze={handleNotifSnooze}
      />
      <ToastContainer toasts={toasts} dismiss={dismissToast} />

      {/* Mobile tab bar */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 px-4 pointer-events-none"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      >
        <div className="pointer-events-auto rounded-2xl bg-[#080a12]/88 backdrop-blur-2xl">
          <div className="grid grid-cols-6 px-1 py-1">
            {NAV.map((item) => {
              const Icon = item.icon
              const active = page === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabTap(item.id)}
                  className={`mobile-tab-button rounded-xl flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-all duration-200 ${
                    active ? 'is-active' : 'text-slate-600 active:text-slate-400'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span
                    className="tab-icon-shell relative rounded-full p-1.5 transition-all duration-200"
                  >
                    <Icon
                      size={20}
                      strokeWidth={active ? 2.4 : 1.8}
                      fill={active ? 'currentColor' : 'none'}
                      fillOpacity={active ? 0.15 : 0}
                    />
                    {tapFx === item.id && (
                      <span className="tab-ripple absolute inset-0 rounded-full border app-accent-border" />
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
