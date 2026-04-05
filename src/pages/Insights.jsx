import { Trash2, Brain } from 'lucide-react'
import MarkdownContent from '../components/MarkdownContent'

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
        <h1 className="text-2xl font-bold text-white">AI Insights</h1>
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
        <p className="text-gray-500 text-center py-12">
          No insights yet. Run an AI analysis from the Command Center.
        </p>
      )}

      <div className="space-y-4">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5 group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 text-blue-400">
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
