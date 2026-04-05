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
} from 'lucide-react'
import { runAnalysis } from '../ai'

export default function Home({
  tasks,
  goals,
  finances,
  notes,
  insights,
  setInsights,
  setPage,
}) {
  const [loading, setLoading] = useState(false)
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
            (s, g) =>
              s + (g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0),
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
  if (goals.some((g) => g.target > 0 && g.current / g.target < 0.25))
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Command Center</h1>
        <div className="flex gap-2">
          <button
            onClick={handleAnalysis}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Brain size={16} />
            )}
            {loading ? 'Analyzing...' : 'Run AI Analysis'}
          </button>
          <button
            onClick={clearAll}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-2 rounded-lg flex items-center gap-1 text-sm transition-colors"
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
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${
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
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5">
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
                <span className="text-white flex-1 text-left">{task.title}</span>
                <span
                  className={`text-xs font-medium uppercase ${
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
        <div className="bg-gray-800/60 border border-blue-800/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-blue-400">
              <Brain size={18} />
              <h2 className="text-lg font-semibold text-white">
                Latest AI Recommendation
              </h2>
            </div>
            <button
              onClick={() => setPage('insights')}
              className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
            >
              View All
            </button>
          </div>
          <div className="text-gray-300 text-sm whitespace-pre-wrap text-left leading-relaxed max-h-64 overflow-y-auto">
            {latestInsight.content}
          </div>
        </div>
      )}
    </div>
  )
}
