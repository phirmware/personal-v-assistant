# V-Assistant

A local-first AI-powered personal assistant web app — a daily decision engine for tasks, finances, goals, notes, and AI insights.

## Tech Stack

- **React 19** + **Vite 8** (requires Node 20.19+ or 22.12+; repo uses `.nvmrc` → Node 22)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin (no `tailwind.config.js` — config is in `src/index.css`)
- **lucide-react** for icons
- **OpenAI API** (gpt-4o-mini) for AI analysis features
- **localStorage** for all persistence (no backend)
- **PWA** — manual setup with `public/manifest.json`, `public/sw.js`, and meta tags in `index.html`
- Deployed on **Vercel** (`vercel.json` with SPA rewrites)

## Commands

```bash
nvm use 22          # required — Vite 8 needs Node 22+
npm run dev         # start dev server
npm run build       # production build
npm run preview     # preview production build
npm run lint        # eslint
```

## Project Structure

```
src/
  App.jsx              # Root component, all top-level state, sidebar nav, page routing
  main.jsx             # Entry point
  index.css            # Tailwind v4 imports
  ai.js                # OpenAI API calls — runAnalysis, runFinanceAnalysis, runGoalsAnalysis
  hooks/
    useLocalStorage.js # Custom hook with object-merge migration support
  pages/
    Home.jsx           # Dashboard — today's focus, metrics, alerts, latest AI insight
    Tasks.jsx          # Task management with priorities and pinning
    Finance.jsx        # Financial position dashboard (~700 lines, largest file)
    Goals.jsx          # Financial goals with AI auto-fill of progress
    Notes.jsx          # Quick note capture
    Insights.jsx       # AI insight history
  components/          # Currently empty — components are co-located in page files
public/
  manifest.json        # PWA manifest
  sw.js                # Service worker (cache-first, skips OpenAI calls)
  favicon.svg
  icons/               # PWA icons
```

## Architecture & Data Flow

### State Management
All state lives in `App.jsx` and is passed down as props. No context providers or state libraries.

Key state objects stored in localStorage (via `useLocalStorage` hook):
- `va-tasks` — array of task objects
- `va-finances` — object: `{ monthlyIncome, savingsAccounts[], creditCards[], investments[], pensions[], upcomingExpenses[], monthlyContributions[] }`
- `va-goals` — array of goal objects with `{ id, title, target, current, deadline }`
- `va-notes` — array of note objects
- `va-insights` — array of AI insight strings
- `va-profile` — `{ name, birthday, currency }`

### Data Migration
`useLocalStorage` merges stored objects with defaults (`{ ...initialValue, ...parsed }`), so adding new keys to the finance object doesn't break existing users' data. This is critical — the app is live with active users.

### AI Integration (`src/ai.js`)
- `buildFinanceSummary(finances)` — builds a text summary of all financial data for AI prompts, including monthly contributions and surplus calculations
- `runFinanceAnalysis()` — returns structured JSON: `{ score, savings, investments, pensions, debt, upcoming, contributions, overall }`
- `runGoalsAnalysis()` — returns structured JSON: `{ goals: [{id, current_estimate, status, summary, action}], overall }`
- `parseJSON(raw)` — extracts JSON from AI responses (handles markdown wrapping)
- AI results are displayed as inline per-section tips via the `AiTip` component (not large text blocks)

### Finance Page Patterns
- `AccountSection` — reusable component for all list sections (savings, cards, investments, pensions, contributions)
- `AiTip` — inline per-section AI insight component
- `StatusBadge` — RAG (Red/Amber/Green) status for upcoming expenses
- `getExpenseStatus()` — uses monthly surplus (income - contributions) to project affordability by deadline
- All account names are inline-editable
- Safe defaults everywhere: `const saList = finances.savingsAccounts || []`

### Goals Page
- AI auto-fills `current` values by mapping goal titles to finance data (e.g., "Emergency fund" → liquid savings)
- `current` is display-only, not user-editable
- Status: `on_track` / `needs_work` / `off_track` with color-coded badges

## Important Conventions

- **Don't break existing data structures** — the app is live. Add new fields with defaults; the useLocalStorage merge handles migration. Never rename or remove existing keys without a migration strategy.
- **Currency is GBP** (£) — hardcoded in the `GBP()` formatter and AI prompts.
- **Dark theme only** — `bg-gray-950` base, gray-800/900 cards, consistent color scheme throughout.
- **Mobile responsive** — all pages use responsive Tailwind classes (`sm:`, `lg:`). Test both mobile and desktop layouts.
- **AI responses must be structured JSON** — prompts explicitly request "ONLY valid JSON, no markdown". Responses are parsed with `parseJSON()`.
- **Environment variable**: `VITE_OPENAI_API_KEY` — stored in `.env` (gitignored). See `.env.example`.
- After making changes, a hard refresh (Cmd+Shift+R) is sometimes needed in the browser due to service worker caching.
