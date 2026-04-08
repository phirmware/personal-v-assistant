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
    // Clean entries older than 24 hours
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
  'morning_of': null, // fires at 9am on the day
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
    // Fire if we're within 0-60 min window after 9am on the day
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

function showNotification(title, body) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return

  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: title,
        renotify: false,
      })
    }).catch(() => {
      new Notification(title, { body })
    })
  } else {
    new Notification(title, { body })
  }
}

export function checkTaskReminders(tasks) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return

  const settings = getNotificationSettings()
  if (!settings.enabled) return

  for (const task of tasks) {
    if (!shouldFireReminder(task)) continue
    const notifKey = `${task.id}-${task.reminder}-${task.completeAt || task.complete_at}`
    if (wasNotified(notifKey)) continue

    const deadlineLabel = task.completeAt || task.complete_at
    showNotification(
      `Task Reminder: ${task.title}`,
      `Due ${deadlineLabel} · ${task.priority} priority`
    )
    markNotified(notifKey)
  }
}

export function checkIntervalReminders(tasks) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return

  const settings = getNotificationSettings()
  if (!settings.enabled) return

  const now = Date.now()
  const notified = getNotifiedSet()

  for (const task of tasks) {
    if (task.done) continue
    const interval = task.intervalReminder || 'none'
    if (interval === 'none') continue

    const opt = INTERVAL_OPTIONS.find((o) => o.value === interval)
    if (!opt || !opt.minutes) continue

    const intervalKey = `interval-${task.id}`
    const lastFired = notified[intervalKey] || 0
    const elapsed = (now - lastFired) / 60000

    if (elapsed < opt.minutes) continue

    showNotification(
      `Nudge: ${task.title}`,
      `${opt.label} reminder · ${task.priority} priority`
    )
    markNotified(intervalKey)
  }
}

export function checkOverdueTasks(tasks) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return

  const settings = getNotificationSettings()
  if (!settings.enabled) return

  const today = new Date().toISOString().split('T')[0]

  for (const task of tasks) {
    if (task.done) continue
    const completeAt = task.completeAt || task.complete_at
    if (!completeAt || completeAt >= today) continue

    const notifKey = `overdue-${task.id}-${today}`
    if (wasNotified(notifKey)) continue

    showNotification(
      `Overdue: ${task.title}`,
      `Was due ${completeAt} · ${task.priority} priority`
    )
    markNotified(notifKey)
  }
}
