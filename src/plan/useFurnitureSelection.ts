import type { KonvaEventObject } from 'konva/lib/Node'
import { useEffect, useRef } from 'react'
import { isDialogOpen } from '../dialogs'
import { distance, type NudgeDirection } from './geometry'
import { planStore } from './planStore'
import { isControl } from './useViewNavigation'
import type { Point } from './zoomView'

// Screen pixels the pointer may travel for a press on the canvas to count as
// a click (which deselects) rather than a pan (which keeps the selection)
const CLICK_TOLERANCE = 4

// Real distance an arrow key nudges the selected item; Shift for the larger
const NUDGE_CM = 1
const LARGE_NUDGE_CM = 10

const NUDGE_KEYS: Partial<Record<string, NudgeDirection>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

type FurnitureSelectionHandlers = {
  onPointerDown: (e: KonvaEventObject<PointerEvent>) => void
  onPointerUp: (e: KonvaEventObject<PointerEvent>) => void
}

/**
 * Selection input for furniture: clicking empty canvas or pressing Esc
 * deselects, arrow keys nudge the selected item (1 cm, or 10 cm with Shift),
 * and Delete (or Backspace) deletes the selected item; keys typed into a
 * control or pressed while a dialog is open are left alone. Items select themselves when pressed. Returns
 * handlers for the Stage.
 */
export function useFurnitureSelection(): FurnitureSelectionHandlers {
  // Screen position of a press on empty canvas
  const pressedAt = useRef<Point | null>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const deselecting = e.key === 'Escape'
      const deleting = e.key === 'Delete' || e.key === 'Backspace'
      const direction = NUDGE_KEYS[e.key]
      if (!deselecting && !deleting && !direction) return
      if (isControl(e.target)) return
      if (isDialogOpen()) return
      const store = planStore.getState()
      if (!store.selectedId) return
      e.preventDefault() // no scrolling or going back
      if (deselecting) store.clearSelection()
      else if (direction)
        store.nudgeSelectedFurniture(
          direction,
          e.shiftKey ? LARGE_NUDGE_CM : NUDGE_CM,
        )
      else store.deleteSelectedFurniture()
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
