import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function openAiDevApiPlugin({ apiKey, model }) {
  return {
    name: 'openai-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/openai', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        if (!apiKey) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Server missing OPENAI_API_KEY' }))
          return
        }

        try {
          const rawBody = await new Promise((resolve, reject) => {
            let body = ''
            req.on('data', (chunk) => {
              body += chunk
            })
            req.on('end', () => resolve(body))
            req.on('error', reject)
          })

          const parsed = rawBody ? JSON.parse(rawBody) : {}
          const prompt = typeof parsed?.prompt === 'string' ? parsed.prompt.trim() : ''
          if (!prompt) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Prompt is required' }))
            return
          }

          const maxTokens = Number.isFinite(Number(parsed?.maxTokens))
            ? Math.max(100, Math.min(4000, Math.floor(Number(parsed.maxTokens))))
            : 1000

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: model || 'gpt-5.4-mini',
              messages: [
                {
                  role: 'system',
                  content:
                    typeof parsed?.systemPrompt === 'string' && parsed.systemPrompt.trim()
                      ? parsed.systemPrompt
                      : 'You are a highly practical personal execution coach.',
                },
                { role: 'user', content: prompt },
              ],
              max_completion_tokens: maxTokens,
            }),
          })

          if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            res.statusCode = response.status
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                error: err?.error?.message || `OpenAI request failed with ${response.status}`,
              })
            )
            return
          }

          const data = await response.json()
          const content = data?.choices?.[0]?.message?.content
          if (typeof content !== 'string') {
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Invalid OpenAI response format' }))
            return
          }

          res.statusCode = 200
          res.setHeader('Cache-Control', 'no-store')
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ content }))
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Invalid JSON body' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const rootDir = new URL('.', import.meta.url).pathname
  const env = loadEnv(mode, rootDir, '')
  const nodeEnv = globalThis.process?.env || {}
  return {
    plugins: [
      react(),
      tailwindcss(),
      openAiDevApiPlugin({
        apiKey: env.OPENAI_API_KEY || nodeEnv.OPENAI_API_KEY || '',
        model: env.OPENAI_MODEL || nodeEnv.OPENAI_MODEL || 'gpt-5.4-mini',
      }),
    ],
  }
})
