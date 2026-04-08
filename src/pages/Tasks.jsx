import { useEffect, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus,
  Trash2,
  Star,
  StarOff,
  Check,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from 'lucide-react'
import { runTaskSuggestion } from '../ai'
import MarkdownContent from '../components/MarkdownContent'
import EmptyState from '../components/EmptyState'

const PRIORITY_COLORS = {
  high: 'text-red-400',
  medium: 'text-yellow-400',
  low: 'text-gray-400',
}

function SortableTaskRow({
  task,
  isOpen,
  isDropTarget,
  onToggleDone,
  onToggleOpen,
  onTogglePin,
  onDelete,
  onTaskAI,
  aiLoadingId,
  updateTask,
  autoResizeTextarea,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(task.id),
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`app-surface-row overflow-hidden group priority-edge ${task.done ? 'opacity-50' : ''} ${
        isDropTarget ? 'ring-1 ring-blue-500/70' : ''
      } ${isDragging ? 'ring-1 ring-blue-400/70' : ''}`}
      style={{'--priority-color': task.done ? 'transparent' : task.priority === 'high' ? '#f87171' : task.priority === 'medium' ? '#facc15' : '#6b7280'}}
    >
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onToggleDone}
            className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
              task.done
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-white/[0.05] text-transparent hover:bg-white/[0.1]'
            }`}
            title={task.done ? 'Mark as active' : 'Mark as completed'}
            aria-label={task.done ? 'Mark as active' : 'Mark as completed'}
          >
            <Check size={14} />
          </button>

          <button
            type="button"
            onClick={onToggleOpen}
            className="flex-1 min-w-0 text-left"
            title={isOpen ? 'Collapse task' : 'Expand task'}
          >
            <p
              className={`min-w-0 break-words text-sm sm:text-[15px] ${
                task.done ? 'line-through text-gray-500' : 'text-white'
              }`}
            >
              {task.title}
            </p>
            <div className="mt-1.5 flex items-center gap-2 text-[11px]">
              <span
                className={`uppercase font-semibold tracking-wide ${PRIORITY_COLORS[task.priority]}`}
              >
                {task.priority}
              </span>
              {task.pinned && (
                <span className="px-1.5 py-0.5 rounded-md text-amber-300 bg-amber-500/12">
                  pinned
                </span>
              )}
            </div>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none rounded-md p-1"
              title="Drag to reorder"
              aria-label="Drag to reorder"
            >
              <GripVertical size={16} />
            </button>
            <button
              type="button"
              onClick={onTogglePin}
              className="text-gray-500 hover:text-yellow-400 transition-colors rounded-md p-1"
              title={task.pinned ? 'Unpin from focus' : 'Pin to focus'}
            >
              {task.pinned ? <Star size={15} fill="currentColor" /> : <StarOff size={15} />}
            </button>
            <button
              type="button"
              onClick={onToggleOpen}
              className="text-gray-500 app-accent-hover-text transition-colors rounded-md p-1"
              title={isOpen ? 'Collapse task' : 'Expand task'}
            >
              {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-white/[0.04] px-4 py-3 space-y-2">
          <div className="input-shell">
            <textarea
              value={task.details || ''}
              onChange={(e) => {
                updateTask(task.id, 'details', e.target.value)
                autoResizeTextarea(e.currentTarget)
              }}
              ref={(el) => autoResizeTextarea(el)}
              placeholder="Add task details..."
              rows={1}
              className="w-full bg-gray-900 border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-none overflow-hidden min-h-[5rem]"
            />
          </div>
          <div className="input-shell">
            <div className="section-header-inline mb-2">
              <p className="section-header-title">Updates</p>
              <p className="section-header-meta">What changed since last step</p>
            </div>
            <textarea
              value={task.updates || ''}
              onChange={(e) => {
                updateTask(task.id, 'updates', e.target.value)
                autoResizeTextarea(e.currentTarget)
              }}
              ref={(el) => autoResizeTextarea(el)}
              placeholder="Progress update (e.g. called instructor, finished module, blocked by schedule)"
              rows={1}
              className="w-full bg-gray-900 border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-none overflow-hidden min-h-[4.25rem]"
            />
          </div>
          <div className="flex justify-between items-center gap-2">
            <button
              onClick={onTaskAI}
              disabled={aiLoadingId !== null}
              className="app-primary-btn text-xs text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              {aiLoadingId === task.id ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              {aiLoadingId === task.id ? 'Thinking...' : 'AI Suggest'}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-xs px-2.5 py-1.5 rounded-lg text-red-400/70 hover:text-red-300 hover:bg-red-500/8 transition-colors"
            >
              <span className="inline-flex items-center gap-1">
                <Trash2 size={12} />
                Delete
              </span>
            </button>
          </div>
          {task.aiSuggestion && (
            <div className="ai-tip-glow ai-shimmer bg-white/[0.02] rounded-xl pl-4 pr-3 py-3">
              <MarkdownContent content={task.aiSuggestion} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Tasks({ tasks, setTasks }) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [details, setDetails] = useState('')
  const [openMap, setOpenMap] = useState({})
  const [addOpen, setAddOpen] = useState(false)
  const [aiLoadingId, setAiLoadingId] = useState(null)
  const [aiError, setAiError] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } })
  )

  useEffect(() => {
    setTasks((prevTasks) => {
      let nextOrder = maxSortOrder(prevTasks) + 1
      let changed = false
      const withOrder = prevTasks.map((task) => {
        if (Number.isFinite(task?.sortOrder)) return task
        changed = true
        const nextTask = { ...task, sortOrder: nextOrder }
        nextOrder += 1
        return nextTask
      })
      if (!changed) return prevTasks
      return withOrder
    })
  }, [setTasks])

  function autoResizeTextarea(el) {
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }

  function sortTasksList(list) {
    const fallbackIndex = new Map(list.map((task, index) => [String(task.id), index]))
    const priorityRank = { high: 3, medium: 2, low: 1 }
    return [...list].sort((a, b) => {
      if (Boolean(a.done) !== Boolean(b.done)) return Number(a.done) - Number(b.done)
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return Number(b.pinned) - Number(a.pinned)
      const aOrder = Number.isFinite(a?.sortOrder)
        ? a.sortOrder
        : fallbackIndex.get(String(a.id)) ?? 0
      const bOrder = Number.isFinite(b?.sortOrder)
        ? b.sortOrder
        : fallbackIndex.get(String(b.id)) ?? 0
      if (aOrder !== bOrder) return aOrder - bOrder
      return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0)
    })
  }

  function maxSortOrder(list) {
    return list.reduce(
      (max, task) => (Number.isFinite(task?.sortOrder) ? Math.max(max, task.sortOrder) : max),
      -1
    )
  }

  function addTask(e) {
    e.preventDefault()
    if (!title.trim()) return
    setTasks((prevTasks) => [
      ...prevTasks,
      {
        id: Date.now(),
        title: title.trim(),
        priority,
        details: details.trim(),
        updates: '',
        done: false,
        pinned: false,
        aiSuggestion: '',
        sortOrder: maxSortOrder(prevTasks) + 1,
      },
    ])
    setTitle('')
    setDetails('')
  }

  function toggleDone(id) {
    setTasks((prevTasks) => {
      const nextOrder = maxSortOrder(prevTasks) + 1
      return prevTasks.map((task) =>
        task.id === id
          ? { ...task, done: !task.done, sortOrder: nextOrder }
          : task
      )
    })
  }

  function togglePin(id) {
    setTasks((prevTasks) => prevTasks.map((task) => (task.id === id ? { ...task, pinned: !task.pinned } : task)))
  }

  function deleteTask(id) {
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id))
  }

  function updateTask(id, field, value) {
    setTasks((prevTasks) => prevTasks.map((task) => (task.id === id ? { ...task, [field]: value } : task)))
  }

  function toggleOpen(id) {
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function reorderTasks(sourceId, targetId) {
    if (sourceId === null || targetId === null || String(sourceId) === String(targetId)) return
    setTasks((prevTasks) => {
      const current = sortTasksList(prevTasks)
      const fromIndex = current.findIndex((task) => String(task.id) === String(sourceId))
      const toIndex = current.findIndex((task) => String(task.id) === String(targetId))
      if (fromIndex < 0 || toIndex < 0) return prevTasks

      const sourceTask = current[fromIndex]
      const targetTask = current[toIndex]
      if (Boolean(sourceTask.done) !== Boolean(targetTask.done)) return prevTasks
      if (Boolean(sourceTask.pinned) !== Boolean(targetTask.pinned)) return prevTasks

      const moved = arrayMove(current, fromIndex, toIndex)

      const sortOrderById = new Map()
      let activeIndex = 0
      let doneIndex = 0
      for (const task of moved) {
        if (task.done) {
          sortOrderById.set(String(task.id), doneIndex)
          doneIndex += 1
        } else {
          sortOrderById.set(String(task.id), activeIndex)
          activeIndex += 1
        }
      }

      return prevTasks.map((task) => ({
        ...task,
        sortOrder: sortOrderById.get(String(task.id)),
      }))
    })
  }

  function handleDragStart(event) {
    setDraggingId(String(event.active.id))
  }

  function handleDragOver(event) {
    setDragOverId(event.over?.id ? String(event.over.id) : null)
  }

  function handleDrop(event) {
    const sourceId = event.active?.id ? String(event.active.id) : null
    const targetId = event.over?.id ? String(event.over.id) : null
    reorderTasks(sourceId, targetId)
    setDragOverId(null)
    setDraggingId(null)
  }

  function handleDragEnd() {
    setDragOverId(null)
    setDraggingId(null)
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
          updates: task.updates || '',
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

  const sorted = sortTasksList(tasks)

  return (
    <div className="page-shell space-y-5 sm:space-y-6 stagger-reveal">
      <section className="page-top-ui">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="page-top-ui-kicker">Task Flow</p>
            <h2 className="page-top-ui-title">Execution board</h2>
            <p className="page-top-ui-meta">Capture, prioritize, and keep momentum.</p>
          </div>
          <span className="page-top-ui-pill">
            {sorted.length} task{sorted.length === 1 ? '' : 's'}
          </span>
        </div>
      </section>

      <section className="page-group">
        <p className="page-group-kicker">Create</p>
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
                <p className="text-sm sm:text-base font-semibold text-white">Add Task</p>
                <p className="text-xs text-gray-500">Keep collapsed while focusing on active work.</p>
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
              onSubmit={addTask}
              className="border-t border-white/[0.04] p-4 space-y-3"
            >
              <div className="input-shell flex flex-col sm:flex-row gap-3">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Add a task..."
                  className="flex-1 bg-gray-900 border border-white/[0.06] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="bg-gray-900 border border-white/[0.06] rounded-lg px-3 py-2.5 text-gray-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="input-shell">
                <textarea
                  value={details}
                  onChange={(e) => {
                    setDetails(e.target.value)
                    autoResizeTextarea(e.currentTarget)
                  }}
                  ref={(el) => autoResizeTextarea(el)}
                  placeholder="Task details, context, blockers, or plan..."
                  rows={1}
                  className="w-full bg-gray-900 border border-white/[0.06] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-none overflow-hidden min-h-[5rem]"
                />
              </div>
              <button
                type="submit"
                className="app-primary-btn text-white px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus size={18} /> Add Task
              </button>
            </form>
          )}
        </div>
      </section>

      {aiError && (
        <div className="bg-red-500/8 rounded-xl p-3 text-red-300 text-sm">
          {aiError}
        </div>
      )}

      <section className="page-group">
        <div className="section-header-inline">
          <p className="section-header-title">Queue</p>
          <p className="section-header-meta">Drag to reorder. Completed tasks sink to the bottom.</p>
        </div>
        <div className="page-group-shell">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDrop}
            onDragCancel={handleDragEnd}
          >
            <SortableContext
              items={sorted.map((task) => String(task.id))}
              strategy={verticalListSortingStrategy}
            >
              <div className="app-surface-list">
            {sorted.length === 0 && (
              <EmptyState
                icon={Plus}
                title="No tasks yet"
                description="Add your first task to start building momentum."
              />
            )}
            {sorted.map((task) => (
              <SortableTaskRow
                key={task.id}
                task={task}
                isOpen={Boolean(openMap[task.id])}
                isDropTarget={
                  dragOverId !== null &&
                  String(dragOverId) === String(task.id) &&
                  String(draggingId) !== String(task.id)
                }
                onToggleDone={() => toggleDone(task.id)}
                onToggleOpen={() => toggleOpen(task.id)}
                onTogglePin={() => togglePin(task.id)}
                onDelete={() => deleteTask(task.id)}
                onTaskAI={() => handleTaskAI(task)}
                aiLoadingId={aiLoadingId}
                updateTask={updateTask}
                autoResizeTextarea={autoResizeTextarea}
              />
            ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </section>
    </div>
  )
}
