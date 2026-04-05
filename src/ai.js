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

// Build a detailed financial breakdown so the AI sees every account
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
  const liquidNet = totalSavings - totalDebt

  return `
FINANCIAL BREAKDOWN:
Monthly Income: £${income.toFixed(2)}

Savings Accounts (Liquid — Total: £${totalSavings.toFixed(2)}):
${sa.length ? sa.map(a => `  - ${a.name}: £${a.amount.toFixed(2)}`).join('\n') : '  (none)'}

Investment Accounts (Total: £${totalInvested.toFixed(2)}):
${inv.length ? inv.map(i => `  - ${i.name}: £${i.value.toFixed(2)}`).join('\n') : '  (none)'}

Pension Accounts (Total: £${totalPension.toFixed(2)}):
${pen.length ? pen.map(p => `  - ${p.name}: £${p.value.toFixed(2)}`).join('\n') : '  (none)'}

Credit Card Debt (Total: £${totalDebt.toFixed(2)}):
${cc.length ? cc.map(c => `  - ${c.name}: £${c.balance.toFixed(2)}`).join('\n') : '  (none)'}

Upcoming Expenses (Total: £${totalUpcoming.toFixed(2)}):
${ue.length ? ue.map(e => `  - ${e.name}: £${e.amount.toFixed(2)} by ${e.deadline}`).join('\n') : '  (none)'}

SUMMARY:
  Net Worth: £${netWorth.toFixed(2)}
  Liquid Net (savings - debt): £${liquidNet.toFixed(2)}
  After upcoming expenses: £${(liquidNet - totalUpcoming).toFixed(2)}
`
}

function getAgeContext(profile) {
  if (!profile.birthday) return ''
  const birth = new Date(profile.birthday)
  const now = new Date()
  const age = now.getFullYear() - birth.getFullYear() -
    (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0)
  const yearsToRetirement = Math.max(0, 67 - age)
  return `Age: ${age} years old (born ${profile.birthday}). Years to state pension age (67): ${yearsToRetirement}.`
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

  const prompt = `You are an expert financial advisor and wealth strategist. Today is ${today}.

You are analysing the financial position of ${profile.name || 'the user'}.
${ageCtx}

${finSummary}

Goals:
${goals.length ? goals.map(g => `- ${g.title}: target £${(g.target||0).toFixed(2)}, current £${(g.current||0).toFixed(2)}${g.deadline ? ` by ${g.deadline}` : ''}`).join('\n') : '(none set)'}

Provide a comprehensive but concise financial analysis. Structure your response EXACTLY with these sections:

## Financial Health Score
Give an overall score out of 10 and a one-line verdict.

## Core Insights
3-5 bullet points on the current financial state. Include net worth breakdown, savings rate assessment, debt-to-income ratio if applicable, and how their position compares to where someone their age should be.

## Red Flags — Act Now
List anything that needs urgent attention. If nothing is critical, say so.

## Targets to Improve
3-5 specific, actionable recommendations with precise numbers.

## Projections
Based on current income, savings rate, investment growth (7% annual for investments, 4% for pensions):
- Estimated net worth in 1 year, 5 years, and 10 years
- Whether they're on track for their goals
- Retirement readiness estimate

## Next Steps
The single most impactful thing they should do THIS WEEK.

Be direct, specific, and practical. Use £ for currency. Every sentence must reference their actual numbers.`

  return callOpenAI(prompt, 2000)
}

export async function runGoalsAnalysis({ profile, finances, goals }) {
  const today = new Date().toISOString().split('T')[0]
  const ageCtx = getAgeContext(profile)
  const finSummary = buildFinanceSummary(finances)

  const goalsJSON = JSON.stringify(goals.map(g => ({
    id: g.id,
    title: g.title,
    target: g.target || 0,
    current: g.current || 0,
    deadline: g.deadline || null,
  })))

  const prompt = `You are a concise, goal-focused financial coach. Today is ${today}. ${ageCtx}

${finSummary}

GOALS:
${goalsJSON}

TASK: Analyse each goal against the financial data above.

You MUST respond with ONLY valid JSON in this exact format — no markdown, no explanation before or after:

{
  "goals": [
    {
      "id": <goal id number>,
      "current_estimate": <number — your best estimate of where they currently stand toward this goal based on their financial data. For example if goal is "Emergency fund £5000" and they have £3000 in savings, current_estimate is 3000. For debt payoff goals use amount already paid. Use 0 if no clear mapping.>,
      "status": "on_track" | "needs_work" | "off_track",
      "summary": "<1 sentence — where they stand with real numbers>",
      "action": "<1 sentence — the specific next step with a number>"
    }
  ],
  "overall": "<2-3 sentences connecting the dots — priorities, biggest lever to pull>"
}

Rules:
- current_estimate must be a number derived from their actual financial data
- Reference specific account names and amounts
- Be brutally concise
- Use £ for currency in summary/action strings
- If they have no goals, suggest 3 in the goals array with id: 0`

  const raw = await callOpenAI(prompt, 1500)

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI did not return valid JSON')

  try {
    return JSON.parse(jsonMatch[0])
  } catch {
    throw new Error('Failed to parse AI response')
  }
}
