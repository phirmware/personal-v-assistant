import { useEffect, useState } from 'react'
import {
  Plus,
  Trash2,
  StickyNote,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  Search,
} from 'lucide-react'
import EmptyState from '../components/EmptyState'
import MarkdownContent from '../components/MarkdownContent'
import { runNotesInsight, runNoteSuggestion } from '../ai'

export default function Notes({ notes, setNotes }) {
  const [text, setText] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [openMap, setOpenMap] = useState({})
  const [search, setSearch] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiInsightOpen, setAiInsightOpen] = useState(false)
  const [noteAiLoadingId, setNoteAiLoadingId] = useState(null)
  const [noteAiOpenMap, setNoteAiOpenMap] = useState({})

  const [notesMeta, setNotesMeta] = useState(() => {
    try {
      const raw = localStorage.getItem('va-notes-meta')
      const parsed = raw ? JSON.parse(raw) : {}
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  })

  function persistNotesMeta(next) {
    setNotesMeta(next)
    localStorage.setItem('va-notes-meta', JSON.stringify(next))
  }

  useEffect(() => {
    const noteIds = new Set(notes.map((note) => String(note.id)))
    let changed = false
    const nextMeta = {}

    if (notesMeta.__summary) nextMeta.__summary = notesMeta.__summary

    for (const [key, value] of Object.entries(notesMeta)) {
      if (key === '__summary') continue
      if (noteIds.has(String(key))) {
        nextMeta[key] = value
      } else {
        changed = true
      }
    }

    if (!changed) return
    setNotesMeta(nextMeta)
    localStorage.setItem('va-notes-meta', JSON.stringify(nextMeta))
  }, [notes, notesMeta])

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
    const { [id]: removed, ...rest } = notesMeta
    void removed
    persistNotesMeta(rest)
    setOpenMap((prev) => {
      const { [id]: removedOpen, ...restOpen } = prev
      void removedOpen
      return restOpen
    })
    setNoteAiOpenMap((prev) => {
      const { [id]: removedOpen, ...restOpen } = prev
      void removedOpen
      return restOpen
    })
  }

  function toggleOpen(id) {
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleNoteAi(id) {
    setNoteAiOpenMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function updateNote(id, value) {
    setNotes(notes.map((note) =>
      note.id === id
        ? {
            ...note,
            text: value,
          }
        : note
    ))
  }

  async function handleNotesAI() {
    if (notes.length === 0) return
    setAiError(null)
    setAiLoading(true)
    try {
      const insight = await runNotesInsight({ notes })
      const nextMeta = {
        ...notesMeta,
        __summary: {
          insight,
          date: new Date().toISOString(),
        },
      }
      persistNotesMeta(nextMeta)
      setAiInsightOpen(true)
    } catch (err) {
      setAiError(err.message)
    } finally {
      setAiLoading(false)
    }
  }

  async function handleNoteAI(note) {
    setAiError(null)
    setNoteAiLoadingId(note.id)
    try {
      const suggestion = await runNoteSuggestion({ note })
      const currentMeta = notesMeta[note.id] || {}
      const nextMeta = {
        ...notesMeta,
        [note.id]: {
          ...currentMeta,
          aiSuggestion: suggestion,
          aiDate: new Date().toISOString(),
        },
      }
      persistNotesMeta(nextMeta)
      setOpenMap((prev) => ({ ...prev, [note.id]: true }))
      setNoteAiOpenMap((prev) => ({ ...prev, [note.id]: true }))
    } catch (err) {
      setAiError(err.message)
    } finally {
      setNoteAiLoadingId(null)
    }
  }

  const summaryInsight = notesMeta.__summary?.insight || ''
  const summaryDate = notesMeta.__summary?.date || null
  const normalizedSearch = search.trim().toLowerCase()
  const filteredNotes = normalizedSearch
    ? notes.filter((note) => String(note.text || '').toLowerCase().includes(normalizedSearch))
    : notes

  return (
    <div className="page-shell space-y-5 sm:space-y-6">
      <section className="page-top-ui">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="page-top-ui-kicker">Notes Space</p>
            <h2 className="page-top-ui-title">Capture and refine ideas</h2>
            <p className="page-top-ui-meta">Searchable notes with optional AI guidance.</p>
          </div>
          <span className="page-top-ui-pill">
            {notes.length} note{notes.length === 1 ? '' : 's'}
          </span>
        </div>
      </section>

      {aiError && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">
          {aiError}
        </div>
      )}

      <section className="page-group">
        <p className="page-group-kicker">Insight</p>
        <div className="app-surface-sheet overflow-hidden">
          <div className="app-section-toggle w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-2 text-left">
            <button
              type="button"
              onClick={() => setAiInsightOpen((prev) => !prev)}
              className="flex-1 min-w-0 flex items-center gap-2 text-left"
            >
              <Sparkles size={18} className="text-indigo-300 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm sm:text-base font-semibold text-white">Notes AI Insight</p>
                <p className="text-xs text-gray-500">
                  {summaryDate
                    ? `Updated ${new Date(summaryDate).toLocaleDateString()}`
                    : 'Summarize themes, risks, and actions from your notes'}
                </p>
              </div>
              {aiInsightOpen ? (
                <ChevronUp size={16} className="text-gray-500 shrink-0" />
              ) : (
                <ChevronDown size={16} className="text-gray-500 shrink-0" />
              )}
            </button>
            <button
              type="button"
              onClick={handleNotesAI}
              disabled={aiLoading || notes.length === 0}
              className="app-primary-btn text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-60 shrink-0"
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {aiLoading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
          {aiInsightOpen && (
            <div className="border-t border-gray-700/60 px-4 sm:px-5 py-4">
              {summaryInsight ? (
                <MarkdownContent content={summaryInsight} />
              ) : (
                <p className="text-sm text-gray-500">
                  Run analysis once you have notes to get patterns and next actions.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="page-group">
        <div className="section-header-inline">
          <p className="section-header-title">Search</p>
          <p className="section-header-meta">Filter by keyword</p>
        </div>
        <div className="app-strip-cell p-3 sm:p-4">
          <div className="input-shell relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="page-group">
        <p className="page-group-kicker">Capture</p>
        <div className="app-surface-sheet overflow-hidden">
          <button
            type="button"
            onClick={() => setAddOpen((prev) => !prev)}
            className="app-section-toggle w-full px-4 sm:px-5 py-3.5 flex items-center justify-between text-left"
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
              <div className="input-shell flex-1">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Jot down a thought..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                className="app-primary-btn text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
              >
                <Plus size={18} /> Add
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="page-group">
        <div className="section-header-inline">
          <p className="section-header-title">Library</p>
          <p className="section-header-meta">{filteredNotes.length} visible</p>
        </div>
        <div className="page-group-shell">
          <div className="app-surface-list">
            {notes.length === 0 && (
              <EmptyState
                icon={StickyNote}
                title="No notes yet"
                description="Capture a quick thought, reminder, or idea."
              />
            )}

            {notes.length > 0 && filteredNotes.length === 0 && (
              <EmptyState
                icon={Search}
                title="No matching notes"
                description="Try a different keyword or clear your search."
              />
            )}

            {filteredNotes.map((note) => {
              const isOpen = Boolean(openMap[note.id])
              const noteMeta = notesMeta[note.id] || {}
              const noteAiSuggestion = noteMeta.aiSuggestion || ''
              const noteAiDate = noteMeta.aiDate || null
              const noteAiOpen = Boolean(noteAiOpenMap[note.id])
              return (
                <div
                  key={note.id}
                  className="app-surface-row overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleOpen(note.id)}
                    className="app-section-toggle w-full px-4 py-3 flex items-start justify-between gap-3 text-left"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <StickyNote size={16} className="text-amber-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className={`text-sm text-gray-300 ${isOpen ? 'line-clamp-none' : 'line-clamp-2'}`}>
                          {note.text}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {new Date(note.date).toLocaleDateString()}
                          {noteAiDate ? ` · AI ${new Date(noteAiDate).toLocaleDateString()}` : ''}
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
                    <div className="border-t border-gray-700/60 px-4 py-3 space-y-3">
                      <div className="input-shell">
                        <textarea
                          value={note.text}
                          onChange={(e) => updateNote(note.id, e.target.value)}
                          rows={3}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-y"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleNoteAI(note)}
                          disabled={noteAiLoadingId !== null}
                          className="app-primary-btn text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-60"
                        >
                          {noteAiLoadingId === note.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Sparkles size={12} />
                          )}
                          {noteAiLoadingId === note.id ? 'Thinking...' : 'AI Suggest'}
                        </button>
                        <div className="flex items-center gap-2">
                          {noteAiSuggestion && (
                            <button
                              type="button"
                              onClick={() => toggleNoteAi(note.id)}
                              className="text-xs text-gray-500 app-accent-hover-text transition-colors"
                            >
                              {noteAiOpen ? 'Hide AI' : 'Show AI'}
                            </button>
                          )}
                          <button
                            onClick={() => deleteNote(note.id)}
                            className="text-gray-500 hover:text-red-400 transition-colors shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {noteAiSuggestion && noteAiOpen && (
                        <div className="bg-gray-900/70 border border-gray-700 rounded-lg p-3">
                          <MarkdownContent content={noteAiSuggestion} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
