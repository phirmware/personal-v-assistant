import { useState } from 'react'
import {
  Plus,
  Trash2,
  Star,
  StarOff,
  Brain,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { runTaskSuggestion } from '../ai'
import MarkdownContent from '../components/MarkdownContent'
import EmptyState from '../components/EmptyState'

const PRIORITY_COLORS = {
  high: 'text-red-400',
  medium: 'text-yellow-400',
  low: 'text-gray-400',
}

export default function Tasks({ tasks, setTasks }) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [details, setDetails] = useState('')
  const [openMap, setOpenMap] = useState({})
  const [addOpen, setAddOpen] = useState(false)
  const [aiLoadingId, setAiLoadingId] = useState(null)
  const [aiError, setAiError] = useState(null)

  function addTask(e) {
    e.preventDefault()
    if (!title.trim()) return
    setTasks([
      ...tasks,
      {
        id: Date.now(),
        title: title.trim(),
        priority,
        details: details.trim(),
        done: false,
        pinned: false,
        aiSuggestion: '',
      },
    ])
    setTitle('')
    setDetails('')
  }

  function toggleDone(id) {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  function togglePin(id) {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)))
  }

  function deleteTask(id) {
    setTasks(tasks.filter((t) => t.id !== id))
  }

  function updateTask(id, field, value) {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, [field]: value } : t)))
  }

  function toggleOpen(id) {
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleTaskAI(task) {
    setAiError(null)
    setAiLoadingId(task.id)
    try {
      const content = await runTaskSuggestion({
        task: {
          title: task.title,
          priority: task.priority,
          details: task.details || '',
        },
      })
      updateTask(task.id, 'aiSuggestion', content)
      setOpenMap((prev) => ({ ...prev, [task.id]: true }))
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoadingId(null)
    }
  }

  const sorted = [...tasks].sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned - a.pinned
    const p = { high: 3, medium: 2, low: 1 }
    return p[b.priority] - p[a.priority]
  })

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Tasks</h1>

      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setAddOpen((prev) => !prev)}
          className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between text-left"
        >
          <div>
            <p className="text-sm sm:text-base font-semibold text-white">Add Task</p>
            <p className="text-xs text-gray-500">Keep collapsed while focusing on active work.</p>
          </div>
          {addOpen ? (
            <ChevronUp size={16} className="text-gray-500" />
          ) : (
            <ChevronDown size={16} className="text-gray-500" />
          )}
        </button>
        {addOpen && (
          <form
            onSubmit={addTask}
            className="border-t border-gray-700/60 p-4 space-y-3"
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add a task..."
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-300 focus:outline-none focus:border-blue-500"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Task details, context, blockers, or plan..."
              rows={2}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-y"
            />
            <button
              type="submit"
              className="app-primary-btn text-white px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus size={18} /> Add Task
            </button>
          </form>
        )}
      </div>

      {aiError && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">
          {aiError}
        </div>
      )}

      <div className="space-y-2">
        {sorted.length === 0 && (
          <EmptyState
            icon={Plus}
            title="No tasks yet"
            description="Add your first task to start building momentum."
          />
        )}
        {sorted.map((task) => (
          <div
            key={task.id}
            className={`bg-gray-800/60 border border-gray-700/50 rounded-lg px-4 py-3 group space-y-3 ${task.done ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => toggleDone(task.id)}
                className="w-4 h-4 accent-blue-500"
              />
              <span
                className={`flex-1 text-left min-w-0 break-words ${task.done ? 'line-through text-gray-500' : 'text-white'}`}
              >
                {task.title}
              </span>
              <span
                className={`text-xs font-medium uppercase ${PRIORITY_COLORS[task.priority]} shrink-0`}
              >
                {task.priority}
              </span>
              <button
                onClick={() => toggleOpen(task.id)}
                className="text-gray-500 app-accent-hover-text transition-colors"
                title={openMap[task.id] ? 'Collapse task' : 'Expand task'}
              >
                {openMap[task.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <button
                onClick={() => togglePin(task.id)}
                className="text-gray-500 hover:text-yellow-400 transition-colors"
                title={task.pinned ? 'Unpin from focus' : 'Pin to focus'}
              >
                {task.pinned ? <Star size={16} fill="currentColor" /> : <StarOff size={16} />}
              </button>
              <button
                onClick={() => deleteTask(task.id)}
                className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {openMap[task.id] && (
              <div className="space-y-2">
                <textarea
                  value={task.details || ''}
                  onChange={(e) => updateTask(task.id, 'details', e.target.value)}
                  placeholder="Add task details..."
                  rows={2}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-y"
                />
                <div className="flex justify-between items-center gap-2">
                  <button
                    onClick={() => handleTaskAI(task)}
                    disabled={aiLoadingId !== null}
                    className="app-primary-btn text-xs text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    {aiLoadingId === task.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Brain size={12} />
                    )}
                    {aiLoadingId === task.id ? 'Thinking...' : 'AI Suggest'}
                  </button>
                </div>
                {task.aiSuggestion && (
                  <div className="bg-gray-900/70 border border-gray-700 rounded-lg p-3">
                    <MarkdownContent content={task.aiSuggestion} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
