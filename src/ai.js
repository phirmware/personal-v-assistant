const CORE_SYSTEM_PROMPT = `You are V-Assistant, a highly practical personal execution coach.
Your ultimate goal is to help the user succeed.
Always do everything possible within the provided context to maximize the user's progress, clarity, and consistency.
Prioritize concrete actions, honest tradeoffs, and next steps the user can actually execute.`

async function callOpenAI(prompt, maxTokens = 1000) {
  const res = await fetch('/api/openai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      maxTokens,
      systemPrompt: CORE_SYSTEM_PROMPT,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `API error: ${res.status}`)
  }

  const data = await res.json()
  if (typeof data?.content !== 'string') {
    throw new Error('Invalid AI response')
  }
  return data.content
}

function buildFinanceSummary(finances) {
  const sa = finances.savingsAccounts || []
  const cc = finances.creditCards || []
  const inv = finances.investments || []
  const pen = finances.pensions || []
  const ue = finances.upcomingExpenses || []
  const mc = finances.monthlyContributions || []
  const income = finances.monthlyIncome || 0

  const totalSavings = sa.reduce((s, a) => s + a.amount, 0)
  const totalInvested = inv.reduce((s, i) => s + i.value, 0)
  const totalPension = pen.reduce((s, p) => s + p.value, 0)
  const totalDebt = cc.reduce((s, c) => s + c.balance, 0)
  const totalUpcoming = ue.reduce((s, e) => s + e.amount, 0)
  const totalContributions = mc.reduce((s, c) => s + c.amount, 0)
  const netWorth = totalSavings + totalInvested + totalPension - totalDebt
  const monthlySurplus = income - totalContributions

  return `
FINANCIAL BREAKDOWN:
Monthly Income: £${income.toFixed(2)}
Monthly Contributions/Savings: £${totalContributions.toFixed(2)}
Monthly Surplus (income - contributions): £${monthlySurplus.toFixed(2)}

Savings Accounts (Total: £${totalSavings.toFixed(2)}):
${sa.length ? sa.map(a => `  - ${a.name}: £${a.amount.toFixed(2)}`).join('\n') : '  (none)'}

Investment Accounts (Total: £${totalInvested.toFixed(2)}):
${inv.length ? inv.map(i => `  - ${i.name}: £${i.value.toFixed(2)}`).join('\n') : '  (none)'}

Pension Accounts (Total: £${totalPension.toFixed(2)}):
${pen.length ? pen.map(p => `  - ${p.name}: £${p.value.toFixed(2)}`).join('\n') : '  (none)'}

Credit Card Debt (Total: £${totalDebt.toFixed(2)}):
${cc.length ? cc.map(c => `  - ${c.name}: £${c.balance.toFixed(2)}`).join('\n') : '  (none)'}

Monthly Contributions (Total: £${totalContributions.toFixed(2)}/month):
${mc.length ? mc.map(c => `  - ${c.name}: £${c.amount.toFixed(2)}/month`).join('\n') : '  (none)'}

Upcoming Expenses (Total: £${totalUpcoming.toFixed(2)}):
${ue.length ? ue.map(e => `  - ${e.name}: £${e.amount.toFixed(2)} by ${e.deadline}`).join('\n') : '  (none)'}

Net Worth: £${netWorth.toFixed(2)}
Liquid (savings - debt): £${(totalSavings - totalDebt).toFixed(2)}
`
}

function getAgeContext(profile) {
  if (!profile.birthday) return ''
  const birth = new Date(profile.birthday)
  const now = new Date()
  const age = now.getFullYear() - birth.getFullYear() -
    (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0)
  return `Age: ${age}. Years to pension age (67): ${Math.max(0, 67 - age)}.`
}

function getProfileContext(profile = {}) {
  const bits = []
  if (profile.lifeStage) bits.push(`Life stage: ${profile.lifeStage}.`)
  if (profile.riskPreference) bits.push(`Risk preference: ${profile.riskPreference}.`)
  if (profile.profileNotes) bits.push(`Profile notes: ${profile.profileNotes}.`)
  return bits.join(' ')
}

