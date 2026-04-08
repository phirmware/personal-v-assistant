const NOTIFIED_KEY = 'va-notified'
const SETTINGS_KEY = 'va-notifications'

export function getNotificationSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return { enabled: false, ...parsed }
  } catch {
    return { enabled: false }
  }
}

export function saveNotificationSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function isNotificationSupported() {
  return 'Notification' in window
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  return result
}

function getNotifiedSet() {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    const cleaned = {}
    for (const [key, ts] of Object.entries(parsed)) {
      if (ts > cutoff) cleaned[key] = ts
    }
    return cleaned
  } catch {
    return {}
  }
}

function markNotified(key) {
  const set = getNotifiedSet()
  set[key] = Date.now()
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(set))
}

function wasNotified(key) {
  const set = getNotifiedSet()
  return Boolean(set[key])
}

const REMINDER_OFFSETS = {
  'day_before': 24 * 60,
  'morning_of': null,
  '1h_before': 60,
  '30m_before': 30,
}

export const REMINDER_OPTIONS = [
  { value: 'none', label: 'No reminder' },
  { value: 'morning_of', label: 'Morning of (9 AM)' },
  { value: 'day_before', label: 'Day before' },
  { value: '1h_before', label: '1 hour before end of day' },
  { value: '30m_before', label: '30 min before end of day' },
]

export const INTERVAL_OPTIONS = [
  { value: 'none', label: 'No repeat nudge' },
  { value: '15m', label: 'Every 15 min', minutes: 15 },
  { value: '30m', label: 'Every 30 min', minutes: 30 },
  { value: '1h', label: 'Every hour', minutes: 60 },
  { value: '2h', label: 'Every 2 hours', minutes: 120 },
  { value: '4h', label: 'Every 4 hours', minutes: 240 },
]

const URGENCY_MESSAGES = {
  high: [
    'This needs your attention now.',
    'High priority — don\'t let this slip.',
    'Time to act on this.',
    'This won\'t wait — get it done.',
  ],
  medium: [
    'A gentle push to keep going.',
    'Stay on track with this one.',
    'Don\'t forget about this.',
    'Keep the momentum going.',
  ],
  low: [
    'Just a heads up.',
    'Whenever you get a chance.',
    'Still on your list.',
  ],
}

function getUrgencyMessage(priority) {
  const messages = URGENCY_MESSAGES[priority] || URGENCY_MESSAGES.medium
  return messages[Math.floor(Math.random() * messages.length)]
}

function shouldFireReminder(task) {
  if (!task || task.done) return false
  const reminder = task.reminder || 'none'
  if (reminder === 'none') return false

  const completeAt = task.completeAt || task.complete_at
  if (!completeAt) return false

  const now = new Date()
  const deadlineDate = new Date(`${completeAt}T23:59:00`)

  if (reminder === 'morning_of') {
    const morningTime = new Date(`${completeAt}T09:00:00`)
    const diffMin = (now - morningTime) / 60000
    return diffMin >= 0 && diffMin <= 60
  }

  if (reminder === 'day_before') {
    const dayBeforeDate = new Date(deadlineDate)
    dayBeforeDate.setDate(dayBeforeDate.getDate() - 1)
    dayBeforeDate.setHours(9, 0, 0, 0)
    const diffMin = (now - dayBeforeDate) / 60000
    return diffMin >= 0 && diffMin <= 60
  }

  const offsetMin = REMINDER_OFFSETS[reminder]
  if (!offsetMin) return false

  const fireTime = new Date(deadlineDate.getTime() - offsetMin * 60000)
  const diffMin = (now - fireTime) / 60000
  return diffMin >= 0 && diffMin <= 60
}

function showNativeNotification(title, body, tag, priority) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return

  const vibrationPattern = priority === 'high'
    ? [100, 50, 100, 50, 200]
    : priority === 'medium'
      ? [100, 50, 100]
      : [80]

  if (navigator.vibrate) navigator.vibrate(vibrationPattern)

  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: tag || title,
        renotify: true,
        vibrate: vibrationPattern,
        actions: [
          { action: 'done', title: 'Mark Done' },
          { action: 'snooze', title: 'Snooze 15m' },
        ],
      })
    }).catch(() => {
      new Notification(title, { body, tag: tag || title })
    })
  } else {
    new Notification(title, { body, tag: tag || title })
  }
}

/**
 * Checks all reminder types and returns an array of fired notifications
 * for the in-app banner system. Also fires native notifications.
 */
export function checkAllReminders(tasks) {
  const settings = getNotificationSettings()
  if (!settings.enabled) return []

  const fired = []
  const now = Date.now()
  const today = new Date().toISOString().split('T')[0]
  const notified = getNotifiedSet()

  for (const task of tasks) {
    if (task.done) continue

    // Deadline reminders
    if (shouldFireReminder(task)) {
      const notifKey = `${task.id}-${task.reminder}-${task.completeAt || task.complete_at}`
      if (!wasNotified(notifKey)) {
        const deadlineLabel = task.completeAt || task.complete_at
        const urgency = getUrgencyMessage(task.priority)
        const title = task.title
        const body = `Due ${deadlineLabel} · ${urgency}`
        showNativeNotification(`Reminder: ${title}`, body, notifKey, task.priority)
        markNotified(notifKey)
        fired.push({ type: 'reminder', task, title, body, priority: task.priority })
      }
    }

    // Interval reminders
    const interval = task.intervalReminder || 'none'
    if (interval !== 'none') {
      const opt = INTERVAL_OPTIONS.find((o) => o.value === interval)
      if (opt?.minutes) {
        const intervalKey = `interval-${task.id}`
        const lastFired = notified[intervalKey] || 0
        const elapsed = (now - lastFired) / 60000
        if (elapsed >= opt.minutes) {
          const urgency = getUrgencyMessage(task.priority)
          const title = task.title
          const body = `${opt.label} · ${urgency}`
          showNativeNotification(`Nudge: ${title}`, body, intervalKey, task.priority)
          markNotified(intervalKey)
          fired.push({ type: 'nudge', task, title, body, priority: task.priority })
        }
      }
    }

    // Overdue
    const completeAt = task.completeAt || task.complete_at
    if (completeAt && completeAt < today) {
      const notifKey = `overdue-${task.id}-${today}`
      if (!wasNotified(notifKey)) {
        const title = task.title
        const body = `Was due ${completeAt} — this needs attention.`
        showNativeNotification(`Overdue: ${title}`, body, notifKey, 'high')
        markNotified(notifKey)
        fired.push({ type: 'overdue', task, title, body, priority: 'high' })
      }
    }
  }

  return fired
}

// Legacy exports — now handled by checkAllReminders
export const checkTaskReminders = checkAllReminders
export const checkIntervalReminders = checkAllReminders
export const checkOverdueTasks = checkAllReminders
