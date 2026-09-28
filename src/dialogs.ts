import { useLayoutEffect, useRef } from 'react'
import { createStore } from 'zustand/vanilla'

/** How many modal dialogs are open right now. */
const dialogStore = createStore<{ open: number }>()(() => ({ open: 0 }))

/**
 * Whether a modal dialog is open. While one is, keys belong to it: keyboard
 * shortcuts check this and leave the tools, the selection and the view alone.
 */
export const isDialogOpen = () => dialogStore.getState().open > 0

/**
 * Mark a dialog as open until the returned function is called; closing more
 * than once counts once.
 */
export function openDialog(): () => void {
  let closed = false
  dialogStore.setState((s) => ({ open: s.open + 1 }))
  return () => {
    if (closed) return
    closed = true
    dialogStore.setState((s) => ({ open: s.open - 1 }))
  }
}

/**
 * For a modal dialog component: marks a dialog open while it is mounted, and
 * Esc cancels it without reaching any other keyboard shortcut.
 */
export function useModalDialog(onCancel: () => void) {
  const cancel = useRef(onCancel)
  useLayoutEffect(() => {
    cancel.current = onCancel
  })

  // Layout effects, so no key press slips in between showing the dialog and
  // marking it open
  useLayoutEffect(() => {
    const close = openDialog()
    // Capturing on the window runs before, and stops, every other key handler
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      cancel.current()
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
      close()
    }
  }, [])
}
