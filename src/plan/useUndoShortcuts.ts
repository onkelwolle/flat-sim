import Konva from 'konva'
import { useEffect, useRef } from 'react'
import { isDialogOpen } from '../dialogs'
import type { Size } from '../useViewportSize'
import { planStore } from './planStore'
import { isControl } from './useViewNavigation'

/**
 * Keyboard shortcuts for undo (Ctrl+Z, or Cmd+Z on macOS) and redo
 * (Ctrl+Shift+Z / Cmd+Shift+Z, or Ctrl+Y). They leave a control's own undo
 * alone, and do nothing while a dialog is open or an item is being dragged
 * or turned.
 */
export function useUndoShortcuts(viewport: Size) {
  const currentViewport = useRef(viewport)
  useEffect(() => {
    currentViewport.current = viewport
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const key = e.key.toLowerCase()
      const undoing = key === 'z' && !e.shiftKey
      const redoing =
        (key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey)
      if (!undoing && !redoing) return
      if (isControl(e.target)) return
      if (isDialogOpen()) return
      e.preventDefault()
      // A gesture records its step when it ends
      if (Konva.isDragging() || Konva.isTransforming()) return
      const store = planStore.getState()
      if (undoing) store.undo(currentViewport.current)
      else store.redo(currentViewport.current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
