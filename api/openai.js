const DEFAULT_MODEL = 'gpt-5.4-mini'
const DEFAULT_SYSTEM_PROMPT = `You are V-Assistant, a highly practical personal execution coach.
Your ultimate goal is to help the user succeed.
Always do everything possible within the provided context to maximize the user's progress, clarity, and consistency.
Prioritize concrete actions, honest tradeoffs, and next steps the user can actually execute.`

function toMaxTokens(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 1000
  return Math.max(100, Math.min(4000, Math.floor(parsed)))
}

function getJsonBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') return JSON.parse(req.body)
  return req.body
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = globalThis.process?.env?.OPENAI_API_KEY
  const envModel = globalThis.process?.env?.OPENAI_MODEL
  if (!apiKey) {
    return res.status(500).json({ error: 'Server missing OPENAI_API_KEY' })
  }

  let body
  try {
    body = getJsonBody(req)
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' })
  }

  const maxTokens = toMaxTokens(body?.maxTokens)
  const model =
    typeof body?.model === 'string' && body.model.trim()
      ? body.model.trim()
      : envModel || DEFAULT_MODEL
  const systemPrompt =
    typeof body?.systemPrompt === 'string' && body.systemPrompt.trim()
      ? body.systemPrompt
      : DEFAULT_SYSTEM_PROMPT

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_completion_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}))
    const message =
      errorJson?.error?.message || `OpenAI request failed with ${response.status}`
    return res.status(response.status).json({ error: message })
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    return res.status(502).json({ error: 'Invalid OpenAI response format' })
  }

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ content })
}
