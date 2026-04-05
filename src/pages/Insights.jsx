import { Trash2, Brain, ChevronDown, ChevronUp } from 'lucide-react'
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">AI Insights</h1>
        {insights.length > 0 && (
          <button
            onClick={clearAll}
            className="text-sm text-gray-500 hover:text-red-400 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {insights.length === 0 && (
        <EmptyState
          icon={Brain}
          title="No insights yet"
          description="Run AI analysis from Home to generate your first recommendation."
        />
      )}

      <div className="space-y-4">
        {insights.map((insight) => {
          const isOpen = Boolean(openMap[insight.id])
          const preview = buildInsightPreview(insight.content)
          return (
            <div
              key={insight.id}
              className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleOpen(insight.id)}
                className="w-full px-4 sm:px-5 py-3.5 flex items-start justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 app-accent-text">
                    <Brain size={18} />
                    <span className="text-sm text-gray-500">
                      {new Date(insight.date).toLocaleString()}
                    </span>
                  </div>
                  {!isOpen && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
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
                <div className="border-t border-gray-700/60 px-4 sm:px-5 py-4 space-y-3">
                  <MarkdownContent content={insight.content} />
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
  )
}
