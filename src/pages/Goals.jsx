import { useState } from 'react'
import {
  Plus,
  Trash2,
  Target,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Wallet,
  TrendingUp,
  PiggyBank,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ListTodo,
} from 'lucide-react'
import { runGoalTaskPlanner, runGoalsAnalysis } from '../ai'
import EmptyState from '../components/EmptyState'
import SkeletonBlock from '../components/SkeletonBlock'
import { smartDefaultDate } from '../utils/time'

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
    updates: typeof goal?.updates === 'string' ? goal.updates : '',
  }
}

function updatesSuggestCompletion(updates) {
  const text = String(updates || '').toLowerCase()
  if (!text.trim()) return false
  return [
    'done',
    'completed',
    'complete',
    'finished',
    'submitted',
    'paid',
    'booked',
    'passed',
    'achieved',
  ].some((word) => text.includes(word))
}

function toDateOnly(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().split('T')[0]
}

function clampTaskCompleteAt(rawValue, today, goalDeadline) {
  const parsed = toDateOnly(rawValue)
  const normalizedToday = toDateOnly(today) || today
  if (!parsed) return normalizedToday
  const plusOne = new Date(`${normalizedToday}T00:00:00`)
  plusOne.setDate(plusOne.getDate() + 1)
  const tomorrow = plusOne.toISOString().split('T')[0]
  const maxByDefault = tomorrow
  const deadlineDate = toDateOnly(goalDeadline)
  const maxDate = deadlineDate && deadlineDate < maxByDefault ? deadlineDate : maxByDefault
  if (parsed < normalizedToday) return normalizedToday
  if (parsed > maxDate) return maxDate
  return parsed
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
    badge: 'bg-emerald-500/12 text-emerald-400',
    bar: 'bg-emerald-500',
    color: '#34d399',
  },
  needs_work: {
    label: 'Needs Work',
    icon: AlertTriangle,
    badge: 'bg-amber-500/12 text-amber-400',
    bar: 'bg-amber-500',
    color: '#fbbf24',
  },
  off_track: {
    label: 'Off Track',
    icon: XCircle,
    badge: 'bg-red-500/12 text-red-400',
    bar: 'bg-red-500',
    color: '#f87171',
  },
}

