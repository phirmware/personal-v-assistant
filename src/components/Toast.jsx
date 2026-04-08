import { useEffect, useState } from 'react'
import { X, Undo2 } from 'lucide-react'

export default function ToastContainer({ toasts, dismiss }) {
  return (
    <div className="fixed bottom-20 lg:bottom-6 inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />
      ))}
    </div>
  )
}

function ToastItem({ toast, dismiss }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function handleUndo() {
    if (toast.onUndo) toast.onUndo()
    dismiss(toast.id)
  }

  return (
    <div
      className={`pointer-events-auto toast-enter flex items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-lg max-w-sm w-full transition-all duration-200 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      } ${
        toast.type === 'danger'
          ? 'bg-red-950/90 text-red-200 border border-red-500/20'
          : toast.type === 'success'
            ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-500/20'
            : 'bg-gray-900/95 text-gray-200 border border-white/[0.06]'
      }`}
      style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
    >
      <span className="flex-1 min-w-0">{toast.message}</span>
      {toast.onUndo && (
        <button
          onClick={handleUndo}
          className="text-xs font-semibold px-2 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] transition-colors flex items-center gap-1 shrink-0"
        >
          <Undo2 size={12} />
          Undo
        </button>
      )}
      <button
        onClick={() => dismiss(toast.id)}
        className="text-gray-500 hover:text-gray-300 transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}
