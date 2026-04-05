import { useState } from 'react'
import {
  Plus,
  Trash2,
  PiggyBank,
  CreditCard,
  Wallet,
  Calendar,
  TrendingUp,
  AlertCircle,
  LineChart,
  Landmark,
  Shield,
  Brain,
  Loader2,
  User,
  ChevronDown,
  ChevronUp,
  Repeat,
} from 'lucide-react'
import { runFinanceAnalysis } from '../ai'

const GBP = (v) =>
  (v || 0).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })

function firstSentence(text) {
  if (typeof text !== 'string') return ''
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  const match = cleaned.match(/^.*?[.!?](?:\s|$)/)
  return (match ? match[0] : cleaned).trim()
}

function clampText(text, limit = 130) {
  if (!text) return ''
  if (text.length <= limit) return text
  return `${text.slice(0, limit - 1).trimEnd()}…`
}

function AiTip({ tip, label }) {
  const [open, setOpen] = useState(false)
  if (!tip || (!tip.summary && !tip.action)) return null

  const actionText = typeof tip.action === 'string' ? tip.action.replace(/\s+/g, ' ').trim() : ''
  const summaryText = typeof tip.summary === 'string' ? tip.summary.replace(/\s+/g, ' ').trim() : ''

  const primaryFull = actionText || summaryText
  const primarySentence = firstSentence(primaryFull)
  const primaryCompact = clampText(primarySentence, 120)
  const primaryTruncated = primaryCompact !== primarySentence

  const secondaryFull =
    actionText && summaryText && summaryText !== actionText
      ? summaryText
      : ''
  const secondarySentence = firstSentence(secondaryFull)
  const secondaryCompact = secondarySentence ? clampText(secondarySentence, 140) : ''
  const secondaryTruncated = secondaryCompact && secondaryCompact !== secondarySentence
  const canExpand = Boolean(secondaryFull || primaryTruncated || secondaryTruncated)

  return (
    <div className="bg-gray-900/60 rounded-lg px-3 py-2.5 border border-gray-700/50 -mt-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.1em] text-gray-500">
          {label ? `${label} • AI next step` : 'AI next step'}
        </p>
        {canExpand && (
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="text-[11px] text-blue-300 hover:text-blue-200 transition-colors"
          >
            {open ? 'Less' : 'More'}
          </button>
        )}
      </div>
      {primaryFull && (
        <p className="text-sm text-blue-300 font-medium mt-1">
          {open ? primaryFull : primaryCompact}
        </p>
      )}
      {open && secondaryFull && (
        <p className="text-xs text-gray-400 mt-1">{secondaryFull}</p>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    green: 'bg-green-900/40 border-green-700 text-green-400',
    amber: 'bg-yellow-900/40 border-yellow-700 text-yellow-400',
    red: 'bg-red-900/40 border-red-700 text-red-400',
  }
  const labels = { green: 'On Track', amber: 'Tight', red: 'At Risk' }
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${styles[status]}`}
    >
      {labels[status]}
    </span>
  )
}

function daysUntil(dateStr) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
}

function getExpenseStatus(expense, availableFunds, monthlySurplus) {
  const days = daysUntil(expense.deadline)
  const months = Math.max(1, days / 30)

  if (availableFunds >= expense.amount) return 'green'

  const potentialFunds = availableFunds + monthlySurplus * months
  if (potentialFunds >= expense.amount) return 'amber'

  return 'red'
}

// Reusable card for list sections (savings, cards, investments, pensions)
function AccountSection({
  icon,
  title,
  color,
  list,
  valueKey,
  placeholderName,
  placeholderValue,
  onAdd,
  onUpdate,
  onRename,
  onRemove,
}) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [open, setOpen] = useState(() => list.length === 0)

  function handleAdd(e) {
    e.preventDefault()
    const val = parseFloat(amount)
    if (!name.trim() || isNaN(val)) return
    onAdd(name.trim(), val)
    setName('')
    setAmount('')
  }

  const colorMap = {
    green: 'text-green-400',
    red: 'text-red-400',
    cyan: 'text-cyan-400',
    amber: 'text-amber-400',
  }
  const btnMap = {
    green: 'bg-green-600 hover:bg-green-500',
    red: 'bg-red-600 hover:bg-red-500',
    cyan: 'bg-cyan-600 hover:bg-cyan-500',
    amber: 'bg-amber-600 hover:bg-amber-500',
  }
  const total = list.reduce((sum, item) => sum + (item[valueKey] || 0), 0)

  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 sm:p-5 space-y-4">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
          {list.length > 0 && <span>{list.length} item(s)</span>}
          {total > 0 && <span className="text-white">{GBP(total)}</span>}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {open && (
        <>
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={placeholderName}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
            />
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={placeholderValue}
                className="flex-1 sm:w-32 sm:flex-none bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
              />
              <button
                type="submit"
                className={`${btnMap[color]} text-white px-4 py-2.5 rounded-lg flex items-center gap-1 transition-colors shrink-0`}
              >
                <Plus size={16} />
              </button>
            </div>
          </form>
          {list.length > 0 && (
            <div className="space-y-2">
              {list.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-gray-900/50 rounded-lg px-3 sm:px-4 py-2.5 group gap-2"
                >
                  <input
                    value={item.name}
                    onChange={(e) => onRename(item.id, e.target.value)}
                    className="bg-transparent text-gray-300 text-sm truncate min-w-0 flex-1 focus:outline-none focus:bg-gray-800 focus:rounded px-1 -ml-1"
                  />
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <input
                      type="number"
                      step="0.01"
                      value={item[valueKey]}
                      onChange={(e) => onUpdate(item.id, e.target.value)}
                      className={`w-24 sm:w-28 bg-gray-800 border border-gray-700 rounded px-2 py-1 ${colorMap[color]} text-sm text-right font-medium focus:outline-none focus:border-blue-500`}
                    />
                    <button
                      onClick={() => onRemove(item.id)}
                      className="text-gray-600 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function Finance({ finances, setFinances, goals, profile, setProfile }) {
  const [expName, setExpName] = useState('')
  const [expAmount, setExpAmount] = useState('')
  const [expDeadline, setExpDeadline] = useState('')
  const [incomeInput, setIncomeInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiResult, setAiResult] = useState(() => {
    try {
      const stored = localStorage.getItem('va-finance-insight')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })
  const [profileOpen, setProfileOpen] = useState(!profile.birthday)
  const [coreOpen, setCoreOpen] = useState(true)
  const [setupOpen, setSetupOpen] = useState(false)
  const [upcomingOpen, setUpcomingOpen] = useState(false)

  const saList = finances.savingsAccounts || []
  const ccList = finances.creditCards || []
  const ueList = finances.upcomingExpenses || []
  const invList = finances.investments || []
  const penList = finances.pensions || []
  const mcList = finances.monthlyContributions || []
  const incomeVal = finances.monthlyIncome || 0

  const totalMonthlyContributions = mcList.reduce((s, c) => s + c.amount, 0)
  const monthlySurplus = incomeVal - totalMonthlyContributions
  const totalSavings = saList.reduce((s, a) => s + a.amount, 0)
  const totalInvested = invList.reduce((s, i) => s + i.value, 0)
  const totalPension = penList.reduce((s, p) => s + p.value, 0)
  const totalDebt = ccList.reduce((s, c) => s + c.balance, 0)
  const netPosition = totalSavings - totalDebt
  const netWorth = totalSavings + totalInvested + totalPension - totalDebt
  const totalUpcoming = ueList.reduce((s, e) => s + e.amount, 0)
  const availableAfterUpcoming = netPosition - totalUpcoming

  // -- CRUD helpers
  function updateList(key, list) {
    setFinances({ ...finances, [key]: list })
  }

  function addUpcoming(e) {
    e.preventDefault()
    const val = parseFloat(expAmount)
    if (!expName.trim() || isNaN(val) || !expDeadline) return
    updateList('upcomingExpenses', [
      ...ueList,
      {
        id: Date.now(),
        name: expName.trim(),
        amount: val,
        deadline: expDeadline,
      },
    ])
    setExpName('')
    setExpAmount('')
    setExpDeadline('')
  }

  function removeUpcoming(id) {
    updateList(
      'upcomingExpenses',
      ueList.filter((e) => e.id !== id)
    )
  }

  function setIncome(e) {
    e.preventDefault()
    const val = parseFloat(incomeInput)
    if (isNaN(val)) return
    setFinances({ ...finances, monthlyIncome: val })
    setIncomeInput('')
  }

  async function handleFinanceAI() {
    setAiLoading(true)
    setAiError(null)
    try {
      const result = await runFinanceAnalysis({ profile, finances, goals })
      const stored = { ...result, date: new Date().toISOString() }
      setAiResult(stored)
      localStorage.setItem('va-finance-insight', JSON.stringify(stored))
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoading(false)
    }
  }

  function updateProfile(field, value) {
    setProfile({ ...profile, [field]: value })
  }

  // Calculate age for display
  let age = null
  if (profile.birthday) {
    const birth = new Date(profile.birthday)
    const now = new Date()
    age = now.getFullYear() - birth.getFullYear() -
      (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0)
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Financial Position</h1>
        <button
          onClick={handleFinanceAI}
          disabled={aiLoading}
          className="app-primary-btn text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors self-start sm:self-auto"
        >
          {aiLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Brain size={16} />
          )}
          {aiLoading ? 'Analysing...' : 'Run Financial Analysis'}
        </button>
      </div>

      {aiError && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
          {aiError}
        </div>
      )}

      {/* Profile */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="w-full flex items-center justify-between p-4 sm:p-5 text-left"
        >
          <div className="flex items-center gap-2">
            <User size={18} className="text-indigo-400" />
            <span className="text-sm font-semibold text-white">Your Profile</span>
            {profile.name && !profileOpen && (
              <span className="text-xs text-gray-500 ml-2">
                {profile.name}{age !== null ? `, ${age}y` : ''}
              </span>
            )}
          </div>
          {profileOpen ? (
            <ChevronUp size={16} className="text-gray-500" />
          ) : (
            <ChevronDown size={16} className="text-gray-500" />
          )}
        </button>
        {profileOpen && (
          <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3 border-t border-gray-700/50 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input
                  value={profile.name}
                  onChange={(e) => updateProfile('name', e.target.value)}
                  placeholder="Your name..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Date of Birth {age !== null && <span className="text-indigo-400">({age} years old)</span>}
                </label>
                <input
                  type="date"
                  value={profile.birthday}
                  onChange={(e) => updateProfile('birthday', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Core snapshot */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setCoreOpen((prev) => !prev)}
          className="w-full flex items-center justify-between p-4 sm:p-5 text-left"
        >
          <div className="flex items-center gap-2">
            <Landmark size={18} className="text-indigo-400" />
            <span className="text-sm font-semibold text-white">Core Snapshot</span>
            <span className="text-xs text-gray-500 ml-1">Net worth, overview, upcoming impact</span>
          </div>
          {coreOpen ? (
            <ChevronUp size={16} className="text-gray-500" />
          ) : (
            <ChevronDown size={16} className="text-gray-500" />
          )}
        </button>
        {coreOpen && (
          <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-4 border-t border-gray-700/50 pt-4">
            {/* Net Worth banner */}
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <div className="flex items-center gap-2">
                <Landmark size={20} className="text-indigo-400" />
                <span className="text-sm font-medium text-gray-400">Total Net Worth</span>
              </div>
              <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-white' : 'text-red-400'}`}>
                {GBP(netWorth)}
              </p>
            </div>

            {/* Overview cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 sm:p-4">
                <div className="flex items-center gap-1.5 text-green-400 mb-1">
                  <PiggyBank size={14} />
                  <span className="text-xs font-medium">Liquid Savings</span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-white">{GBP(totalSavings)}</p>
              </div>
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 sm:p-4">
                <div className="flex items-center gap-1.5 text-cyan-400 mb-1">
                  <LineChart size={14} />
                  <span className="text-xs font-medium">Invested</span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-white">{GBP(totalInvested)}</p>
              </div>
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 sm:p-4">
                <div className="flex items-center gap-1.5 text-amber-400 mb-1">
                  <Shield size={14} />
                  <span className="text-xs font-medium">Pension</span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-white">{GBP(totalPension)}</p>
              </div>
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 sm:p-4">
                <div className="flex items-center gap-1.5 text-red-400 mb-1">
                  <CreditCard size={14} />
                  <span className="text-xs font-medium">Total Debt</span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-white">{GBP(totalDebt)}</p>
              </div>
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 sm:p-4">
                <div className="flex items-center gap-1.5 text-blue-400 mb-1">
                  <Wallet size={14} />
                  <span className="text-xs font-medium">Liquid Net</span>
                </div>
                <p className={`text-lg sm:text-xl font-bold ${netPosition >= 0 ? 'text-white' : 'text-red-400'}`}>
                  {GBP(netPosition)}
                </p>
              </div>
              <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-3 sm:p-4">
                <div className="flex items-center gap-1.5 text-purple-400 mb-1">
                  <TrendingUp size={14} />
                  <span className="text-xs font-medium">Monthly Income</span>
                </div>
                <p className="text-lg sm:text-xl font-bold text-white">{GBP(incomeVal)}</p>
              </div>
            </div>

            {/* After upcoming commitments */}
            <div
              className={`rounded-xl p-3 sm:p-4 border flex items-center gap-3 ${
                availableAfterUpcoming >= 0
                  ? 'bg-green-900/20 border-green-800/50 text-green-300'
                  : 'bg-red-900/20 border-red-800/50 text-red-300'
              }`}
            >
              <AlertCircle size={18} className="shrink-0" />
              <span className="text-sm">
                After all upcoming expenses:{' '}
                <strong className="text-white">{GBP(availableAfterUpcoming)}</strong>{' '}
                {availableAfterUpcoming >= 0 ? 'remaining' : 'shortfall'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* AI Score + Overall */}
      {aiResult?.score && (
        <div className="app-accent-panel bg-gray-800/60 border border-blue-800/30 rounded-xl p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`text-2xl font-bold ${aiResult.score.value >= 7 ? 'text-green-400' : aiResult.score.value >= 4 ? 'text-yellow-400' : 'text-red-400'}`}>
                {aiResult.score.value}/10
              </div>
              <p className="text-sm text-gray-300">{aiResult.score.label}</p>
            </div>
            <span className="text-xs text-gray-600">
              {aiResult.date ? new Date(aiResult.date).toLocaleDateString() : ''}
            </span>
          </div>
          {aiResult.overall && (
            <div className="bg-gray-900/60 rounded-lg px-3 py-2.5 border-l-2 border-blue-500/50">
              <p className="text-sm text-blue-300">{aiResult.overall}</p>
            </div>
          )}
        </div>
      )}

      {/* Setup */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setSetupOpen((prev) => !prev)}
          className="w-full flex items-center justify-between p-4 sm:p-5 text-left"
        >
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-purple-400" />
            <span className="text-sm font-semibold text-white">Income & Contributions Setup</span>
            <span className="text-xs text-gray-500 ml-1">Usually updated less often</span>
          </div>
          {setupOpen ? (
            <ChevronUp size={16} className="text-gray-500" />
          ) : (
            <ChevronDown size={16} className="text-gray-500" />
          )}
        </button>

        {setupOpen && (
          <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-4 border-t border-gray-700/50 pt-4">
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 sm:p-5 space-y-3">
              <h2 className="text-lg font-semibold text-white">Monthly Income</h2>
              <form onSubmit={setIncome} className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={incomeInput}
                  onChange={(e) => setIncomeInput(e.target.value)}
                  placeholder="Update monthly income..."
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                />
                <button
                  type="submit"
                  className="app-primary-btn text-white px-4 py-2.5 rounded-lg transition-colors text-sm"
                >
                  Set
                </button>
              </form>
            </div>

            {/* Monthly Contributions */}
            <AccountSection
              icon={<Repeat size={20} className="text-emerald-400" />}
              title="Monthly Contributions"
              color="green"
              list={mcList}
              valueKey="amount"
              placeholderName="Category (e.g. ISA, Pension, S&P 500)..."
              placeholderValue="Monthly £..."
              onAdd={(name, val) =>
                updateList('monthlyContributions', [
                  ...mcList,
                  { id: Date.now(), name, amount: val },
                ])
              }
              onUpdate={(id, val) =>
                updateList('monthlyContributions', mcList.map((c) =>
                  c.id === id ? { ...c, amount: parseFloat(val) || 0 } : c
                ))
              }
              onRename={(id, name) =>
                updateList('monthlyContributions', mcList.map((c) =>
                  c.id === id ? { ...c, name } : c
                ))
              }
              onRemove={(id) =>
                updateList('monthlyContributions', mcList.filter((c) => c.id !== id))
              }
            />
            {mcList.length > 0 && (
              <div className="flex items-center justify-between bg-gray-800/60 border border-gray-700/50 rounded-lg px-4 py-2.5 -mt-3 text-sm">
                <span className="text-gray-400">Total monthly contributions</span>
                <span className="text-emerald-400 font-bold">{GBP(totalMonthlyContributions)}</span>
              </div>
            )}
            <AiTip tip={aiResult?.contributions} label="Contributions" />
          </div>
        )}
      </div>

      {/* Savings Accounts */}
      <AccountSection
        icon={<PiggyBank size={20} className="text-green-400" />}
        title="Savings Accounts"
        color="green"
        list={saList}
        valueKey="amount"
        placeholderName="Account name (e.g. Marcus, ISA)..."
        placeholderValue="Balance..."
        onAdd={(name, val) =>
          updateList('savingsAccounts', [
            ...saList,
            { id: Date.now(), name, amount: val },
          ])
        }
        onUpdate={(id, val) =>
          updateList('savingsAccounts', saList.map((a) =>
            a.id === id ? { ...a, amount: parseFloat(val) || 0 } : a
          ))
        }
        onRename={(id, name) =>
          updateList('savingsAccounts', saList.map((a) =>
            a.id === id ? { ...a, name } : a
          ))
        }
        onRemove={(id) =>
          updateList('savingsAccounts', saList.filter((a) => a.id !== id))
        }
      />
      <AiTip tip={aiResult?.savings} label="Savings" />

      {/* Credit Cards */}
      <AccountSection
        icon={<CreditCard size={20} className="text-red-400" />}
        title="Credit Cards"
        color="red"
        list={ccList}
        valueKey="balance"
        placeholderName="Card name (e.g. Amex, Barclays)..."
        placeholderValue="Owed..."
        onAdd={(name, val) =>
          updateList('creditCards', [
            ...ccList,
            { id: Date.now(), name, balance: val },
          ])
        }
        onUpdate={(id, val) =>
          updateList('creditCards', ccList.map((c) =>
            c.id === id ? { ...c, balance: parseFloat(val) || 0 } : c
          ))
        }
        onRename={(id, name) =>
          updateList('creditCards', ccList.map((c) =>
            c.id === id ? { ...c, name } : c
          ))
        }
        onRemove={(id) =>
          updateList('creditCards', ccList.filter((c) => c.id !== id))
        }
      />
      <AiTip tip={aiResult?.debt} label="Debt" />

      {/* Investments */}
      <AccountSection
        icon={<LineChart size={20} className="text-cyan-400" />}
        title="Investments"
        color="cyan"
        list={invList}
        valueKey="value"
        placeholderName="Account (e.g. Vanguard S&P 500)..."
        placeholderValue="Current value..."
        onAdd={(name, val) =>
          updateList('investments', [
            ...invList,
            { id: Date.now(), name, value: val },
          ])
        }
        onUpdate={(id, val) =>
          updateList('investments', invList.map((i) =>
            i.id === id ? { ...i, value: parseFloat(val) || 0 } : i
          ))
        }
        onRename={(id, name) =>
          updateList('investments', invList.map((i) =>
            i.id === id ? { ...i, name } : i
          ))
        }
        onRemove={(id) =>
          updateList('investments', invList.filter((i) => i.id !== id))
        }
      />
      <AiTip tip={aiResult?.investments} label="Investments" />

      {/* Pensions */}
      <AccountSection
        icon={<Shield size={20} className="text-amber-400" />}
        title="Pensions"
        color="amber"
        list={penList}
        valueKey="value"
        placeholderName="Pension (e.g. Workplace, SIPP)..."
        placeholderValue="Current value..."
        onAdd={(name, val) =>
          updateList('pensions', [
            ...penList,
            { id: Date.now(), name, value: val },
          ])
        }
        onUpdate={(id, val) =>
          updateList('pensions', penList.map((p) =>
            p.id === id ? { ...p, value: parseFloat(val) || 0 } : p
          ))
        }
        onRename={(id, name) =>
          updateList('pensions', penList.map((p) =>
            p.id === id ? { ...p, name } : p
          ))
        }
        onRemove={(id) =>
          updateList('pensions', penList.filter((p) => p.id !== id))
        }
      />
      <AiTip tip={aiResult?.pensions} label="Pensions" />

      {/* Upcoming Expenses */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setUpcomingOpen((prev) => !prev)}
          className="w-full flex items-start sm:items-center justify-between gap-2 p-4 sm:p-5 text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Calendar size={20} className="text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white">Upcoming Expenses</h2>
              <p className="text-xs text-gray-500">
                {ueList.length} item(s){ueList.length > 0 ? ` · ${GBP(totalUpcoming)} total` : ''}
              </p>
            </div>
          </div>
          <div className="text-gray-500 shrink-0">
            {upcomingOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {upcomingOpen && (
          <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-4 border-t border-gray-700/50 pt-4">
            <form onSubmit={addUpcoming} className="flex flex-col sm:flex-row gap-2">
              <input
                value={expName}
                onChange={(e) => setExpName(e.target.value)}
                placeholder="What for..."
                className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
              />
              <div className="grid grid-cols-1 sm:flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="Amount..."
                  className="w-full sm:w-28 sm:flex-none bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                />
                <input
                  type="date"
                  value={expDeadline}
                  onChange={(e) => setExpDeadline(e.target.value)}
                  className="w-full sm:flex-none bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
                />
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-1 transition-colors shrink-0 w-full sm:w-auto"
                >
                  <Plus size={16} />
                  <span className="sm:hidden">Add Expense</span>
                </button>
              </div>
            </form>

            {ueList.length > 0 && (
              <div className="space-y-2">
                {ueList.map((exp) => {
                  const days = daysUntil(exp.deadline)
                  const status = getExpenseStatus(exp, netPosition, monthlySurplus)

                  return (
                    <div
                      key={exp.id}
                      className="bg-gray-900/50 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 group space-y-2"
                    >
                      <div className="flex items-start sm:items-center justify-between gap-2">
                        <input
                          value={exp.name}
                          onChange={(e) =>
                            updateList('upcomingExpenses', ueList.map((u) =>
                              u.id === exp.id ? { ...u, name: e.target.value } : u
                            ))
                          }
                          className="bg-transparent text-white font-medium text-sm min-w-0 flex-1 focus:outline-none focus:bg-gray-800 focus:rounded px-1 -ml-1 break-words"
                        />
                        <button
                          onClick={() => removeUpcoming(exp.id)}
                          className="text-gray-600 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
                        <StatusBadge status={status} />
                        <span className="text-white font-medium">{GBP(exp.amount)}</span>
                        <span
                          className={`text-xs ${days < 0 ? 'text-red-400' : days < 30 ? 'text-yellow-400' : 'text-gray-500'}`}
                        >
                          {days < 0
                            ? `${Math.abs(days)}d overdue`
                            : `${days}d left`}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
      <AiTip tip={aiResult?.upcoming} label="Upcoming" />
    </div>
  )
}
