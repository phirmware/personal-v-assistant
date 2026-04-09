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
import SwipeToDelete from '../components/SwipeToDelete'
import SkeletonBlock from '../components/SkeletonBlock'
import { runNoteBrainstorm, runNotesInsight, runNoteSuggestion } from '../ai'
import { relativeTime } from '../utils/time'

function getNoteBody(note) {
  if (typeof note?.body === 'string') return note.body
  if (typeof note?.text === 'string') return note.text
  return ''
}

function deriveTitleFromBody(body) {
  const text = String(body || '').trim()
  if (!text) return 'Untitled'
  const firstLine = text.split('\n').find((line) => line.trim()) || text
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine
}

function getNoteTitle(note) {
  if (typeof note?.title === 'string' && note.title.trim()) return note.title
  return deriveTitleFromBody(getNoteBody(note))
}

export default function Notes({ notes, setNotes, showToast }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [formShake, setFormShake] = useState(false)
  const [openMap, setOpenMap] = useState({})
  const [search, setSearch] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiInsightOpen, setAiInsightOpen] = useState(false)
  const [noteAiLoadingId, setNoteAiLoadingId] = useState(null)
  const [noteAiOpenMap, setNoteAiOpenMap] = useState({})
  const [brainstormInputMap, setBrainstormInputMap] = useState({})

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

  function autoResizeTextarea(el) {
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    let changed = false
    const migrated = notes.map((note) => {
      const nextBody = getNoteBody(note)
      const hasTitle = typeof note?.title === 'string' && note.title.trim().length > 0
      const hasBody = typeof note?.body === 'string'
      const hasText = note?.text === nextBody
      const hasDate = typeof note?.date === 'string' && note.date.length > 0
      if (hasTitle && hasBody && hasText && hasDate) return note
      changed = true
      return {
        ...note,
        title: hasTitle ? note.title : deriveTitleFromBody(nextBody),
        body: nextBody,
        text: nextBody,
        date: hasDate ? note.date : new Date().toISOString(),
      }
    })
    if (changed) setNotes(migrated)
  }, [notes, setNotes])

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
    if (!title.trim() || !body.trim()) {
      setFormShake(true)
      setTimeout(() => setFormShake(false), 450)
      return
    }
    setNotes([
      {
        id: Date.now(),
        title: title.trim(),
        body: body.trim(),
        text: body.trim(),
        date: new Date().toISOString(),
      },
      ...notes,
    ])
    setTitle('')
    setBody('')
  }

  function deleteNote(id) {
    const deleted = notes.find((n) => n.id === id)
    setNotes(notes.filter((n) => n.id !== id))
    if (deleted) {
      showToast?.(`Note deleted`, {
        type: 'danger',
        duration: 5000,
        onUndo: () => setNotes((prev) => [deleted, ...prev]),
      })
    }
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

  function updateNote(id, field, value) {
    setNotes(notes.map((note) =>
      note.id === id
        ? {
            ...note,
            title: field === 'title' ? value : getNoteTitle(note),
            body: field === 'body' ? value : getNoteBody(note),
            text: field === 'body' ? value : getNoteBody(note),
          }
        : note
    ))
  }

  async function handleNotesAI() {
    const normalizedNotes = notes.map((note) => ({
      ...note,
      title: getNoteTitle(note),
      body: getNoteBody(note),
      text: getNoteBody(note),
    }))
    if (normalizedNotes.length === 0) return
    setAiError(null)
    setAiLoading(true)
    try {
      const insight = await runNotesInsight({ notes: normalizedNotes })
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

  async function handleNoteBrainstorm(note) {
    const userMessage = String(brainstormInputMap[note.id] || '').trim()
    if (!userMessage) return
    setAiError(null)
    setNoteAiLoadingId(note.id)
    try {
      const noteMeta = notesMeta[note.id] || {}
      const conversation = Array.isArray(noteMeta.brainstormConversation)
        ? noteMeta.brainstormConversation
        : []
      const nextConversation = [
        ...conversation,
        { role: 'user', content: userMessage, date: new Date().toISOString() },
      ]

      const result = await runNoteBrainstorm({
        note: {
          title: getNoteTitle(note),
          body: getNoteBody(note),
        },
        conversation: nextConversation,
        userMessage,
      })

      const assistantText = String(result?.assistant_markdown || '').trim()
      const suggestedBody = String(result?.suggested_body || '').trim()
      const updatedConversation = assistantText
        ? [...nextConversation, { role: 'assistant', content: assistantText, date: new Date().toISOString() }]
        : nextConversation

      const nextMeta = {
        ...notesMeta,
        [note.id]: {
          ...noteMeta,
          brainstormConversation: updatedConversation,
          brainstormSuggestedBody: suggestedBody || getNoteBody(note),
          brainstormUpdatedAt: new Date().toISOString(),
        },
      }
      persistNotesMeta(nextMeta)
      setBrainstormInputMap((prev) => ({ ...prev, [note.id]: '' }))
      setOpenMap((prev) => ({ ...prev, [note.id]: true }))
      setNoteAiOpenMap((prev) => ({ ...prev, [note.id]: true }))
    } catch (err) {
      setAiError(err.message)
    } finally {
      setNoteAiLoadingId(null)
    }
  }

  function applyBrainstormDraft(noteId) {
    const noteMeta = notesMeta[noteId] || {}
    const draft = String(noteMeta.brainstormSuggestedBody || '').trim()
    if (!draft) return
    updateNote(noteId, 'body', draft)
    showToast?.('Draft applied to note description', { type: 'success' })
  }

  const summaryInsight = notesMeta.__summary?.insight || ''
  const summaryDate = notesMeta.__summary?.date || null
  const normalizedNotes = notes.map((note) => ({
    ...note,
    title: getNoteTitle(note),
    body: getNoteBody(note),
    text: getNoteBody(note),
  }))
  const normalizedSearch = search.trim().toLowerCase()
  const filteredNotes = normalizedSearch
    ? normalizedNotes.filter((note) =>
        `${note.title} ${note.body}`.toLowerCase().includes(normalizedSearch)
      )
    : normalizedNotes

  return (
    <div className="page-shell space-y-5 sm:space-y-6 stagger-reveal">
      <section className="page-top-ui">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="page-top-ui-kicker">Notes Space</p>
            <h2 className="page-top-ui-title">Capture and refine ideas</h2>
            <p className="page-top-ui-meta">Searchable notes with optional AI guidance.</p>
          </div>
          <span className="page-top-ui-pill">
            {normalizedNotes.length} note{normalizedNotes.length === 1 ? '' : 's'}
          </span>
        </div>
      </section>

      {aiError && (
        <div className="bg-red-500/8 rounded-xl p-3 text-red-300 text-sm">
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
            <div className="border-t border-white/[0.04] px-4 sm:px-5 py-4">
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
              className="w-full bg-gray-900 border border-white/[0.06] rounded-lg pl-9 pr-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="page-group">
        <p className="page-group-kicker">Capture</p>
        <div className="app-surface-sheet capture-zone overflow-hidden">
          <button
            type="button"
            onClick={() => setAddOpen((prev) => !prev)}
            className="app-section-toggle w-full px-4 sm:px-5 py-3.5 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
                <Plus size={16} className="app-accent-text" />
              </span>
              <div>
                <p className="text-sm sm:text-base font-semibold text-white">Add Note</p>
                <p className="text-xs text-gray-500">Capture quickly, review without clutter.</p>
              </div>
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
               className={`border-t border-white/[0.04] px-4 sm:px-5 py-4 space-y-3 ${formShake ? 'form-shake' : ''}`}
             >
               <div className="input-shell">
                 <input
                   value={title}
                   onChange={(e) => setTitle(e.target.value)}
                   placeholder="Note title"
                   className="w-full bg-gray-800 border border-white/[0.06] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                 />
               </div>
               <div className="input-shell">
                 <textarea
                   value={body}
                   onChange={(e) => {
                     setBody(e.target.value)
                     autoResizeTextarea(e.currentTarget)
                   }}
                   ref={(el) => autoResizeTextarea(el)}
                   placeholder="Note description..."
                   rows={1}
                   className="w-full bg-gray-800 border border-white/[0.06] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-none overflow-hidden min-h-[6rem]"
                 />
               </div>
               <button
                 type="submit"
                 className="app-primary-btn text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors w-full sm:w-auto sm:ml-auto"
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
            {normalizedNotes.length === 0 && (
              <EmptyState
                icon={StickyNote}
                title="No notes yet"
                description="Capture a quick thought, reminder, or idea."
              />
            )}

            {normalizedNotes.length > 0 && filteredNotes.length === 0 && (
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
              const brainstormConversation = Array.isArray(noteMeta.brainstormConversation)
                ? noteMeta.brainstormConversation
                : []
              const brainstormDraft = String(noteMeta.brainstormSuggestedBody || '').trim()
              return (
                <SwipeToDelete key={note.id} onDelete={() => deleteNote(note.id)}>
                <div
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
                        <p className="text-sm font-semibold text-white truncate">
                          {note.title || 'Untitled'}
                        </p>
                        <p className={`text-sm text-gray-300 mt-1 ${isOpen ? 'line-clamp-none' : 'line-clamp-2'}`}>
                          {note.body || 'No description yet.'}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {relativeTime(note.date)}
                          {noteAiDate ? ` · AI ${relativeTime(noteAiDate)}` : ''}
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
                    <div className="border-t border-white/[0.04] px-4 py-3 space-y-3">
                      <div className="input-shell">
                        <input
                          value={note.title || ''}
                          onChange={(e) => updateNote(note.id, 'title', e.target.value)}
                          placeholder="Note title"
                          className="w-full bg-gray-900 border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                        />
                      </div>
                      <div className="input-shell">
                        <textarea
                          value={note.body || ''}
                          onChange={(e) => {
                            updateNote(note.id, 'body', e.target.value)
                            autoResizeTextarea(e.currentTarget)
                          }}
                          ref={(el) => autoResizeTextarea(el)}
                          rows={1}
                          className="w-full bg-gray-900 border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-none overflow-hidden min-h-[6rem]"
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

                      {noteAiLoadingId === note.id && (
                        <div className="ai-tip-glow bg-white/[0.02] rounded-xl pl-4 pr-3 py-3">
                          <SkeletonBlock lines={3} />
                        </div>
                      )}
                      {noteAiSuggestion && noteAiOpen && noteAiLoadingId !== note.id && (
                        <div className="ai-tip-glow ai-shimmer bg-white/[0.02] rounded-xl pl-4 pr-3 py-3">
                          <MarkdownContent content={noteAiSuggestion} />
                        </div>
                      )}

                      <div className="input-shell border border-white/[0.05] rounded-xl p-3 bg-gray-900/50">
                        <div className="section-header-inline mb-2">
                          <p className="section-header-title">AI Brainstorm</p>
                          <p className="section-header-meta">Refine this note together</p>
                        </div>
                        {brainstormConversation.length > 0 && (
                          <div className="space-y-2 mb-3 max-h-56 overflow-y-auto pr-1">
                            {brainstormConversation.map((msg, idx) => (
                              <div
                                key={`${note.id}-brainstorm-${idx}`}
                                className={`rounded-lg px-3 py-2 text-sm ${
                                  msg.role === 'assistant'
                                    ? 'bg-indigo-500/10 border border-indigo-400/20 text-gray-200'
                                    : 'bg-gray-800/70 border border-white/[0.06] text-gray-300'
                                }`}
                              >
                                {msg.role === 'assistant' ? (
                                  <MarkdownContent content={String(msg.content || '')} />
                                ) : (
                                  <p>{String(msg.content || '')}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <textarea
                          value={brainstormInputMap[note.id] || ''}
                          onChange={(e) => {
                            setBrainstormInputMap((prev) => ({ ...prev, [note.id]: e.target.value }))
                            autoResizeTextarea(e.currentTarget)
                          }}
                          ref={(el) => autoResizeTextarea(el)}
                          placeholder="Reply to brainstorm with your thoughts..."
                          rows={1}
                          className="w-full bg-gray-900 border border-white/[0.08] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-none overflow-hidden min-h-[4.5rem]"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleNoteBrainstorm(note)}
                            disabled={noteAiLoadingId !== null || !String(brainstormInputMap[note.id] || '').trim()}
                            className="app-primary-btn text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-60"
                          >
                            {noteAiLoadingId === note.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Sparkles size={12} />
                            )}
                            {noteAiLoadingId === note.id ? 'Thinking...' : 'Send to AI'}
                          </button>
                          <button
                            type="button"
                            onClick={() => applyBrainstormDraft(note.id)}
                            disabled={!brainstormDraft}
                            className="text-xs px-3 py-1.5 rounded-lg border border-indigo-500/30 text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-50"
                          >
                            Apply draft to note
                          </button>
                        </div>
                        {brainstormDraft && (
                          <p className="mt-2 text-xs text-gray-400">
                            Draft ready. Apply it when you like the latest version.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                </SwipeToDelete>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
