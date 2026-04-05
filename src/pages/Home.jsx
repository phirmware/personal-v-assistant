import { useState } from 'react'
import {
  Zap,
  Brain,
  AlertTriangle,
  TrendingUp,
  Target,
  Loader2,
  Trash2,
  PiggyBank,
  Download,
  Upload,
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
          : { name: '', birthday: '', currency: 'GBP' }
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
            : { name: '', birthday: '', currency: 'GBP' }
        )
      )

      const financeInsight = payload['va-finance-insight']
      const goalsInsight = payload['va-goals-insight']
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
    } catch (err) {
      setError(err.message || 'Failed to import snapshot.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Command Center</h1>
        <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
          <button
            onClick={handleAnalysis}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors w-full sm:w-auto"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Brain size={16} />
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

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
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

      {/* Today's Focus */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={20} className="text-yellow-400" />
          <h2 className="text-lg font-semibold text-white">Today's Focus</h2>
        </div>
        {focusTasks.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No tasks yet.{' '}
            <button
              onClick={() => setPage('tasks')}
              className="text-blue-400 hover:underline"
            >
              Add some
            </button>
          </p>
        ) : (
          <div className="space-y-2">
            {focusTasks.map((task, i) => (
              <div
                key={task.id}
                className="flex items-center gap-3 bg-gray-900/50 rounded-lg px-4 py-2.5"
              >
                <span className="text-blue-400 font-bold text-sm w-5">
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

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
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
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
          <div className="flex items-center gap-2 text-blue-400 mb-1">
            <PiggyBank size={18} />
            <span className="text-sm font-medium">Net Worth</span>
          </div>
          <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-white' : 'text-red-400'}`}>
            {netWorth.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}
          </p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
          <div className="flex items-center gap-2 text-purple-400 mb-1">
            <Target size={18} />
            <span className="text-sm font-medium">Goal Progress</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {avgGoalProgress !== null ? `${avgGoalProgress}%` : '—'}
          </p>
        </div>
      </div>

      {/* Latest AI Insight */}
      {latestInsight && (
          <div className="bg-gray-800/60 border border-blue-800/30 rounded-xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 text-blue-400 min-w-0">
              <Brain size={18} />
              <h2 className="text-base sm:text-lg font-semibold text-white">
                Latest AI Recommendation
              </h2>
            </div>
            <button
              onClick={() => setPage('insights')}
              className="text-xs text-gray-500 hover:text-blue-400 transition-colors self-start sm:self-auto"
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
  )
}
