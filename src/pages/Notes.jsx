import { useState } from 'react'
import { Plus, Trash2, StickyNote, ChevronDown, ChevronUp } from 'lucide-react'
import EmptyState from '../components/EmptyState'

export default function Notes({ notes, setNotes }) {
  const [text, setText] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [openMap, setOpenMap] = useState({})

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

  function toggleOpen(id) {
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Quick Notes</h1>

      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setAddOpen((prev) => !prev)}
          className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between text-left"
        >
          <div>
            <p className="text-sm sm:text-base font-semibold text-white">Add Note</p>
            <p className="text-xs text-gray-500">Capture quickly, review without clutter.</p>
          </div>
          {addOpen ? (
            <ChevronUp size={16} className="text-gray-500" />
          ) : (
            <ChevronDown size={16} className="text-gray-500" />
          )}
        </button>
        {addOpen && (
          <form
            onSubmit={addNote}
            className="border-t border-gray-700/60 px-4 sm:px-5 py-4 flex flex-col sm:flex-row gap-3"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Jot down a thought..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="app-primary-btn text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
            >
              <Plus size={18} /> Add
            </button>
          </form>
        )}
      </div>

      <div className="space-y-2">
        {notes.length === 0 && (
          <EmptyState
            icon={StickyNote}
            title="No notes yet"
            description="Capture a quick thought, reminder, or idea."
          />
        )}
        {notes.map((note) => {
          const isOpen = Boolean(openMap[note.id])
          return (
            <div
              key={note.id}
              className="bg-gray-800/60 border border-gray-700/50 rounded-lg overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleOpen(note.id)}
                className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <StickyNote size={16} className="text-amber-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className={`text-sm text-gray-300 ${isOpen ? '' : 'truncate'}`}>
                      {note.text}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(note.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp size={16} className="text-gray-500 shrink-0" />
                ) : (
                  <ChevronDown size={16} className="text-gray-500 shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="border-t border-gray-700/60 px-4 py-3 flex justify-end">
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
