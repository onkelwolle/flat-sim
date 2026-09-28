import type { MouseEvent } from 'react'
import type { Size } from '../useViewportSize'
import { planStore, usePlanStore } from './planStore'

/**
 * Toolbar button that undoes the last edit to the project, disabled while
 * there is nothing to take back; the tooltip names the step ("Undo move Sofa").
 */
export function UndoButton({
  viewport,
  onMouseDown,
}: {
  viewport: Size
  onMouseDown: (e: MouseEvent) => void
}) {
  const nextUndo = usePlanStore((s) => s.nextUndo?.label)

  return (
    <button
      type="button"
      className="button"
      disabled={!nextUndo}
      title={nextUndo && `Undo ${nextUndo}`}
      onMouseDown={onMouseDown}
      onClick={() => planStore.getState().undo(viewport)}
    >
      Undo
    </button>
  )
}

/**
 * Toolbar button that makes an undone edit again, disabled while there is
 * none; the tooltip names the step ("Redo move Sofa").
 */
export function RedoButton({
  viewport,
  onMouseDown,
}: {
  viewport: Size
  onMouseDown: (e: MouseEvent) => void
}) {
  const nextRedo = usePlanStore((s) => s.nextRedo?.label)

  return (
    <button
      type="button"
      className="button"
      disabled={!nextRedo}
      title={nextRedo && `Redo ${nextRedo}`}
      onMouseDown={onMouseDown}
      onClick={() => planStore.getState().redo(viewport)}
    >
      Redo
    </button>
  )
}
