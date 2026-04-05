const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY'

async function callOpenAI(prompt, maxTokens = 1000) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
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
  const income = finances.monthlyIncome || 0

  const totalSavings = sa.reduce((s, a) => s + a.amount, 0)
  const totalInvested = inv.reduce((s, i) => s + i.value, 0)
  const totalPension = pen.reduce((s, p) => s + p.value, 0)
  const totalDebt = cc.reduce((s, c) => s + c.balance, 0)
  const totalUpcoming = ue.reduce((s, e) => s + e.amount, 0)
  const netWorth = totalSavings + totalInvested + totalPension - totalDebt

  return `
FINANCIAL BREAKDOWN:
Monthly Income: £${income.toFixed(2)}

Savings Accounts (Total: £${totalSavings.toFixed(2)}):
${sa.length ? sa.map(a => `  - ${a.name}: £${a.amount.toFixed(2)}`).join('\n') : '  (none)'}

Investment Accounts (Total: £${totalInvested.toFixed(2)}):
${inv.length ? inv.map(i => `  - ${i.name}: £${i.value.toFixed(2)}`).join('\n') : '  (none)'}

Pension Accounts (Total: £${totalPension.toFixed(2)}):
${pen.length ? pen.map(p => `  - ${p.name}: £${p.value.toFixed(2)}`).join('\n') : '  (none)'}

Credit Card Debt (Total: £${totalDebt.toFixed(2)}):
${cc.length ? cc.map(c => `  - ${c.name}: £${c.balance.toFixed(2)}`).join('\n') : '  (none)'}

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
  "overall": "<2 sentences: biggest risk + single most impactful next step this week>"
}

Rules: Be brutally concise. Use £. Reference their actual account names and numbers. Every sentence must be specific to their data, not generic.`

  const raw = await callOpenAI(prompt, 1200)
  return parseJSON(raw)
}

export async function runGoalsAnalysis({ profile, finances, goals }) {
  const today = new Date().toISOString().split('T')[0]
  const ageCtx = getAgeContext(profile)
  const finSummary = buildFinanceSummary(finances)

  const goalsJSON = JSON.stringify(goals.map(g => ({
    id: g.id,
    title: g.title,
    target: g.target || 0,
    deadline: g.deadline || null,
  })))

  const prompt = `You are a concise financial coach. Today is ${today}. ${ageCtx}

${finSummary}

GOALS:
${goalsJSON}

For each goal, read the goal title carefully and estimate their current standing based on the financial data. Examples:
- "Emergency fund" → look at liquid savings
- "Pay off credit cards" → look at how much debt remains vs original (estimate current progress)
- "Save for house deposit" → look at total savings + relevant accounts
- "Invest £X" → look at investment account totals
- "Pension pot £X" → look at pension totals

Respond with ONLY valid JSON:

{
  "goals": [
    {
      "id": <goal id>,
      "current_estimate": <number — estimated current progress toward target based on their financial data and goal title. Must be a real number from their data, not 0 unless truly nothing applies.>,
      "status": "on_track" | "needs_work" | "off_track",
      "summary": "<1 sentence with real numbers>",
      "action": "<1 sentence — specific next step with a number>"
    }
  ],
  "overall": "<2 sentences max — priorities and biggest lever to pull>"
}

Rules: Be concise. Use £. Map goal titles to real account data intelligently.`

  const raw = await callOpenAI(prompt, 1500)
  return parseJSON(raw)
}
