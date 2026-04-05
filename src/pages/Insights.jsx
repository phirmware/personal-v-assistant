import { Trash2, Brain } from 'lucide-react'
import MarkdownContent from '../components/MarkdownContent'
import EmptyState from '../components/EmptyState'

export default function Insights({ insights, setInsights }) {
  function deleteInsight(id) {
    setInsights(insights.filter((i) => i.id !== id))
  }

  function clearAll() {
    setInsights([])
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
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5 group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 app-accent-text">
                <Brain size={18} />
                <span className="text-sm text-gray-500">
                  {new Date(insight.date).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => deleteInsight(insight.id)}
                className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <MarkdownContent content={insight.content} />
          </div>
        ))}
      </div>
    </div>
  )
}
