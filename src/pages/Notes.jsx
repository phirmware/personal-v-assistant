import { useState } from 'react'
import { Plus, Trash2, StickyNote } from 'lucide-react'

export default function Notes({ notes, setNotes }) {
  const [text, setText] = useState('')

  function addNote(e) {
    e.preventDefault()
    if (!text.trim()) return
    setNotes([
      { id: Date.now(), text: text.trim(), date: new Date().toISOString() },
      ...notes,
    ])
    setText('')
  }

  function deleteNote(id) {
    setNotes(notes.filter((n) => n.id !== id))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Quick Notes</h1>

      <form onSubmit={addNote} className="flex gap-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Jot down a thought..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={18} /> Add
        </button>
      </form>

      <div className="space-y-2">
        {notes.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            No notes yet.
          </p>
        )}
        {notes.map((note) => (
          <div
            key={note.id}
            className="flex items-start gap-3 bg-gray-800/60 border border-gray-700/50 rounded-lg px-4 py-3 group"
          >
            <StickyNote size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="flex-1 text-gray-300 text-left text-sm">
              {note.text}
            </p>
            <span className="text-xs text-gray-600 shrink-0">
              {new Date(note.date).toLocaleDateString()}
            </span>
            <button
              onClick={() => deleteNote(note.id)}
              className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
