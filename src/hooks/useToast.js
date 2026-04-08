import { useEffect, useState, useCallback, useRef } from 'react'

let toastId = 0
let globalShowToast = null

export function showToast(message, options = {}) {
  if (globalShowToast) globalShowToast(message, options)
}

export function useToast() {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  const show = useCallback((message, options = {}) => {
    const id = ++toastId
    const duration = options.duration || 4000
    setToasts((prev) => [...prev, { id, message, ...options }])
    timersRef.current[id] = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      delete timersRef.current[id]
    }, duration)
    return id
  }, [])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id])
      delete timersRef.current[id]
    }
  }, [])

  useEffect(() => {
    globalShowToast = show
    return () => { globalShowToast = null }
  }, [show])

  return { toasts, show, dismiss }
}
