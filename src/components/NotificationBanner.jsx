import { useEffect, useState, useCallback } from 'react'
import { Bell, Check, Clock, AlertTriangle, X } from 'lucide-react'

const TYPE_CONFIG = {
  reminder: {
    icon: Bell,
    label: 'Reminder',
    accent: 'indigo',
  },
  nudge: {
    icon: Clock,
    label: 'Nudge',
    accent: 'cyan',
  },
  overdue: {
    icon: AlertTriangle,
    label: 'Overdue',
    accent: 'red',
  },
}

const PRIORITY_GLOW = {
  high: 'notif-glow-high',
  medium: 'notif-glow-medium',
  low: 'notif-glow-low',
}

function NotificationCard({ notification, onDismiss, onMarkDone, onSnooze }) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))
    })
  }, [])

  function handleExit(callback) {
    setExiting(true)
    setTimeout(() => callback?.(), 300)
  }

  const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.reminder
  const Icon = config.icon
  const glowClass = PRIORITY_GLOW[notification.priority] || PRIORITY_GLOW.medium
  const isHigh = notification.priority === 'high'
  const isOverdue = notification.type === 'overdue'

  return (
    <div
      className={`notif-banner ${glowClass} ${visible && !exiting ? 'notif-banner-visible' : ''} ${exiting ? 'notif-banner-exit' : ''} ${isHigh || isOverdue ? 'notif-banner-urgent' : ''}`}
    >
      <div className="notif-banner-inner">
        <div className="flex items-start gap-3">
          <div className={`notif-icon-ring notif-icon-${config.accent}`}>
            <Icon size={18} strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`notif-type-badge notif-badge-${config.accent}`}>
                {config.label}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                notification.priority === 'high' ? 'text-red-400' :
                notification.priority === 'medium' ? 'text-yellow-400' : 'text-gray-500'
              }`}>
                {notification.priority}
              </span>
            </div>
            <p className="text-[15px] font-semibold text-white leading-snug">
              {notification.title}
            </p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              {notification.body}
            </p>
          </div>
          <button
            onClick={() => handleExit(onDismiss)}
            className="text-gray-600 hover:text-gray-300 transition-colors p-1 -mt-0.5 -mr-0.5 shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => handleExit(onMarkDone)}
            className="notif-action-btn notif-action-done"
          >
            <Check size={13} strokeWidth={2.5} />
            Mark Done
          </button>
          <button
            onClick={() => handleExit(onSnooze)}
            className="notif-action-btn notif-action-snooze"
          >
            <Clock size={13} />
            Snooze 15m
          </button>
        </div>
      </div>
      {(isHigh || isOverdue) && <div className="notif-urgency-pulse" />}
    </div>
  )
}

export default function NotificationBanner({ notifications, onDismiss, onMarkDone, onSnooze }) {
  const [dismissedIds, setDismissedIds] = useState(new Set())

  const queue = notifications.filter(
    (n) => !dismissedIds.has(n.task.id + '-' + n.type)
  )

  const dismiss = useCallback((notification) => {
    setDismissedIds((prev) => new Set([...prev, notification.task.id + '-' + notification.type]))
    onDismiss?.(notification)
  }, [onDismiss])

  const markDone = useCallback((notification) => {
    setDismissedIds((prev) => new Set([...prev, notification.task.id + '-' + notification.type]))
    onMarkDone?.(notification)
  }, [onMarkDone])

  const snooze = useCallback((notification) => {
    setDismissedIds((prev) => new Set([...prev, notification.task.id + '-' + notification.type]))
    onSnooze?.(notification)
  }, [onSnooze])

  // Auto-dismiss after timeout (longer for high priority)
  useEffect(() => {
    if (queue.length === 0) return
    const timers = queue.map((n) => {
      const delay = n.priority === 'high' || n.type === 'overdue' ? 30000 : 15000
      return setTimeout(() => dismiss(n), delay)
    })
    return () => timers.forEach(clearTimeout)
  }, [queue, dismiss])

  if (queue.length === 0) return null

  return (
    <div className="fixed top-0 inset-x-0 z-[60] flex flex-col items-center gap-2 px-3 pointer-events-none"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 5.5rem)' }}
    >
      {queue.map((notification, i) => (
        <NotificationCard
          key={`${notification.task.id}-${notification.type}-${i}`}
          notification={notification}
          onDismiss={() => dismiss(notification)}
          onMarkDone={() => markDone(notification)}
          onSnooze={() => snooze(notification)}
        />
      ))}
    </div>
  )
}
