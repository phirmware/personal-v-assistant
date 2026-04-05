import { useState } from 'react'
import { Plus, Trash2, Star, StarOff } from 'lucide-react'

const PRIORITY_COLORS = {
  high: 'text-red-400',
  medium: 'text-yellow-400',
  low: 'text-gray-400',
}

export default function Tasks({ tasks, setTasks }) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')

  function addTask(e) {
    e.preventDefault()
    if (!title.trim()) return
    setTasks([
      ...tasks,
      {
        id: Date.now(),
        title: title.trim(),
        priority,
        done: false,
        pinned: false,
      },
    ])
    setTitle('')
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

  const sorted = [...tasks].sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned - a.pinned
    const p = { high: 3, medium: 2, low: 1 }
    return p[b.priority] - p[a.priority]
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Tasks</h1>

      <form onSubmit={addTask} className="flex gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={18} /> Add
        </button>
      </form>

      <div className="space-y-2">
        {sorted.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            No tasks yet. Add one above.
          </p>
        )}
        {sorted.map((task) => (
          <div
            key={task.id}
            className={`flex items-center gap-3 bg-gray-800/60 border border-gray-700/50 rounded-lg px-4 py-3 group ${task.done ? 'opacity-50' : ''}`}
          >
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => toggleDone(task.id)}
              className="w-4 h-4 accent-blue-500"
            />
            <span
              className={`flex-1 text-left ${task.done ? 'line-through text-gray-500' : 'text-white'}`}
            >
              {task.title}
            </span>
            <span
              className={`text-xs font-medium uppercase ${PRIORITY_COLORS[task.priority]}`}
            >
              {task.priority}
            </span>
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
        ))}
      </div>
    </div>
  )
}
