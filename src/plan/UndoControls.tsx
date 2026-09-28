import type { MouseEvent } from 'react'
import type { Size } from '../useViewportSize'
import { planStore, usePlanStore } from './planStore'

/**
 * Toolbar buttons that undo and redo edits to the project, each disabled
 * while there is nothing to take back or make again; the tooltip names the
 * step ("Undo move Sofa").
 */
export function UndoButtons({
  viewport,
  onMouseDown,
}: {
  viewport: Size
  onMouseDown: (e: MouseEvent) => void
}) {
  const nextUndo = usePlanStore((s) => s.nextUndo?.label)
  const nextRedo = usePlanStore((s) => s.nextRedo?.label)

  return (
    <>
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
    </>
  )
}
