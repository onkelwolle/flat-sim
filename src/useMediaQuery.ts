import { useCallback, useSyncExternalStore } from 'react'

/** Whether a CSS media query matches, following it as it changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

/**
 * Whether any pointer is coarse (a touch screen, even beside a mouse), which
 * calls for finger-sized targets. The CSS sizes controls by the same query.
 */
export const useCoarsePointer = () => useMediaQuery('(any-pointer: coarse)')
