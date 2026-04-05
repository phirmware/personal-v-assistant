import { useState } from 'react'
import {
  Zap,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Target,
  Loader2,
  Trash2,
  PiggyBank,
  Download,
  Upload,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { runAnalysis } from '../ai'
import MarkdownContent from '../components/MarkdownContent'

export default function Home({
  tasks,
  setTasks,
  goals,
  setGoals,
  finances,
  setFinances,
  notes,
  setNotes,
  insights,
  setInsights,
  profile,
  setProfile,
  setPage,
}) {
  const clampPercent = (value) => Math.max(0, Math.min(100, value || 0))
  const toNumber = (value) => {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  const getGoalProgress = (goal) => {
    const target = toNumber(goal?.target)
    const current = toNumber(goal?.current)
    const progress = toNumber(goal?.progress)
    if (target > 0) return clampPercent((current / target) * 100)
    return clampPercent(progress)
  }

  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)
  const [openSections, setOpenSections] = useState({
    controls: false,
    alerts: true,
    focus: true,
    metrics: false,
    insight: false,
  })

  function toggleSection(key) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Determine today's focus: pinned tasks first, then top 3 by priority
  const activeTasks = tasks.filter((t) => !t.done)
  const pinned = activeTasks.filter((t) => t.pinned)
  const priorityOrder = { high: 3, medium: 2, low: 1 }
  const autoFocus = activeTasks
    .filter((t) => !t.pinned)
    .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])

  const focusTasks =
    pinned.length >= 3
      ? pinned.slice(0, 3)
      : [...pinned, ...autoFocus].slice(0, 3)

  // Finance snapshot (safe defaults for stale localStorage)
  const savingsAccounts = finances.savingsAccounts || []
  const creditCards = finances.creditCards || []
  const upcomingExpenses = finances.upcomingExpenses || []
  const investments = finances.investments || []
  const pensions = finances.pensions || []
  const totalSavings = savingsAccounts.reduce((s, a) => s + a.amount, 0)
  const totalInvested = investments.reduce((s, i) => s + i.value, 0)
  const totalPension = pensions.reduce((s, p) => s + p.value, 0)
  const totalDebt = creditCards.reduce((s, c) => s + c.balance, 0)
  const netPosition = totalSavings - totalDebt
  const netWorth = totalSavings + totalInvested + totalPension - totalDebt
  const totalUpcomingGap = upcomingExpenses.reduce((s, e) => s + e.amount, 0)

  // Goal progress
  const avgGoalProgress =
    goals.length > 0
      ? (
          goals.reduce(
            (s, g) => s + getGoalProgress(g),
            0
          ) / goals.length
        ).toFixed(0)
      : null

  // Latest insight
  const latestInsight = insights[0] || null

  // Alerts
  const alerts = []
  if (netPosition < 0)
    alerts.push({ type: 'danger', msg: 'Net position is negative — debt exceeds savings.' })
  if (totalUpcomingGap > netPosition && netPosition >= 0)
    alerts.push({ type: 'warning', msg: 'Upcoming expenses exceed your net position.' })
  const overdueExpenses = upcomingExpenses.filter(
    (e) => e.saved < e.amount && new Date(e.deadline) < new Date()
  )
  if (overdueExpenses.length > 0)
    alerts.push({ type: 'danger', msg: `${overdueExpenses.length} upcoming expense(s) are overdue.` })
  if (activeTasks.filter((t) => t.priority === 'high').length > 3)
    alerts.push({ type: 'warning', msg: 'Too many high-priority tasks. Consider trimming.' })
  if (goals.some((g) => getGoalProgress(g) < 25))
    alerts.push({ type: 'warning', msg: 'Some goals are well behind target.' })

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = (profile?.name || '').trim().split(/\s+/)[0] || 'there'
  const todayLabel = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(now)
  let age = null
  if (profile?.birthday) {
    const birth = new Date(profile.birthday)
    age = now.getFullYear() - birth.getFullYear() -
      (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0)
  }

  function updateProfile(field, value) {
    setProfile({ ...profile, [field]: value })
  }

  async function handleAnalysis() {
    setLoading(true)
    setError(null)
    try {
      const content = await runAnalysis({ tasks, goals, finances, notes })
      const newInsight = {
        id: Date.now(),
        content,
        date: new Date().toISOString(),
      }
      setInsights([newInsight, ...insights])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function clearAll() {
    if (confirm('Clear ALL data? This cannot be undone.')) {
      localStorage.clear()
      window.location.reload()
    }
  }

  function buildSnapshot() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        'va-tasks': tasks,
        'va-finances': finances,
        'va-goals': goals,
        'va-notes': notes,
        'va-insights': insights,
        'va-profile': profile,
        'va-finance-insight': localStorage.getItem('va-finance-insight'),
        'va-goals-insight': localStorage.getItem('va-goals-insight'),
        'va-notes-meta': localStorage.getItem('va-notes-meta'),
      },
    }
  }

  function handleExportSnapshot() {
    const snapshot = buildSnapshot()
    const json = JSON.stringify(snapshot, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const link = document.createElement('a')
    link.href = url
    link.download = `v-assistant-snapshot-${stamp}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function parseObjectValue(raw, fallback) {
    if (raw === null || raw === undefined) return fallback
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw)
      } catch {
        return fallback
      }
    }
    return raw
  }

  function isValidSnapshot(data) {
    if (!data || typeof data !== 'object') return false
    const payload = data.data && typeof data.data === 'object' ? data.data : data
    return (
      'va-tasks' in payload &&
      'va-finances' in payload &&
      'va-goals' in payload &&
      'va-notes' in payload &&
      'va-insights' in payload &&
      'va-profile' in payload
    )
  }

  async function handleImportSnapshot(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setImporting(true)
    setError(null)
    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw)
      if (!isValidSnapshot(parsed)) {
        throw new Error('Invalid snapshot file. Expected V-Assistant export format.')
      }
      const payload = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed

      const nextTasks = parseObjectValue(payload['va-tasks'], [])
      const nextFinances = parseObjectValue(payload['va-finances'], {
        monthlyIncome: 0,
        savingsAccounts: [],
        creditCards: [],
        investments: [],
        pensions: [],
        upcomingExpenses: [],
        monthlyContributions: [],
      })
      const nextGoals = parseObjectValue(payload['va-goals'], [])
      const nextNotes = parseObjectValue(payload['va-notes'], [])
      const nextInsights = parseObjectValue(payload['va-insights'], [])
      const nextProfile = parseObjectValue(payload['va-profile'], {
        name: '',
        birthday: '',
        currency: 'GBP',
        lifeStage: '',
        riskPreference: '',
        profileNotes: '',
      })

      setTasks(Array.isArray(nextTasks) ? nextTasks : [])
      setFinances(
        nextFinances && typeof nextFinances === 'object'
          ? nextFinances
          : {
              monthlyIncome: 0,
              savingsAccounts: [],
              creditCards: [],
              investments: [],
              pensions: [],
              upcomingExpenses: [],
              monthlyContributions: [],
            }
      )
      setGoals(Array.isArray(nextGoals) ? nextGoals : [])
      setNotes(Array.isArray(nextNotes) ? nextNotes : [])
      setInsights(Array.isArray(nextInsights) ? nextInsights : [])
      setProfile(
        nextProfile && typeof nextProfile === 'object'
          ? nextProfile
          : {
              name: '',
              birthday: '',
              currency: 'GBP',
              lifeStage: '',
              riskPreference: '',
              profileNotes: '',
            }
      )

      localStorage.setItem('va-tasks', JSON.stringify(Array.isArray(nextTasks) ? nextTasks : []))
      localStorage.setItem(
        'va-finances',
        JSON.stringify(
          nextFinances && typeof nextFinances === 'object'
            ? nextFinances
            : {
                monthlyIncome: 0,
                savingsAccounts: [],
                creditCards: [],
                investments: [],
                pensions: [],
                upcomingExpenses: [],
                monthlyContributions: [],
              }
        )
      )
      localStorage.setItem('va-goals', JSON.stringify(Array.isArray(nextGoals) ? nextGoals : []))
      localStorage.setItem('va-notes', JSON.stringify(Array.isArray(nextNotes) ? nextNotes : []))
      localStorage.setItem(
        'va-insights',
        JSON.stringify(Array.isArray(nextInsights) ? nextInsights : [])
      )
      localStorage.setItem(
        'va-profile',
        JSON.stringify(
          nextProfile && typeof nextProfile === 'object'
            ? nextProfile
            : {
                name: '',
                birthday: '',
                currency: 'GBP',
                lifeStage: '',
                riskPreference: '',
                profileNotes: '',
              }
        )
      )

      const financeInsight = payload['va-finance-insight']
      const goalsInsight = payload['va-goals-insight']
      const notesMeta = payload['va-notes-meta']
      if (typeof financeInsight === 'string') {
        localStorage.setItem('va-finance-insight', financeInsight)
      } else {
        localStorage.removeItem('va-finance-insight')
      }
      if (typeof goalsInsight === 'string') {
        localStorage.setItem('va-goals-insight', goalsInsight)
      } else {
        localStorage.removeItem('va-goals-insight')
      }
      if (typeof notesMeta === 'string') {
        localStorage.setItem('va-notes-meta', notesMeta)
      } else {
        localStorage.removeItem('va-notes-meta')
      }
    } catch (err) {
      setError(err.message || 'Failed to import snapshot.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="page-shell flex flex-col gap-6">
      {error && (
        <div className="order-0 bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="order-1 page-top-ui relative overflow-hidden rounded-2xl border border-blue-800/40 bg-gradient-to-br from-blue-900/30 via-indigo-900/20 to-gray-900/70 px-4 sm:px-5 py-4 sm:py-5">
        <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-blue-400/10 blur-2xl" />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.12em] text-blue-300/80">Welcome back</p>
          <h2 className="mt-1 text-xl sm:text-2xl font-semibold text-white">
            {greeting}, {firstName}
          </h2>
          <p className="mt-1 text-sm text-gray-300">
            {todayLabel} · {activeTasks.length} active task(s) · {alerts.length} alert(s)
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-blue-700/40 bg-blue-900/20 px-3 py-1 text-xs text-blue-200">
            <PiggyBank size={13} />
            Net worth {netWorth.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}
          </div>
        </div>
      </div>

      <section className="page-group order-6">
        <p className="page-group-kicker">Workspace</p>
        <div className="page-group-shell app-surface-sheet overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('controls')}
          className="app-section-toggle w-full px-4 sm:px-5 py-3.5 flex items-center justify-between text-left"
        >
          <div>
            <p className="text-sm sm:text-base font-semibold text-white">Profile & App Controls</p>
            <p className="text-xs text-gray-500">AI analysis, transfer data, and app reset</p>
          </div>
          {openSections.controls ? (
            <ChevronUp size={16} className="text-gray-500" />
          ) : (
            <ChevronDown size={16} className="text-gray-500" />
          )}
        </button>
        {openSections.controls && (
          <div className="border-t border-gray-700/60 px-4 sm:px-5 py-4">
            <div className="space-y-4">
              <div className="app-strip-cell p-3 sm:p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-white">Your profile</p>
                  <p className="text-xs text-gray-500">Used for Finance and Goals AI analysis context.</p>
                </div>
                <div className="input-shell grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Name</label>
                    <input
                      value={profile.name || ''}
                      onChange={(e) => updateProfile('name', e.target.value)}
                      placeholder="Your name..."
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Date of Birth {age !== null && <span className="text-indigo-400">({age} years old)</span>}
                    </label>
                    <input
                      type="date"
                      value={profile.birthday || ''}
                      onChange={(e) => updateProfile('birthday', e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>
                <div className="input-shell grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Life Stage</label>
                    <input
                      value={profile.lifeStage || ''}
                      onChange={(e) => updateProfile('lifeStage', e.target.value)}
                      placeholder="e.g. Early career, Family, Pre-retirement"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Risk Preference</label>
                    <select
                      value={profile.riskPreference || ''}
                      onChange={(e) => updateProfile('riskPreference', e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 focus:outline-none focus:border-blue-500 text-sm"
                    >
                      <option value="">Not set</option>
                      <option value="conservative">Conservative</option>
                      <option value="balanced">Balanced</option>
                      <option value="growth">Growth</option>
                      <option value="aggressive">Aggressive</option>
                    </select>
                  </div>
                </div>
                <div className="input-shell">
                  <label className="block text-xs text-gray-500 mb-1">Profile Notes</label>
                  <textarea
                    value={profile.profileNotes || ''}
                    onChange={(e) => updateProfile('profileNotes', e.target.value)}
                    placeholder="Any constraints or priorities (e.g. risk limits, major life plans)"
                    rows={2}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-y"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
                <button
                  onClick={handleAnalysis}
                  disabled={loading}
                  className="app-primary-btn text-white px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors w-full sm:w-auto"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  <span className="sm:hidden">{loading ? 'Analyzing...' : 'AI Analysis'}</span>
                  <span className="hidden sm:inline">{loading ? 'Analyzing...' : 'Run AI Analysis'}</span>
                </button>
                <button
                  onClick={handleExportSnapshot}
                  className="bg-green-700 hover:bg-green-600 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-1 text-sm transition-colors w-full sm:w-auto"
                >
                  <Download size={14} /> Export
                </button>
                <label className={`bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-1 text-sm transition-colors cursor-pointer w-full sm:w-auto ${importing ? 'opacity-70' : ''}`}>
                  <Upload size={14} /> {importing ? 'Importing...' : 'Import'}
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportSnapshot}
                    disabled={importing}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={clearAll}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-2 rounded-lg flex items-center justify-center gap-1 text-sm transition-colors w-full sm:w-auto"
                >
                  <Trash2 size={14} /> Reset
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </section>

      {/* Alerts */}
      {alerts.length > 0 && (
        <section className="page-group order-2">
          <div className="section-header-inline">
            <p className="section-header-title">Alerts</p>
            <p className="section-header-meta">Risk watch</p>
          </div>
          <div className="page-group-shell app-surface-sheet overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('alerts')}
            className="app-section-toggle w-full px-4 sm:px-5 py-3.5 flex items-center justify-between text-left"
          >
            <div>
              <p className="text-sm sm:text-base font-semibold text-white">Alerts</p>
              <p className="text-xs text-gray-500">{alerts.length} active warning(s)</p>
            </div>
            {openSections.alerts ? (
              <ChevronUp size={16} className="text-gray-500" />
            ) : (
              <ChevronDown size={16} className="text-gray-500" />
            )}
          </button>
          {openSections.alerts && (
            <div className="border-t border-gray-700/60 px-4 sm:px-5 py-3 space-y-2">
              {alerts.map((a, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded-lg px-4 py-2.5 text-sm ${
                    a.type === 'danger'
                      ? 'bg-red-900/30 border border-red-800 text-red-300'
                      : 'bg-yellow-900/30 border border-yellow-800 text-yellow-300'
                  }`}
                >
                  <AlertTriangle size={16} />
                  {a.msg}
                </div>
              ))}
            </div>
          )}
          </div>
        </section>
      )}

      {/* Today's Focus */}
      <section className="page-group order-3">
        <div className="section-header-inline">
          <p className="section-header-title">Focus</p>
          <p className="section-header-meta">Today&apos;s queue</p>
        </div>
        <div className="page-group-shell app-surface-sheet overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('focus')}
          className="app-section-toggle w-full px-4 sm:px-5 py-3.5 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Zap size={20} className="text-yellow-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold text-white">Today's Focus</h2>
              <p className="text-xs text-gray-500">
                {focusTasks.length > 0 ? `${focusTasks.length} priority task(s)` : 'No tasks yet'}
              </p>
            </div>
          </div>
          {openSections.focus ? (
            <ChevronUp size={16} className="text-gray-500" />
          ) : (
            <ChevronDown size={16} className="text-gray-500" />
          )}
        </button>
        {openSections.focus && (
          <div className="border-t border-gray-700/60 px-4 sm:px-5 py-4">
            {focusTasks.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No tasks yet.{' '}
                <button
                  onClick={() => setPage('tasks')}
                  className="app-accent-text hover:underline"
                >
                  Add some
                </button>
              </p>
            ) : (
              <div className="space-y-2">
                {focusTasks.map((task, i) => (
                  <div
                    key={task.id}
                    className="app-strip-cell flex items-center gap-3 px-4 py-2.5"
                  >
                    <span className="app-accent-text font-bold text-sm w-5">
                      {i + 1}.
                    </span>
                    <span className="text-white flex-1 text-left min-w-0 break-words">{task.title}</span>
                    <span
                      className={`text-xs font-medium uppercase shrink-0 ${
                        task.priority === 'high'
                          ? 'text-red-400'
                          : task.priority === 'medium'
                            ? 'text-yellow-400'
                            : 'text-gray-400'
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </section>

      {/* Metrics Row */}
      <section className="page-group order-5">
        <div className="section-header-inline">
          <p className="section-header-title">Snapshot</p>
          <p className="section-header-meta">Quick totals</p>
        </div>
        <div className="page-group-shell app-surface-sheet overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('metrics')}
          className="app-section-toggle w-full px-4 sm:px-5 py-3.5 flex items-center justify-between text-left"
        >
          <div>
            <p className="text-sm sm:text-base font-semibold text-white">At a glance</p>
            <p className="text-xs text-gray-500">
              {tasks.filter((t) => t.done).length}/{tasks.length} tasks done · {avgGoalProgress !== null ? `${avgGoalProgress}%` : '—'} goal progress
            </p>
          </div>
          {openSections.metrics ? (
            <ChevronUp size={16} className="text-gray-500" />
          ) : (
            <ChevronDown size={16} className="text-gray-500" />
          )}
        </button>
        {openSections.metrics && (
          <div className="border-t border-gray-700/60 px-4 sm:px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="app-grid-stat p-5">
              <div className="flex items-center gap-2 text-green-400 mb-1">
                <TrendingUp size={18} />
                <span className="text-sm font-medium">Tasks Done</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {tasks.filter((t) => t.done).length}{' '}
                <span className="text-sm text-gray-500 font-normal">
                  / {tasks.length}
                </span>
              </p>
            </div>
            <div className="app-grid-stat p-5">
              <div className="flex items-center gap-2 text-blue-400 mb-1">
                <PiggyBank size={18} />
                <span className="text-sm font-medium">Net Worth</span>
              </div>
              <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-white' : 'text-red-400'}`}>
                {netWorth.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}
              </p>
            </div>
            <div className="app-grid-stat p-5">
              <div className="flex items-center gap-2 text-purple-400 mb-1">
                <Target size={18} />
                <span className="text-sm font-medium">Goal Progress</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {avgGoalProgress !== null ? `${avgGoalProgress}%` : '—'}
              </p>
            </div>
          </div>
        )}
        </div>
      </section>

      {/* Latest AI Insight */}
      {latestInsight && (
        <section className="page-group order-4">
          <div className="section-header-inline">
            <p className="section-header-title">Guidance</p>
            <p className="section-header-meta">Latest AI recommendation</p>
          </div>
          <div className="page-group-shell app-surface-sheet app-accent-panel bg-gray-800/60 border border-blue-800/30 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('insight')}
            className="app-section-toggle w-full px-4 sm:px-5 py-3.5 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2 app-accent-text min-w-0">
              <Sparkles size={18} />
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-semibold text-white">
                  Latest AI Recommendation
                </h2>
                <p className="text-xs text-gray-500 truncate">
                  {new Date(latestInsight.date).toLocaleDateString()}
                </p>
              </div>
            </div>
            {openSections.insight ? (
              <ChevronUp size={16} className="text-gray-500" />
            ) : (
              <ChevronDown size={16} className="text-gray-500" />
            )}
          </button>
          {openSections.insight && (
            <div className="border-t border-gray-700/60 px-4 sm:px-5 py-4">
              <div className="flex justify-end mb-3">
                <button
                  onClick={() => setPage('insights')}
                  className="text-xs text-gray-500 app-accent-hover-text transition-colors"
                >
                  View All
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <MarkdownContent content={latestInsight.content} />
              </div>
            </div>
          )}
          </div>
        </section>
      )}
    </div>
  )
}
