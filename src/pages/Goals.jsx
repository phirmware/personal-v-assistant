import { useState } from 'react'
import {
  Plus,
  Trash2,
  Target,
  Brain,
  Loader2,
  Wallet,
  TrendingUp,
  PiggyBank,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react'
import { runGoalsAnalysis } from '../ai'

const GBP = (v) =>
  (v || 0).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })

const STATUS_CONFIG = {
  on_track: {
    label: 'On Track',
    icon: CheckCircle,
    badge: 'bg-green-900/40 border-green-700 text-green-400',
    bar: 'bg-green-500',
  },
  needs_work: {
    label: 'Needs Work',
    icon: AlertTriangle,
    badge: 'bg-yellow-900/40 border-yellow-700 text-yellow-400',
    bar: 'bg-yellow-500',
  },
  off_track: {
    label: 'Off Track',
    icon: XCircle,
    badge: 'bg-red-900/40 border-red-700 text-red-400',
    bar: 'bg-red-500',
  },
}

export default function Goals({ goals, setGoals, finances, profile }) {
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiResult, setAiResult] = useState(() => {
    try {
      const stored = localStorage.getItem('va-goals-insight')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  // Finance summary for context cards
  const saList = finances?.savingsAccounts || []
  const invList = finances?.investments || []
  const penList = finances?.pensions || []
  const ccList = finances?.creditCards || []
  const totalSavings = saList.reduce((s, a) => s + a.amount, 0)
  const totalInvested = invList.reduce((s, i) => s + i.value, 0)
  const totalPension = penList.reduce((s, p) => s + p.value, 0)
  const totalDebt = ccList.reduce((s, c) => s + c.balance, 0)
  const netWorth = totalSavings + totalInvested + totalPension - totalDebt

  const totalGoalTarget = goals.reduce((s, g) => s + (g.target || 0), 0)
  const totalGoalCurrent = goals.reduce((s, g) => s + (g.current || 0), 0)

  // Map AI results by goal id for quick lookup
  const aiGoalMap = {}
  if (aiResult?.goals) {
    for (const ag of aiResult.goals) {
      aiGoalMap[ag.id] = ag
    }
  }

  function addGoal(e) {
    e.preventDefault()
    if (!title.trim()) return
    setGoals([
      ...goals,
      {
        id: Date.now(),
        title: title.trim(),
        target: parseFloat(target) || 0,
        current: 0,
        deadline: deadline || null,
      },
    ])
    setTitle('')
    setTarget('')
    setDeadline('')
  }

  function updateGoal(id, field, val) {
    setGoals(
      goals.map((g) =>
        g.id === id
          ? { ...g, [field]: field === 'title' || field === 'deadline' ? val : parseFloat(val) || 0 }
          : g
      )
    )
  }

  function deleteGoal(id) {
    setGoals(goals.filter((g) => g.id !== id))
  }

  async function handleGoalsAI() {
    setAiLoading(true)
    setAiError(null)
    try {
      const result = await runGoalsAnalysis({ profile, finances, goals })

      // Auto-fill current values from AI estimates
      if (result.goals) {
        const updatedGoals = goals.map((g) => {
          const aiGoal = result.goals.find((ag) => ag.id === g.id)
          if (aiGoal && aiGoal.current_estimate > 0) {
            return { ...g, current: aiGoal.current_estimate }
          }
          return g
        })
        setGoals(updatedGoals)
      }

      const stored = { ...result, date: new Date().toISOString() }
      setAiResult(stored)
      localStorage.setItem('va-goals-insight', JSON.stringify(stored))
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoading(false)
    }
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const t = new Date(dateStr)
    t.setHours(0, 0, 0, 0)
    return Math.ceil((t - now) / (1000 * 60 * 60 * 24))
  }

  function getLocalStatus(goal) {
    const pct = goal.target > 0 ? (goal.current / goal.target) * 100 : 0
    if (pct >= 100) return 'on_track'
    if (goal.deadline) {
      const days = daysUntil(goal.deadline)
      if (days !== null && days < 0) return 'off_track'
      if (days !== null && days < 60 && pct < 50) return 'needs_work'
    }
    if (pct >= 50) return 'on_track'
    return 'needs_work'
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Financial Goals</h1>
        <button
          onClick={handleGoalsAI}
          disabled={aiLoading}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors self-start sm:self-auto"
        >
          {aiLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Brain size={16} />
          )}
          {aiLoading ? 'Analysing...' : 'Analyse Goals'}
        </button>
      </div>

      {aiError && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 sm:p-4 text-red-300 text-sm">
          {aiError}
        </div>
      )}

      {/* Financial context strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-green-400 mb-0.5">
            <PiggyBank size={14} />
            <span className="text-xs font-medium">Net Worth</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-white">{GBP(netWorth)}</p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-blue-400 mb-0.5">
            <Wallet size={14} />
            <span className="text-xs font-medium">Liquid</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-white">{GBP(totalSavings)}</p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-purple-400 mb-0.5">
            <Target size={14} />
            <span className="text-xs font-medium">Goals Total</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-white">{GBP(totalGoalTarget)}</p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-amber-400 mb-0.5">
            <TrendingUp size={14} />
            <span className="text-xs font-medium">Progress</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-white">
            {totalGoalTarget > 0
              ? `${Math.min(100, (totalGoalCurrent / totalGoalTarget) * 100).toFixed(0)}%`
              : '—'}
          </p>
        </div>
      </div>

      {/* Overall AI strategy */}
      {aiResult?.overall && (
        <div className="bg-purple-900/20 border border-purple-800/40 rounded-xl p-3 sm:p-4 flex gap-3">
          <Brain size={18} className="text-purple-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white mb-1">Strategy</p>
            <p className="text-sm text-gray-300 leading-relaxed">{aiResult.overall}</p>
            {aiResult.date && (
              <p className="text-xs text-gray-600 mt-2">
                Last analysed: {new Date(aiResult.date).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Add goal form */}
      <form onSubmit={addGoal} className="flex flex-col sm:flex-row gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Goal (e.g. Emergency fund, House deposit)..."
          className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
        />
        <div className="flex gap-2">
          <input
            type="number"
            step="any"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Target £..."
            className="flex-1 sm:w-28 sm:flex-none bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
          />
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="flex-1 sm:flex-none bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
          />
          <button
            type="submit"
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-lg flex items-center gap-1 transition-colors shrink-0"
          >
            <Plus size={16} />
          </button>
        </div>
      </form>

      {/* Goals list */}
      {goals.length === 0 && !aiResult && (
        <p className="text-gray-500 text-center py-8 text-sm">
          No goals yet. Add one above, then run the AI analysis.
        </p>
      )}

      <div className="space-y-3">
        {goals.map((goal) => {
          const pct = goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0
          const aiGoal = aiGoalMap[goal.id]
          const status = aiGoal?.status || getLocalStatus(goal)
          const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.needs_work
          const StatusIcon = cfg.icon
          const days = goal.deadline ? daysUntil(goal.deadline) : null
          const remaining = Math.max(0, (goal.target || 0) - (goal.current || 0))

          return (
            <div
              key={goal.id}
              className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 sm:p-5 group space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Target size={18} className="text-purple-400 shrink-0" />
                  <input
                    value={goal.title}
                    onChange={(e) => updateGoal(goal.id, 'title', e.target.value)}
                    className="bg-transparent text-white font-semibold text-sm min-w-0 flex-1 focus:outline-none focus:bg-gray-900 focus:rounded px-1 -ml-1"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${cfg.badge}`}>
                    <StatusIcon size={12} />
                    <span className="hidden sm:inline">{cfg.label}</span>
                  </span>
                  <button
                    onClick={() => deleteGoal(goal.id)}
                    className="text-gray-600 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-900 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-400 w-12 text-right">
                  {pct.toFixed(0)}%
                </span>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 sm:flex sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 text-xs">Current</span>
                  <input
                    type="number"
                    step="any"
                    value={goal.current}
                    onChange={(e) => updateGoal(goal.id, 'current', e.target.value)}
                    className="w-full sm:w-24 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 text-xs">Target</span>
                  <input
                    type="number"
                    step="any"
                    value={goal.target}
                    onChange={(e) => updateGoal(goal.id, 'target', e.target.value)}
                    className="w-full sm:w-24 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                  <span className="text-gray-500 text-xs">By</span>
                  <input
                    type="date"
                    value={goal.deadline || ''}
                    onChange={(e) => updateGoal(goal.id, 'deadline', e.target.value)}
                    className="flex-1 sm:flex-none bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="hidden sm:flex items-center gap-3 ml-auto text-xs text-gray-500">
                  {remaining > 0 && (
                    <span>
                      Need: <strong className="text-white">{GBP(remaining)}</strong>
                    </span>
                  )}
                  {days !== null && (
                    <span
                      className={
                        days < 0
                          ? 'text-red-400'
                          : days < 60
                            ? 'text-yellow-400'
                            : ''
                      }
                    >
                      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                    </span>
                  )}
                </div>
              </div>

              {/* Mobile: remaining + days */}
              <div className="flex sm:hidden items-center justify-between text-xs text-gray-500">
                {remaining > 0 && (
                  <span>
                    Need: <strong className="text-white">{GBP(remaining)}</strong>
                  </span>
                )}
                {days !== null && (
                  <span
                    className={
                      days < 0 ? 'text-red-400' : days < 60 ? 'text-yellow-400' : ''
                    }
                  >
                    {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                  </span>
                )}
              </div>

              {/* AI insight for this goal */}
              {aiGoal && (
                <div className="bg-gray-900/60 rounded-lg px-3 py-2.5 space-y-1 border-l-2 border-purple-500/50">
                  <p className="text-sm text-gray-300">{aiGoal.summary}</p>
                  <p className="text-sm text-purple-300 font-medium">{aiGoal.action}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