export default function Goals({ goals, setGoals, finances, profile, notes, tasks, setTasks, privacyMode, showToast, sectionMemory }) {
  const [title, setTitle] = useState('')
  const [sectionName, setSectionName] = useState(DEFAULT_SECTION)
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState(() => smartDefaultDate(90))
  const [details, setDetails] = useState('')
  const addOpen = sectionMemory?.isOpen('addGoal', false) ?? false
  const setAddOpen = () => sectionMemory?.toggle('addGoal', false)
  const [aiLoadingScope, setAiLoadingScope] = useState(null)
  const [taskSyncLoadingScope, setTaskSyncLoadingScope] = useState(null)
  const [aiError, setAiError] = useState(null)
  const [sectionOpenMap, setSectionOpenMap] = useState({})
  const [goalOpenMap, setGoalOpenMap] = useState({})
  const [aiResult, setAiResult] = useState(() => {
    try {
      const stored = localStorage.getItem('va-goals-insight')
      return normalizeAiStore(stored ? JSON.parse(stored) : null)
    } catch {
      return { all: null, sections: {} }
    }
  })
  const normalizedGoals = goals.map(normalizeGoal)
  const goalTaskMap = new Map(
    (tasks || [])
      .filter((task) => task?.source === 'goal-ai' && task?.goalId !== undefined && task?.goalId !== null)
      .map((task) => [String(task.goalId), task])
  )

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
        if (field === 'details' || field === 'notes' || field === 'plan' || field === 'updates') {
          return { ...goal, [field]: val }
        }
        return goal
      })
    )
  }

  function deleteGoal(id) {
    const deleted = goals.find((g) => String(g.id) === String(id))
    setGoals((prevGoals) =>
      prevGoals.map(normalizeGoal).filter((goal) => String(goal.id) !== String(id))
    )
    if (deleted) {
      showToast?.(`Deleted "${deleted.title || 'goal'}"`, {
        type: 'danger',
        duration: 5000,
        onUndo: () => setGoals((prev) => [...prev, deleted]),
      })
    }
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
      updates: '',
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

  async function handleGoalTasksAI(section = null) {
    const scopeKey = section ? `section:${sectionKey(section)}:tasks` : 'all:tasks'
    setTaskSyncLoadingScope(scopeKey)
    setAiError(null)
    const scopedGoals = section
      ? normalizedGoals.filter((goal) => sectionKey(goal.section) === sectionKey(section))
      : normalizedGoals

    if (scopedGoals.length === 0) {
      setAiError('No goals in this section to create tasks for yet.')
      setTaskSyncLoadingScope(null)
      return
    }

    try {
      const todayDate = new Date().toISOString().split('T')[0]
      const existingGoalTasks = (tasks || []).filter((task) =>
        task?.source === 'goal-ai' &&
        task?.goalId !== undefined &&
        task?.goalId !== null &&
        scopedGoals.some((goal) => String(goal.id) === String(task.goalId))
      )

      const plan = await runGoalTaskPlanner({
        profile,
        finances,
        goals: scopedGoals,
        existingTasks: existingGoalTasks,
        section,
        notes,
      })

      const actionsByGoalId = new Map(
        (plan?.tasks || []).map((item) => [String(item.goal_id), item])
      )

      setTasks((prevTasks) => {
        const next = [...prevTasks]
        const goalIndexById = new Map()
        next.forEach((task, index) => {
          if (task?.source === 'goal-ai' && task?.goalId !== undefined && task?.goalId !== null) {
            goalIndexById.set(String(task.goalId), index)
          }
        })

        for (const goal of scopedGoals) {
          const key = String(goal.id)
          const action = actionsByGoalId.get(key)
          if (!action) continue
          const existingIndex = goalIndexById.has(key) ? goalIndexById.get(key) : -1
          const existing = existingIndex >= 0 ? next[existingIndex] : null
          const mode = action.mode

          if (mode === 'keep') continue

          if (mode === 'mark_done') {
            if (existingIndex >= 0 && existing && !existing.done) {
              next[existingIndex] = {
                ...existing,
                done: true,
                updatedAt: new Date().toISOString(),
              }
            }
            continue
          }

          if (mode !== 'create_or_update') continue

          const title = String(action.title || '').trim()
          if (!title) continue

          const detailsBits = [
            String(action.details || '').trim(),
            goal.deadline ? `Goal deadline: ${goal.deadline}` : '',
            Number.isFinite(goal.target) && goal.target > 0
              ? `Goal progress: ${Math.round(getGoalCompletion(goal))}% (${GBP(goal.current)} / ${GBP(goal.target)})`
              : `Goal progress: ${Math.round(getGoalCompletion(goal))}%`,
            goal.updates ? `Goal updates: ${goal.updates}` : '',
            String(action.reason || '').trim() ? `AI rationale: ${String(action.reason || '').trim()}` : '',
          ].filter(Boolean)
          const mergedDetails = detailsBits.join('\n')
          const completeAt = clampTaskCompleteAt(action.complete_at, todayDate, goal.deadline)
          const priority = ['low', 'medium', 'high'].includes(action.priority) ? action.priority : 'medium'
          const inferredDone = updatesSuggestCompletion(existing?.updates)

          if (existingIndex >= 0 && existing) {
            const preserveUpdates = typeof existing.updates === 'string' ? existing.updates : ''
            next[existingIndex] = {
              ...existing,
              title,
              details: mergedDetails,
              updates: preserveUpdates,
              priority,
              completeAt,
              done: inferredDone ? true : false,
              updatedAt: new Date().toISOString(),
            }
          } else {
            next.push({
              id: Date.now() + Math.floor(Math.random() * 100000),
              title,
              details: mergedDetails,
              priority,
              done: false,
              pinned: false,
              aiSuggestion: '',
              source: 'goal-ai',
              goalId: goal.id,
              updates: '',
              completeAt,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
          }
        }

        return next
      })
    } catch (err) {
      setAiError(err.message)
    } finally {
      setTaskSyncLoadingScope(null)
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

  function isSectionOpen(key) {
    if (Object.prototype.hasOwnProperty.call(sectionOpenMap, key)) {
      return sectionOpenMap[key]
    }
    return false
  }

  function toggleSection(key) {
    setSectionOpenMap((prev) => {
      const current = Object.prototype.hasOwnProperty.call(prev, key)
        ? prev[key]
        : false
      return { ...prev, [key]: !current }
    })
  }

  function isGoalOpen(key) {
    return Boolean(goalOpenMap[key])
  }

  function toggleGoal(key) {
    setGoalOpenMap((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="page-shell flex flex-col gap-5 sm:gap-6 stagger-reveal">
      <section className="order-0 page-top-ui">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="page-top-ui-kicker">Goals Planner</p>
            <h2 className="page-top-ui-title">Sectioned goal roadmap</h2>
            <p className="page-top-ui-meta">Track financial and personal milestones together.</p>
          </div>
          <span className="page-top-ui-pill">
            {normalizedGoals.length} goal{normalizedGoals.length === 1 ? '' : 's'}
          </span>
        </div>
      </section>

      {/* Header */}
      <div className="order-1 flex flex-wrap justify-end gap-2">
        <button
          onClick={() => handleGoalTasksAI()}
          disabled={taskSyncLoadingScope !== null || aiLoadingScope !== null}
          className="app-primary-btn text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-60"
        >
          {taskSyncLoadingScope === 'all:tasks' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ListTodo size={16} />
          )}
          {taskSyncLoadingScope === 'all:tasks' ? 'Syncing Tasks...' : 'Create/Update Goal Tasks'}
        </button>
        <button
          onClick={() => handleGoalsAI()}
          disabled={aiLoadingScope !== null || taskSyncLoadingScope !== null}
          className="app-primary-btn text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
        >
          {aiLoadingScope === 'all' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {aiLoadingScope === 'all' ? 'Analysing...' : 'Analyse All Goals'}
        </button>
      </div>

      {aiError && (
        <div className="order-0 bg-red-500/8 rounded-xl p-3 sm:p-4 text-red-300 text-sm">
          {aiError}
        </div>
      )}

      {/* Financial context strip */}
      <section className="page-group order-2">
        <div className="section-header-inline">
          <p className="section-header-title">Context</p>
          <p className="section-header-meta">Financial baseline</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 stagger-reveal">
          <div className="app-grid-stat p-3 hover-lift">
            <div className="flex items-center gap-1.5 text-green-400 mb-0.5">
              <PiggyBank size={14} />
              <span className="text-xs font-medium">Net Worth</span>
            </div>
            <p className={`text-base sm:text-lg font-bold text-white ${privacyMode ? 'privacy-mask' : ''}`}>{GBP(netWorth)}</p>
          </div>
          <div className="app-grid-stat p-3 hover-lift">
            <div className="flex items-center gap-1.5 text-blue-400 mb-0.5">
              <Wallet size={14} />
              <span className="text-xs font-medium">Liquid</span>
            </div>
            <p className={`text-base sm:text-lg font-bold text-white ${privacyMode ? 'privacy-mask' : ''}`}>{GBP(totalSavings)}</p>
          </div>
          <div className="app-grid-stat p-3 hover-lift">
            <div className="flex items-center gap-1.5 text-purple-400 mb-0.5">
              <Target size={14} />
              <span className="text-xs font-medium">Financial Targets</span>
            </div>
            <p className={`text-base sm:text-lg font-bold text-white ${privacyMode ? 'privacy-mask' : ''}`}>{GBP(totalGoalTarget)}</p>
          </div>
          <div className="app-grid-stat p-3 hover-lift">
            <div className="flex items-center gap-1.5 text-amber-400 mb-0.5">
              <TrendingUp size={14} />
              <span className="text-xs font-medium">Avg Completion</span>
            </div>
            <p className="text-base sm:text-lg font-bold text-white">
              {avgCompletion !== null ? `${avgCompletion}%` : '—'}
            </p>
          </div>
        </div>
      </section>

      {/* Overall AI strategy */}
      {aiResult.all?.overall && (
        <section className="page-group order-2">
          <div className="section-header-inline">
            <p className="section-header-title">Strategy</p>
            <p className="section-header-meta">AI overview</p>
          </div>
          <div className="ai-tip-glow bg-white/[0.02] rounded-xl pl-4 pr-3 py-3 sm:py-4 flex gap-3">
            <Sparkles size={18} className="app-accent-text shrink-0 mt-0.5" />
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
        </section>
      )}

      {/* Add goal form */}
      <section className="page-group order-3">
        <p className="page-group-kicker">Create</p>
        <div className="app-surface-sheet capture-zone">
        <button
          onClick={() => setAddOpen((prev) => !prev)}
          className="app-section-toggle w-full px-4 py-3 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
              <Plus size={16} className="app-accent-text" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Add New Goal</p>
              <p className="text-xs text-gray-500">
                Keep this collapsed while reviewing existing plans.
              </p>
            </div>
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
            className="border-t border-white/[0.04] px-4 py-4 space-y-3"
          >
            <div className="input-shell grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Goal title (e.g. Learn to drive)"
                className="sm:col-span-2 lg:col-span-1 min-w-0 bg-gray-900 border border-white/[0.06] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
              />
              <input
                list="goal-sections"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="Section (e.g. Personal)"
                className="bg-gray-900 border border-white/[0.06] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
              />
              <input
                type="number"
                step="any"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Target £ (optional)"
                className="bg-gray-900 border border-white/[0.06] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
              />
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="bg-gray-900 border border-white/[0.06] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
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
              className="w-full bg-gray-900 border border-white/[0.06] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-y"
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
      </section>

      {/* Goals list */}
      {normalizedGoals.length === 0 && !aiResult.all && (
        <div className="order-4">
          <EmptyState
          icon={Target}
          title="No goals yet"
          description="Add a goal and run AI for direction and next steps."
          />
        </div>
      )}

      <section className="page-group order-4">
        <div className="section-header-inline">
          <p className="section-header-title">Sections</p>
          <p className="section-header-meta">{sections.length} grouped area(s)</p>
        </div>
        <div className="page-group-shell">
          <div className="app-surface-list">
        {sections.map((section) => {
          const sectionResult = aiResult.sections?.[section.key]
          const sectionLoadingKey = `section:${section.key}`
          const sectionOpen = isSectionOpen(section.key)
          const sectionAverage = section.goals.length
            ? Math.round(
                section.goals.reduce((sum, goal) => sum + getGoalCompletion(goal), 0) /
                  section.goals.length
              )
            : 0

          return (
            <div
              key={section.key}
              className="app-surface-row overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleSection(section.key)}
                className="app-section-toggle w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-semibold text-white">{section.name}</h2>
                  <p className="text-xs text-gray-500">
                    {section.goals.length} goal{section.goals.length === 1 ? '' : 's'} · {sectionAverage}% avg
                    completion
                  </p>
                </div>
                <div className="flex items-center gap-2 text-gray-500 shrink-0">
                  {sectionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {sectionOpen && (
                <div className="border-t border-white/[0.04] px-4 sm:px-5 py-4 space-y-3">
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => handleGoalsAI(section.name)}
                      disabled={aiLoadingScope !== null || taskSyncLoadingScope !== null}
                      className="text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 px-3 py-1.5 rounded-lg border border-white/[0.06] transition-colors flex items-center gap-1.5"
                    >
                      {aiLoadingScope === sectionLoadingKey ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Sparkles size={12} />
                      )}
                      {aiLoadingScope === sectionLoadingKey ? 'Analysing...' : 'Analyse Section'}
                    </button>
                    <button
                      onClick={() => handleGoalTasksAI(section.name)}
                      disabled={taskSyncLoadingScope !== null || aiLoadingScope !== null}
                      className="ml-2 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 px-3 py-1.5 rounded-lg border border-white/[0.06] transition-colors flex items-center gap-1.5"
                    >
                      {taskSyncLoadingScope === `${sectionLoadingKey}:tasks` ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <ListTodo size={12} />
                      )}
                      {taskSyncLoadingScope === `${sectionLoadingKey}:tasks` ? 'Syncing...' : 'Sync Tasks'}
                    </button>
                  </div>

                  {sectionResult?.overall && (
                    <div className="ai-tip-glow bg-white/[0.02] rounded-xl pl-4 pr-3 py-3 text-sm text-slate-300">
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
                      const goalEntryKey = `${section.key}:${goal.id}`
                      const goalOpen = isGoalOpen(goalEntryKey)

                      return (
                        <div
                          key={goal.id}
                          className="app-strip-cell overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => toggleGoal(goalEntryKey)}
                            className="app-section-toggle w-full px-4 sm:px-5 py-3.5 flex items-start justify-between gap-3 text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <Target size={18} className="text-purple-400 shrink-0" />
                                <span className="text-sm font-semibold text-white truncate">
                                  {goal.title || 'Untitled goal'}
                                </span>
                                <span
                                  className={`text-[11px] font-bold px-2 py-0.5 rounded-md hidden sm:inline-flex items-center gap-1 ${cfg.badge}`}
                                >
                                  <StatusIcon size={12} />
                                  {cfg.label}
                                </span>
                              </div>
                              <div className="mt-2 flex items-center gap-2.5">
                                <div className="progress-track flex-1" style={{'--progress-color': cfg.color || 'var(--app-accent-400)'}}>
                                  <div className="progress-fill" style={{width: `${pct}%`}} />
                                </div>
                                <span className="text-[11px] font-semibold text-gray-400 tabular-nums w-9 text-right">{pct.toFixed(0)}%</span>
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                {goal.target > 0 && <span>Target <span className={privacyMode ? 'privacy-mask' : ''}>{GBP(goal.target)}</span></span>}
                                {goalTaskMap.has(String(goal.id)) && (
                                  <span className="text-indigo-300">
                                    Task sync {goalTaskMap.get(String(goal.id))?.done ? 'done' : 'active'}
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
                              {aiGoal?.summary && !goalOpen && (
                                <p className="text-xs text-gray-500 mt-1 truncate">{aiGoal.summary}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-gray-500 shrink-0">
                              {goalOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </button>

                          {goalOpen && (
                            <div className="border-t border-white/[0.04] px-4 sm:px-5 py-4 group space-y-3">
                              {/* Editable header */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <input
                                    value={goal.title}
                                    onChange={(e) => updateGoal(goal.id, 'title', e.target.value)}
                                    className="bg-transparent text-white font-semibold text-sm min-w-0 flex-1 focus:outline-none focus:bg-gray-900 focus:rounded px-1 -ml-1"
                                  />
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${cfg.badge}`}
                                  >
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
                              <div className="input-shell grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                                <input
                                  value={goal.section}
                                  onChange={(e) => updateGoal(goal.id, 'section', e.target.value)}
                                  placeholder="Section"
                                  className="bg-gray-900 border border-white/[0.06] rounded px-2 py-1.5 text-white focus:outline-none focus:border-blue-500"
                                />
                                {goal.target > 0 || goal.current > 0 ? (
                                  <>
                                    <input
                                      type="number"
                                      step="any"
                                      value={goal.target}
                                      onChange={(e) => updateGoal(goal.id, 'target', e.target.value)}
                                      placeholder="Target £"
                                      className="bg-gray-900 border border-white/[0.06] rounded px-2 py-1.5 text-white focus:outline-none focus:border-blue-500"
                                    />
                                    <div className="bg-gray-900 border border-white/[0.06] rounded px-2 py-1.5 text-gray-300">
                                      Current:{' '}
                                      <span className={`text-white font-medium ${privacyMode ? 'privacy-mask' : ''}`}>{GBP(goal.current)}</span>
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
                                    className="bg-gray-900 border border-white/[0.06] rounded px-2 py-1.5 text-white focus:outline-none focus:border-blue-500"
                                  />
                                )}
                                <input
                                  type="date"
                                  value={goal.deadline || ''}
                                  onChange={(e) => updateGoal(goal.id, 'deadline', e.target.value)}
                                  className="bg-gray-900 border border-white/[0.06] rounded px-2 py-1.5 text-white focus:outline-none focus:border-blue-500"
                                />
                              </div>

                              {/* Timing / amount summaries */}
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                {goal.target > 0 && remaining > 0 ? (
                                  <span>
                                    Need: <strong className={`text-white ${privacyMode ? 'privacy-mask' : ''}`}>{GBP(remaining)}</strong>
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

                              {/* Details, notes, plans, updates */}
                              <div className="input-shell">
                                <textarea
                                  value={goal.details}
                                  onChange={(e) => updateGoal(goal.id, 'details', e.target.value)}
                                  placeholder="Details"
                                  rows={2}
                                  className="w-full bg-gray-900 border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-y"
                                />
                              </div>
                              <div className="input-shell grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <textarea
                                  value={goal.notes}
                                  onChange={(e) => updateGoal(goal.id, 'notes', e.target.value)}
                                  placeholder="Notes"
                                  rows={2}
                                  className="w-full bg-gray-900 border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-y"
                                />
                                <textarea
                                  value={goal.plan}
                                  onChange={(e) => updateGoal(goal.id, 'plan', e.target.value)}
                                  placeholder="Plan"
                                  rows={2}
                                  className="w-full bg-gray-900 border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-y"
                                />
                              </div>
                              <div className="input-shell">
                                <div className="section-header-inline mb-2">
                                  <p className="section-header-title">Updates</p>
                                  <p className="section-header-meta">Progress log</p>
                                </div>
                                <textarea
                                  value={goal.updates}
                                  onChange={(e) => updateGoal(goal.id, 'updates', e.target.value)}
                                  placeholder="Recent updates (e.g. completed lesson 3, booked test date, submitted application)"
                                  rows={2}
                                  className="w-full bg-gray-900 border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-y"
                                />
                              </div>

                              {/* AI insight for this goal */}
                              {aiGoal && (
                                <div className="ai-tip-glow bg-gray-900/60 rounded-lg pl-4 pr-3 py-2.5 space-y-1 border border-white/[0.06]/50">
                                  <p className="text-sm text-gray-300">{aiGoal.summary}</p>
                                  <p className="text-sm text-purple-300 font-medium">{aiGoal.action}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
          </div>
        </div>
      </section>
    </div>
  )
}
