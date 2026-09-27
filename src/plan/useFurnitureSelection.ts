import type { KonvaEventObject } from 'konva/lib/Node'
import { useEffect, useRef } from 'react'
import { distance } from './geometry'
import { planStore } from './planStore'
import { isControl } from './useViewNavigation'
import type { Point } from './zoomView'

// Screen pixels the pointer may travel for a press on the canvas to count as
// a click (which deselects) rather than a pan (which keeps the selection)
const CLICK_TOLERANCE = 4

type FurnitureSelectionHandlers = {
  onPointerDown: (e: KonvaEventObject<PointerEvent>) => void
  onPointerUp: (e: KonvaEventObject<PointerEvent>) => void
}

/**
 * Selection input for furniture: clicking empty canvas deselects, and Delete
 * (or Backspace) deletes the selected item unless the key is typed into a
 * control or a dialog is open. Items select themselves when pressed. Returns
 * handlers for the Stage.
 */
export function useFurnitureSelection(): FurnitureSelectionHandlers {
  // Screen position of a press on empty canvas
  const pressedAt = useRef<Point | null>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (isControl(e.target)) return
      if (document.querySelector('[aria-modal="true"]')) return
      const store = planStore.getState()
      if (!store.selectedId) return
      e.preventDefault()
      store.deleteSelectedFurniture()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const onPointerDown = (e: KonvaEventObject<PointerEvent>) => {
    const onEmptyCanvas = e.target === e.target.getStage()
    pressedAt.current =
      onEmptyCanvas && e.evt.button === 0
        ? { x: e.evt.clientX, y: e.evt.clientY }
        : null
  }

  const onPointerUp = (e: KonvaEventObject<PointerEvent>) => {
    const pressed = pressedAt.current
    pressedAt.current = null
    if (!pressed) return
    const moved = distance(pressed, { x: e.evt.clientX, y: e.evt.clientY })
    if (moved < CLICK_TOLERANCE) planStore.getState().clearSelection()
  }

  return { onPointerDown, onPointerUp }
}
