import { Trash2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import MarkdownContent from '../components/MarkdownContent'
import EmptyState from '../components/EmptyState'

function buildInsightPreview(content) {
  const raw = String(content || '')
  if (!raw.trim()) return ''

  const cleaned = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (cleaned.length <= 180) return cleaned
  return `${cleaned.slice(0, 179).trimEnd()}…`
}

export default function Insights({ insights, setInsights }) {
  const [openMap, setOpenMap] = useState({})

  function deleteInsight(id) {
    setInsights(insights.filter((i) => i.id !== id))
  }

  function clearAll() {
    setInsights([])
  }

  function toggleOpen(id) {
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="page-shell space-y-5 sm:space-y-6 stagger-reveal">
      <section className="page-top-ui">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="page-top-ui-kicker">Insights Feed</p>
            <h2 className="page-top-ui-title">AI recommendations timeline</h2>
            <p className="page-top-ui-meta">Review, revisit, and clean up old guidance.</p>
          </div>
          <span className="page-top-ui-pill">
            {insights.length} item{insights.length === 1 ? '' : 's'}
          </span>
        </div>
      </section>

      {insights.length > 0 && (
        <section className="page-group">
          <div className="section-header-inline">
            <p className="section-header-title">Actions</p>
            <p className="section-header-meta">Timeline controls</p>
          </div>
          <div className="app-strip-cell flex justify-end px-3 py-2.5">
            <button
              onClick={clearAll}
              className="text-sm text-gray-500 hover:text-red-400 transition-colors"
            >
              Clear All
            </button>
          </div>
        </section>
      )}

      {insights.length === 0 && (
        <EmptyState
          icon={Sparkles}
          title="No insights yet"
          description="Run AI analysis from Home to generate your first recommendation."
        />
      )}

      <section className="page-group">
        <div className="section-header-inline">
          <p className="section-header-title">Timeline</p>
          <p className="section-header-meta">
            {insights.length > 0 && <span className="count-badge count-badge-accent">{insights.length}</span>}
          </p>
        </div>
        <div className="page-group-shell">
          <div className="app-surface-list">
            {insights.map((insight, idx) => {
              const isOpen = Boolean(openMap[insight.id])
              const preview = buildInsightPreview(insight.content)
              return (
                <div
                  key={insight.id}
                  className="app-surface-row timeline-item overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleOpen(insight.id)}
                    className="app-section-toggle w-full px-4 sm:px-5 py-3.5 flex items-start justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="app-accent-text" />
                        <span className="text-xs font-medium text-gray-400">
                          {new Date(insight.date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {idx === 0 && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/12 text-emerald-400">Latest</span>
                        )}
                      </div>
                      {!isOpen && (
                        <p className="text-sm text-gray-500 mt-1.5 line-clamp-2">
                          {preview || 'Tap to view insight'}
                        </p>
                      )}
                    </div>
                    {isOpen ? (
                      <ChevronUp size={16} className="text-gray-500 shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-500 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="border-t border-white/[0.04] px-4 sm:px-5 py-4 space-y-3">
                      <div className="ai-shimmer">
                        <MarkdownContent content={insight.content} />
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => deleteInsight(insight.id)}
                          className="text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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