function parseJSON(raw) {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI did not return valid JSON')
  try {
    return JSON.parse(match[0])
  } catch {
    throw new Error('Failed to parse AI response')
  }
}

function toDateOnly(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  const isoMatch = /^\d{4}-\d{2}-\d{2}$/.test(text)
  if (isoMatch) return text
  const d = new Date(text)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0]
}

function daysBetween(fromDateStr, targetDateStr) {
  const fromDate = toDateOnly(fromDateStr)
  const targetDate = toDateOnly(targetDateStr)
  if (!fromDate || !targetDate) return null
  const from = new Date(`${fromDate}T00:00:00`)
  const target = new Date(`${targetDate}T00:00:00`)
  const diff = target.getTime() - from.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export async function runAnalysis({ tasks, goals, finances, notes }) {
  const userData = JSON.stringify({ tasks, goals, finances, notes }, null, 2)
  const prompt = `You are a highly strategic personal advisor.

Analyze the following user data and provide:
1. Top 3 priorities for today
2. Key risks or problems
3. Opportunities to improve results
4. Clear, direct recommendation for what to do today

Be concise, direct, and practical.

User Data:
${userData}`
  return callOpenAI(prompt)
}

export async function runTaskSuggestion({ task }) {
  const prompt = `You are a concise productivity coach.

Give practical guidance for this single task:
- Title: ${task?.title || 'Untitled'}
- Priority: ${task?.priority || 'medium'}
- Details: ${task?.details || '(none)'}
- Latest updates: ${task?.updates || '(none)'}

Respond in concise markdown with:
1) Three actionable suggestions
2) One likely blocker to watch
3) The best first step to do in the next 15 minutes

Keep total response under 120 words.`

  return callOpenAI(prompt, 500)
}

export async function runNotesInsight({ notes }) {
  const notesSummary = (notes || [])
    .slice(0, 40)
    .map((note, index) => {
      const text = String(note?.text || '').replace(/\s+/g, ' ').trim()
      return `${index + 1}. ${text || '(empty note)'}`
    })
    .join('\n')

  const prompt = `You are a concise personal productivity coach.

Analyze these notes and respond in compact markdown using this structure:

## Key themes
- 2 to 4 bullets

## Risks to watch
- 1 to 3 bullets

## Next actions
- 3 concrete actions for this week

## Focus line
One sentence with the single biggest focus.

Rules:
- Keep the full response under 140 words.
- Be specific and practical.
- Use direct language.

NOTES:
${notesSummary || '(none)'}`

  return callOpenAI(prompt, 700)
}

export async function runNoteSuggestion({ note }) {
  const prompt = `You are a concise execution coach.

Review this note and provide practical next-step guidance.

Note:
${String(note?.text || '').trim() || '(empty)'}

Respond in markdown with:
- One-sentence interpretation
- Three concrete next steps
- One blocker to watch

Rules:
- Keep response under 90 words.
- No filler or generic advice.
- If the note is vague, suggest a clarifying question as the first step.`

  return callOpenAI(prompt, 500)
}

export async function runGoalTaskPlanner({
  profile,
  finances,
  goals,
  existingTasks = [],
  section = null,
  notes = [],
}) {
  const today = new Date().toISOString().split('T')[0]
  const ageCtx = getAgeContext(profile)
  const profileCtx = getProfileContext(profile)
  const finSummary = buildFinanceSummary(finances)

  const goalsPayload = (goals || []).map((g) => {
    const target = Number.isFinite(parseFloat(g?.target)) ? parseFloat(g.target) : 0
    const current = Number.isFinite(parseFloat(g?.current)) ? parseFloat(g.current) : 0
    const progress = Number.isFinite(parseFloat(g?.progress)) ? parseFloat(g.progress) : 0
    const completion = target > 0 ? Math.max(0, Math.min(100, (current / target) * 100)) : Math.max(0, Math.min(100, progress))
    const daysLeft = g?.deadline
      ? Math.ceil((new Date(g.deadline) - new Date(today)) / (1000 * 60 * 60 * 24))
      : null

    return {
      id: g?.id,
      section: g?.section || 'Financial',
      title: g?.title || '',
      target,
      current,
      progress,
      completion,
      deadline: g?.deadline || null,
      days_left: Number.isFinite(daysLeft) ? daysLeft : null,
      details: g?.details || '',
      notes: g?.notes || '',
      plan: g?.plan || '',
      updates: g?.updates || '',
    }
  })

  const existingPayload = (existingTasks || []).map((t) => ({
    completeAtDate: toDateOnly(t?.complete_at ?? t?.completeAt ?? null),
    days_to_complete_at: daysBetween(today, t?.complete_at ?? t?.completeAt ?? null),
    id: t?.id,
    goal_id: t?.goal_id ?? t?.goalId ?? null,
    title: t?.title || '',
    details: t?.details || '',
    updates: t?.updates || '',
    priority: t?.priority || 'medium',
    complete_at: t?.complete_at ?? t?.completeAt ?? null,
    done: Boolean(t?.done),
    updated_at: t?.updated_at ?? t?.updatedAt ?? null,
  }))

  const notesSummary = (notes || [])
    .slice(0, 10)
    .map((n) => `- ${String(n?.text || '').replace(/\s+/g, ' ').trim()}`)
    .join('\n')

  const scopeText = section
    ? `Focus only on this section: "${section}".`
    : 'Cover all goal sections.'

  const prompt = `You are a practical daily execution coach. Today is ${today}. ${ageCtx} ${profileCtx}

${finSummary}

GOALS:
${JSON.stringify(goalsPayload)}

EXISTING AI-GENERATED GOAL TASKS:
${JSON.stringify(existingPayload)}

NOTES CONTEXT:
${notesSummary || '(none)'}

${scopeText}

Objective:
- Create or update at most ONE AI-managed task per goal.
- Task must be completable in one day and move goal progress forward.
- Use timeline urgency from deadline and days_left, plus details/notes/plan/updates and current completion.
- Use existing task title/details/updates and NOTES CONTEXT to decide whether to keep or update.
- If an existing goal task is still valid, keep it.
- If a goal is complete (or updates clearly indicate completion), mark existing task done.
- Treat task updates as user-authored progress history.
- Compare each existing task complete_at against today and use updates to decide:
  - due/past + completion evidence -> mark_done
  - due/past + no completion evidence -> create_or_update with today's next step
  - not due + still valid -> keep

Respond with ONLY valid JSON:
{
  "tasks": [
    {
      "goal_id": "<goal id>",
      "mode": "create_or_update" | "keep" | "mark_done",
      "title": "<required when create_or_update>",
      "details": "<required when create_or_update; concise actionable context>",
      "priority": "low" | "medium" | "high",
      "complete_at": "YYYY-MM-DD" | null,
      "reminder": "none" | "morning_of" | "day_before" | "1h_before" | "30m_before",
      "reason": "<short rationale>"
    }
  ],
  "summary": "<one sentence>"
}

Rules:
- Return exactly one tasks item for each goal in GOALS.
- Never create broad multi-day tasks; scope to a same-day action that can be done in one focused sitting.
- complete_at must be today or tomorrow (unless goal deadline is sooner); never set weeks ahead.
- reminder: set intelligently based on urgency. Use "morning_of" for same-day tasks, "day_before" for tasks due tomorrow, "1h_before" or "30m_before" for time-sensitive high-priority tasks. Use "none" only for low-priority tasks with flexible deadlines.
- "keep" means no update needed to existing task.
- "mark_done" only when goal is completed or task is no longer needed.
- If existing task updates indicate the action was completed, choose "mark_done".
- Never delete tasks. Completion must be done via "mark_done".
- You may update title/details/priority/complete_at, but do not attempt to overwrite task updates.
- Prefer specificity with numbers/timelines from goal data.
- Do not reference manual tasks (only existing AI goal tasks are in input).`

  const raw = await callOpenAI(prompt, 1600)
  return parseJSON(raw)
}

export async function runFinanceAnalysis({ profile, finances }) {
  const today = new Date().toISOString().split('T')[0]
  const ageCtx = getAgeContext(profile)
  const profileCtx = getProfileContext(profile)
  const finSummary = buildFinanceSummary(finances)

  const prompt = `You are a concise financial advisor. Today is ${today}. ${ageCtx} ${profileCtx}

${finSummary}

Respond with ONLY valid JSON, no markdown:

{
  "score": { "value": <1-10>, "label": "<one-line verdict>" },
  "savings": { "summary": "<very short context>", "action": "<single priority action>" },
  "investments": { "summary": "<very short context>", "action": "<single priority action>" },
  "pensions": { "summary": "<very short context>", "action": "<single priority action>" },
  "debt": { "summary": "<very short context>", "action": "<single priority action>" },
  "upcoming": { "summary": "<very short context>", "action": "<single priority action>" },
  "contributions": { "summary": "<very short context>", "action": "<single priority action>" },
  "overall": "<2 sentences: biggest risk + single most impactful next step this week>"
}

Rules:
- Be brutally concise.
- Use £ and exact numbers from user data.
- Focus ONLY on current financial health (cashflow, savings, debt, investments, pensions, upcoming expenses).
- Do not consider goals, target amounts, or future goal deadlines in this analysis.
- For each section:
  - summary: max 10 words.
  - action: max 14 words, one clear step only.
- Avoid repeating the same advice across sections.
- No generic filler.
- If data is missing, action should say exactly what to add/track.
For upcoming expenses: calculate affordability per deadline using monthly surplus (income minus contributions) plus current liquid savings.`

  const raw = await callOpenAI(prompt, 900)
  return parseJSON(raw)
}

export async function runGoalsAnalysis({ profile, finances, goals, section = null, notes = [] }) {
  const today = new Date().toISOString().split('T')[0]
  const ageCtx = getAgeContext(profile)
  const profileCtx = getProfileContext(profile)
  const finSummary = buildFinanceSummary(finances)

  const goalsJSON = JSON.stringify(goals.map(g => ({
    id: g.id,
    section: g.section || 'Financial',
    title: g.title,
    target: g.target || 0,
    progress: g.progress || 0,
    deadline: g.deadline || null,
    details: g.details || '',
    notes: g.notes || '',
    plan: g.plan || '',
    updates: g.updates || '',
  })))
  const notesSummary = (notes || [])
    .slice(0, 12)
    .map((n) => `- ${n.text || ''}`)
    .join('\n')

  const scopeText = section
    ? `Focus only on this section: "${section}".`
    : 'Analyze all sections together.'

  const prompt = `You are a concise financial coach. Today is ${today}. ${ageCtx} ${profileCtx}

${finSummary}

GOALS:
${goalsJSON}

USER NOTES (context to infer priorities and constraints):
${notesSummary || '(none)'}

${scopeText}

For each goal, read title + section + details/notes/plan/updates and estimate current standing. Examples:
- "Emergency fund" → look at liquid savings
- "Pay off credit cards" → look at how much debt remains vs original (estimate current progress)
- "Save for house deposit" → look at total savings + relevant accounts
- "Invest £X" → look at investment account totals
- "Pension pot £X" → look at pension totals
- "Learn to drive" or other non-financial goals → estimate completion percentage from details/plans/deadline and context

Respond with ONLY valid JSON:

{
  "goals": [
    {
      "id": <goal id>,
      "current_estimate": <number — if target > 0 then estimate current amount in £ toward target. If target is 0 then estimate progress % from 0-100. Must be a real number, not 0 unless truly nothing applies.>,
      "status": "on_track" | "needs_work" | "off_track",
      "summary": "<1 sentence with real numbers>",
      "action": "<1 sentence — specific next step with a number>"
    }
  ],
  "overall": "<2 sentences max — priorities and biggest lever to pull>"
}

Rules: Be concise. Use £ for money goals and % for non-money goals. Map goal titles to real account data intelligently. Use section/details/notes/plan/updates and user notes to make recommendations concrete.
If updates indicate recent completion or progress changes, reflect that in status and current_estimate.
Do not assume previous AI-estimated current amounts as ground truth; infer current_estimate freshly from financial data plus context.`

  const raw = await callOpenAI(prompt, 1500)
  return parseJSON(raw)
}
