import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

const THRESHOLD = 80
const MAX_SWIPE = 120

export default function SwipeToDelete({ onDelete, children, className = '' }) {
  const [offsetX, setOffsetX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const gestureRef = useRef({ startX: 0, startY: 0, locked: false, direction: null })

  function onTouchStart(e) {
    const touch = e.touches?.[0]
    if (!touch) return
    gestureRef.current = { startX: touch.clientX, startY: touch.clientY, locked: false, direction: null }
    setSwiping(true)
  }

  function onTouchMove(e) {
    if (!swiping) return
    const touch = e.touches?.[0]
    if (!touch) return

    const deltaX = touch.clientX - gestureRef.current.startX
    const deltaY = touch.clientY - gestureRef.current.startY

    if (!gestureRef.current.direction) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        gestureRef.current.direction = Math.abs(deltaX) > Math.abs(deltaY) ? 'h' : 'v'
      }
      return
    }

    if (gestureRef.current.direction === 'v') {
      setSwiping(false)
      setOffsetX(0)
      return
    }

    gestureRef.current.locked = true
    const clamped = Math.max(-MAX_SWIPE, Math.min(0, deltaX * 0.7))
    setOffsetX(clamped)
  }

  function onTouchEnd() {
    setSwiping(false)
    if (Math.abs(offsetX) >= THRESHOLD) {
      setOffsetX(-MAX_SWIPE)
      onDelete()
    } else {
      setOffsetX(0)
    }
    gestureRef.current = { startX: 0, startY: 0, locked: false, direction: null }
  }

  const deleteReady = Math.abs(offsetX) >= THRESHOLD

  return (
    <div className={`swipe-delete-wrapper relative overflow-hidden ${className}`}>
      <div
        className={`absolute inset-y-0 right-0 flex items-center justify-end pr-4 transition-colors ${
          deleteReady ? 'bg-red-500/20' : 'bg-red-500/8'
        }`}
        style={{ width: MAX_SWIPE }}
      >
        <Trash2 size={18} className={`transition-transform ${deleteReady ? 'text-red-300 scale-110' : 'text-red-400/60'}`} />
      </div>
      <div
        className="relative z-[1] bg-[#050608]"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: swiping ? 'none' : 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}
