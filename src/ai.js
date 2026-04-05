const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY'

async function callOpenAI(prompt, maxTokens = 1000) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-5.4-mini',
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: maxTokens,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error: ${res.status}`)
  }

  const data = await res.json()
  return data.choices[0].message.content
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

function parseJSON(raw) {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI did not return valid JSON')
  try {
    return JSON.parse(match[0])
  } catch {
    throw new Error('Failed to parse AI response')
  }
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

Respond in concise markdown with:
1) Three actionable suggestions
2) One likely blocker to watch
3) The best first step to do in the next 15 minutes

Keep total response under 120 words.`

  return callOpenAI(prompt, 500)
}

export async function runFinanceAnalysis({ profile, finances, goals }) {
  const today = new Date().toISOString().split('T')[0]
  const ageCtx = getAgeContext(profile)
  const finSummary = buildFinanceSummary(finances)

  const prompt = `You are a concise financial advisor. Today is ${today}. ${ageCtx}

${finSummary}

Goals:
${goals.length ? goals.map(g => `- ${g.title}: target £${(g.target||0).toFixed(2)}${g.deadline ? ` by ${g.deadline}` : ''}`).join('\n') : '(none)'}

Respond with ONLY valid JSON, no markdown:

{
  "score": { "value": <1-10>, "label": "<one-line verdict>" },
  "savings": { "summary": "<1 sentence on savings position>", "action": "<1 specific action with numbers>" },
  "investments": { "summary": "<1 sentence on investment position>", "action": "<1 specific action>" },
  "pensions": { "summary": "<1 sentence on pension position>", "action": "<1 specific action>" },
  "debt": { "summary": "<1 sentence on debt position>", "action": "<1 specific action>" },
  "upcoming": { "summary": "<1 sentence on upcoming expenses feasibility>", "action": "<1 specific action>" },
  "contributions": { "summary": "<1 sentence on monthly contribution strategy>", "action": "<1 specific action>" },
  "overall": "<2 sentences: biggest risk + single most impactful next step this week>"
}

Rules: Be brutally concise. Use £. Reference their actual account names and numbers. Every sentence must be specific to their data, not generic.
For upcoming expenses: calculate whether the user can afford each expense by its deadline. Use monthly surplus (income minus contributions) to project how much they can accumulate by each deadline. Example: if surplus is £500/month and expense is £2000 in 3 months, they can save £1500 from surplus alone — factor in existing liquid savings too.`

  const raw = await callOpenAI(prompt, 1200)
  return parseJSON(raw)
}

export async function runGoalsAnalysis({ profile, finances, goals, section = null }) {
  const today = new Date().toISOString().split('T')[0]
  const ageCtx = getAgeContext(profile)
  const finSummary = buildFinanceSummary(finances)

  const goalsJSON = JSON.stringify(goals.map(g => ({
    id: g.id,
    section: g.section || 'Financial',
    title: g.title,
    target: g.target || 0,
    current: g.current || 0,
    progress: g.progress || 0,
    deadline: g.deadline || null,
    details: g.details || '',
    notes: g.notes || '',
    plan: g.plan || '',
  })))

  const scopeText = section
    ? `Focus only on this section: "${section}".`
    : 'Analyze all sections together.'

  const prompt = `You are a concise financial coach. Today is ${today}. ${ageCtx}

${finSummary}

GOALS:
${goalsJSON}

${scopeText}

For each goal, read title + section + details/notes/plan and estimate current standing. Examples:
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

Rules: Be concise. Use £ for money goals and % for non-money goals. Map goal titles to real account data intelligently. Use section/details/notes/plan to make recommendations concrete.`

  const raw = await callOpenAI(prompt, 1500)
  return parseJSON(raw)
}
