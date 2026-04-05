import { useState, useEffect } from 'react'

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      if (!stored) return initialValue
      const parsed = JSON.parse(stored)
      // Merge defaults for objects so new keys are always present
      if (
        initialValue &&
        typeof initialValue === 'object' &&
        !Array.isArray(initialValue)
      ) {
        return { ...initialValue, ...parsed }
      }
      return parsed
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}
