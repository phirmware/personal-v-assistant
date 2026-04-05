import { useState } from 'react'
import {
  Plus,
  Trash2,
  Target,
  Brain,
  Loader2,
  ChevronDown,
  ChevronUp,
  Wallet,
  TrendingUp,
  PiggyBank,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react'
import { runGoalsAnalysis } from '../ai'
import EmptyState from '../components/EmptyState'

const GBP = (v) =>
  (v || 0).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })

const DEFAULT_SECTION = 'Financial'

const clampPercent = (value) => Math.max(0, Math.min(100, value || 0))

function toNumber(value) {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeSection(section) {
  const text = typeof section === 'string' ? section.trim() : ''
  return text || DEFAULT_SECTION
}

function sectionKey(section) {
  return normalizeSection(section).toLowerCase()
}

function normalizeGoal(goal) {
  const target = toNumber(goal?.target)
  const current = toNumber(goal?.current)
  const progress = clampPercent(toNumber(goal?.progress))
  return {
    id: goal?.id ?? `${goal?.title || 'goal'}-${goal?.deadline || 'none'}`,
    title: typeof goal?.title === 'string' ? goal.title : '',
    target,
    current,
    progress,
    deadline: goal?.deadline || null,
    section: normalizeSection(goal?.section),
    details: typeof goal?.details === 'string' ? goal.details : '',
    notes: typeof goal?.notes === 'string' ? goal.notes : '',
    plan: typeof goal?.plan === 'string' ? goal.plan : '',
  }
}

function normalizeAiStore(raw) {
  if (!raw || typeof raw !== 'object') return { all: null, sections: {} }
  if ('all' in raw || 'sections' in raw) {
    return {
      all: raw.all || null,
      sections: raw.sections && typeof raw.sections === 'object' ? raw.sections : {},
    }
  }
  if ('goals' in raw || 'overall' in raw) return { all: raw, sections: {} }
  return { all: null, sections: {} }
}

function buildAiGoalMap(result) {
  const map = {}
  const aiGoals = result?.goals || []
  for (const aiGoal of aiGoals) {
    map[String(aiGoal.id)] = aiGoal
  }
  return map
}

function getGoalCompletion(goal) {
  if (goal.target > 0) return clampPercent((goal.current / goal.target) * 100)
  return clampPercent(goal.progress)
}

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

export default function Goals({ goals, setGoals, finances, profile, notes }) {
  const [title, setTitle] = useState('')
  const [sectionName, setSectionName] = useState(DEFAULT_SECTION)
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [details, setDetails] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [aiLoadingScope, setAiLoadingScope] = useState(null)
  const [aiError, setAiError] = useState(null)
  const [aiResult, setAiResult] = useState(() => {
    try {
      const stored = localStorage.getItem('va-goals-insight')
      return normalizeAiStore(stored ? JSON.parse(stored) : null)
    } catch {
      return { all: null, sections: {} }
    }
  })
  const normalizedGoals = goals.map(normalizeGoal)

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

  const totalGoalTarget = normalizedGoals.reduce((s, g) => s + (g.target || 0), 0)
  const avgCompletion =
    normalizedGoals.length > 0
      ? (
          normalizedGoals.reduce((sum, goal) => sum + getGoalCompletion(goal), 0) /
          normalizedGoals.length
        ).toFixed(0)
      : null

  // Group goals by section and map AI results per scope
  const groupedBySection = new Map()
  for (const goal of normalizedGoals) {
    const key = sectionKey(goal.section)
    if (!groupedBySection.has(key)) {
      groupedBySection.set(key, { key, name: goal.section, goals: [] })
    }
    groupedBySection.get(key).goals.push(goal)
  }
  const sections = Array.from(groupedBySection.values())
  const sectionNames = sections.map((s) => s.name)

  const allAiGoalMap = buildAiGoalMap(aiResult.all)
  const sectionAiGoalMaps = {}
  for (const [key, value] of Object.entries(aiResult.sections || {})) {
    sectionAiGoalMaps[key] = buildAiGoalMap(value)
  }

  function updateGoal(id, field, val) {
    setGoals((prevGoals) =>
      prevGoals.map((rawGoal) => {
        const goal = normalizeGoal(rawGoal)
        if (String(goal.id) !== String(id)) return goal
        if (field === 'target' || field === 'current') return { ...goal, [field]: toNumber(val) }
        if (field === 'progress') return { ...goal, progress: clampPercent(toNumber(val)) }
        if (field === 'section') return { ...goal, section: normalizeSection(val) }
        if (field === 'title' || field === 'deadline') return { ...goal, [field]: val }
        if (field === 'details' || field === 'notes' || field === 'plan') {
          return { ...goal, [field]: val }
        }
        return goal
      })
    )
  }

  function deleteGoal(id) {
    setGoals((prevGoals) =>
      prevGoals.map(normalizeGoal).filter((goal) => String(goal.id) !== String(id))
    )
  }

  function addGoal(e) {
    e.preventDefault()
    if (!title.trim()) return
    const newGoal = normalizeGoal({
      id: Date.now(),
      title: title.trim(),
      section: sectionName,
      details: details.trim(),
      target: toNumber(target),
      current: 0,
      progress: 0,
      deadline: deadline || null,
      notes: '',
      plan: '',
    })
    setGoals((prevGoals) => [...prevGoals.map(normalizeGoal), newGoal])
    setTitle('')
    setSectionName(DEFAULT_SECTION)
    setTarget('')
    setDeadline('')
    setDetails('')
  }

  async function handleGoalsAI(section = null) {
    const scopeKey = section ? `section:${sectionKey(section)}` : 'all'
    setAiLoadingScope(scopeKey)
    setAiError(null)
    const scopedGoals = section
      ? normalizedGoals.filter((goal) => sectionKey(goal.section) === sectionKey(section))
      : normalizedGoals

    if (scopedGoals.length === 0) {
      setAiError('No goals in this section to analyse yet.')
      setAiLoadingScope(null)
      return
    }
    try {
      const result = await runGoalsAnalysis({
        profile,
        finances,
        goals: scopedGoals,
        section,
        notes,
      })

      if (result.goals?.length) {
        setGoals((prevGoals) =>
          prevGoals.map((rawGoal) => {
            const goal = normalizeGoal(rawGoal)
            const aiGoal = result.goals.find((ag) => String(ag.id) === String(goal.id))
            if (!aiGoal) return goal
            const estimate = toNumber(aiGoal.current_estimate)
            if (goal.target > 0) return { ...goal, current: estimate }
            return { ...goal, progress: clampPercent(estimate) }
          })
        )
      }

      const storedResult = {
        ...result,
        section: section || null,
        date: new Date().toISOString(),
      }
      const merged = {
        ...aiResult,
        sections: { ...(aiResult.sections || {}) },
      }
      if (section) {
        merged.sections[sectionKey(section)] = storedResult
      } else {
        merged.all = storedResult
      }
      setAiResult(merged)
      localStorage.setItem('va-goals-insight', JSON.stringify(merged))
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoadingScope(null)
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
    const pct = getGoalCompletion(goal)
    if (pct >= 100) return 'on_track'
    if (goal.deadline) {
      const days = daysUntil(goal.deadline)
      if (days !== null && days < 0) return 'off_track'
      if (days !== null && days < 60 && pct < 50) return 'needs_work'
    }
    if (pct >= 50) return 'on_track'
    return 'needs_work'
  }

  function getGoalAi(goal, sectionId) {
    const sectionMap = sectionAiGoalMaps[sectionId] || {}
    return sectionMap[String(goal.id)] || allAiGoalMap[String(goal.id)] || null
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Goals & Plans</h1>
        <button
          onClick={() => handleGoalsAI()}
          disabled={aiLoadingScope !== null}
          className="app-primary-btn text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors self-start sm:self-auto"
        >
          {aiLoadingScope === 'all' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Brain size={16} />
          )}
          {aiLoadingScope === 'all' ? 'Analysing...' : 'Analyse All Goals'}
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
            <span className="text-xs font-medium">Financial Targets</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-white">{GBP(totalGoalTarget)}</p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-amber-400 mb-0.5">
            <TrendingUp size={14} />
            <span className="text-xs font-medium">Avg Completion</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-white">
            {avgCompletion !== null ? `${avgCompletion}%` : '—'}
          </p>
        </div>
      </div>

      {/* Overall AI strategy */}
      {aiResult.all?.overall && (
        <div className="app-accent-panel bg-purple-900/20 border border-purple-800/40 rounded-xl p-3 sm:p-4 flex gap-3">
          <Brain size={18} className="app-accent-text shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white mb-1">Overall Strategy</p>
            <p className="text-sm text-gray-300 leading-relaxed">{aiResult.all.overall}</p>
            {aiResult.all.date && (
              <p className="text-xs text-gray-600 mt-2">
                Last analysed: {new Date(aiResult.all.date).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Add goal form */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl">
        <button
          onClick={() => setAddOpen((prev) => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between text-left"
        >
          <div>
            <p className="text-sm font-semibold text-white">Add New Goal</p>
            <p className="text-xs text-gray-500">
              Keep this collapsed while reviewing existing plans.
            </p>
          </div>
          {addOpen ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </button>

        {addOpen && (
          <form
            onSubmit={addGoal}
            className="border-t border-gray-700/60 px-4 py-4 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Goal title (e.g. Learn to drive)"
                className="sm:col-span-2 lg:col-span-1 min-w-0 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
              />
              <input
                list="goal-sections"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="Section (e.g. Personal)"
                className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
              />
              <input
                type="number"
                step="any"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Target £ (optional)"
                className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
              />
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
            <datalist id="goal-sections">
              {sectionNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Details (why this goal matters, constraints, milestones...)"
              rows={2}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-y"
            />
            <button
              type="submit"
              className="app-primary-btn text-white px-4 py-2.5 rounded-lg flex items-center gap-1 transition-colors shrink-0"
            >
              <Plus size={16} />
              Add Goal
            </button>
          </form>
        )}
      </div>

      {/* Goals list */}
      {normalizedGoals.length === 0 && !aiResult.all && (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Add a goal and run AI for direction and next steps."
        />
      )}

      <div className="space-y-5">
        {sections.map((section) => {
          const sectionResult = aiResult.sections?.[section.key]
          const sectionLoadingKey = `section:${section.key}`

          return (
            <div key={section.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-semibold text-white">{section.name}</h2>
                <button
                  onClick={() => handleGoalsAI(section.name)}
                  disabled={aiLoadingScope !== null}
                  className="text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors flex items-center gap-1.5"
                >
                  {aiLoadingScope === sectionLoadingKey ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Brain size={12} />
                  )}
                  {aiLoadingScope === sectionLoadingKey ? 'Analysing...' : 'Analyse Section'}
                </button>
              </div>

              {sectionResult?.overall && (
                <div className="bg-gray-900/60 border border-purple-900/40 rounded-lg p-3 text-sm text-gray-300">
                  {sectionResult.overall}
                  {sectionResult.date && (
                    <p className="text-xs text-gray-600 mt-1">
                      Last analysed: {new Date(sectionResult.date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {section.goals.map((goal) => {
                  const pct = getGoalCompletion(goal)
                  const aiGoal = getGoalAi(goal, section.key)
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

                      {/* Goal controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                        <input
                          value={goal.section}
                          onChange={(e) => updateGoal(goal.id, 'section', e.target.value)}
                          placeholder="Section"
                          className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-blue-500"
                        />
                        {goal.target > 0 || goal.current > 0 ? (
                          <>
                            <input
                              type="number"
                              step="any"
                              value={goal.target}
                              onChange={(e) => updateGoal(goal.id, 'target', e.target.value)}
                              placeholder="Target £"
                              className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-blue-500"
                            />
                            <div className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-gray-300">
                              Current: <span className="text-white font-medium">{GBP(goal.current)}</span>
                            </div>
                          </>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={goal.progress}
                            onChange={(e) => updateGoal(goal.id, 'progress', e.target.value)}
                            placeholder="Progress %"
                            className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-blue-500"
                          />
                        )}
                        <input
                          type="date"
                          value={goal.deadline || ''}
                          onChange={(e) => updateGoal(goal.id, 'deadline', e.target.value)}
                          className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      {/* Timing / amount summaries */}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        {goal.target > 0 && remaining > 0 ? (
                          <span>
                            Need: <strong className="text-white">{GBP(remaining)}</strong>
                          </span>
                        ) : (
                          <span>
                            Progress: <strong className="text-white">{pct.toFixed(0)}%</strong>
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

                      {/* Notes & plans */}
                      <textarea
                        value={goal.details}
                        onChange={(e) => updateGoal(goal.id, 'details', e.target.value)}
                        placeholder="Details"
                        rows={2}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-y"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <textarea
                          value={goal.notes}
                          onChange={(e) => updateGoal(goal.id, 'notes', e.target.value)}
                          placeholder="Notes"
                          rows={2}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-y"
                        />
                        <textarea
                          value={goal.plan}
                          onChange={(e) => updateGoal(goal.id, 'plan', e.target.value)}
                          placeholder="Plan"
                          rows={2}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-y"
                        />
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
        })}
      </div>
    </div>
  )
}
