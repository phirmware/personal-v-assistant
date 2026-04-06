# V-Assistant

Local-first AI-powered personal assistant for tasks, finances, goals, notes, and insights.

## Environment variables

AI requests are proxied through a server-side Vercel function (`/api/openai`) so the OpenAI key is never exposed in the browser.

Set these variables in Vercel project settings (and in local `.env` for local API runtime):

- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` (optional, defaults to `gpt-5.4-mini`)

Do not use `VITE_OPENAI_API_KEY`; client-side keys are insecure.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
