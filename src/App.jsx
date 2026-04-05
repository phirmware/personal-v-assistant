import { useState } from 'react'
import {
  Home as HomeIcon,
  CheckSquare,
  DollarSign,
  Target,
  StickyNote,
  Brain,
  Menu,
  X,
} from 'lucide-react'
import { useLocalStorage } from './hooks/useLocalStorage'
import Home from './pages/Home'
import Tasks from './pages/Tasks'
import Finance from './pages/Finance'
import Goals from './pages/Goals'
import Notes from './pages/Notes'
import Insights from './pages/Insights'

const NAV = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'finance', label: 'Finance', icon: DollarSign },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'insights', label: 'Insights', icon: Brain },
]

export default function App() {
  const [page, setPage] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [tasks, setTasks] = useLocalStorage('va-tasks', [])
  const [finances, setFinances] = useLocalStorage('va-finances', {
    monthlyIncome: 0,
    savingsAccounts: [],
    creditCards: [],
    investments: [],
    pensions: [],
    upcomingExpenses: [],
  })
  const [goals, setGoals] = useLocalStorage('va-goals', [])
  const [notes, setNotes] = useLocalStorage('va-notes', [])
  const [insights, setInsights] = useLocalStorage('va-insights', [])
  const [profile, setProfile] = useLocalStorage('va-profile', {
    name: '',
    birthday: '',
    currency: 'GBP',
  })

  function navigate(id) {
    setPage(id)
    setSidebarOpen(false)
  }

  function renderPage() {
    switch (page) {
      case 'tasks':
        return <Tasks tasks={tasks} setTasks={setTasks} />
      case 'finance':
        return <Finance finances={finances} setFinances={setFinances} goals={goals} profile={profile} setProfile={setProfile} />
      case 'goals':
        return <Goals goals={goals} setGoals={setGoals} finances={finances} profile={profile} />
      case 'notes':
        return <Notes notes={notes} setNotes={setNotes} />
      case 'insights':
        return <Insights insights={insights} setInsights={setInsights} />
      default:
        return (
          <Home
            tasks={tasks}
            goals={goals}
            finances={finances}
            notes={notes}
            insights={insights}
            setInsights={setInsights}
            setPage={setPage}
          />
        )
    }
  }

  return (
    <div className="dark flex h-screen bg-gray-950 text-gray-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static z-30 h-full w-56 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-800">
          <Brain size={24} className="text-blue-500" />
          <span className="font-bold text-lg text-white tracking-tight">
            V-Assistant
          </span>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = page === item.id
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'text-blue-400 bg-blue-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="px-5 py-4 border-t border-gray-800 text-xs text-gray-600">
          Local-first. Your data stays on device.
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu size={20} className="text-gray-400" />
          </button>
          <span className="font-bold text-white">V-Assistant</span>
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">{renderPage()}</div>
      </main>
    </div>
  )
}
