import { useRef, useState, type MouseEvent } from 'react'
import type { Size } from '../useViewportSize'
import { CalibrateButton, CalibrationStatus } from './CalibrationControls'
import { ConfirmDialog } from './ConfirmDialog'
import {
  AddFurnitureButton,
  DeleteFurnitureButton,
  FurniturePanel,
  FurnitureStatus,
} from './FurnitureControls'
import { MeasureButton, MeasuringTapeStatus } from './MeasuringTapeControls'
import { loadPlanFile, PLAN_FILE_TYPES } from './loadPlanFile'
import { planStore, usePlanStore } from './planStore'
import { useFileDrop } from './useFileDrop'

// A clicked button keeps focus, so the space bar would press it again instead
// of panning; keyboard users still focus buttons with Tab
const keepFocusOffToolbar = (e: MouseEvent) => e.preventDefault()

/**
 * HTML overlay for opening a plan (file picker, drop target, replace prompt),
 * fitting it to the screen, calibrating its scale, measuring it, adding or
 * deleting furniture and starting a new project.
 */
export function PlanControls({
  viewport,
  onNewProject,
}: {
  viewport: Size
  /** Drop the plan and everything on it, once the user has confirmed. */
  onNewProject: () => void
}) {
  const hasPlan = usePlanStore((s) => s.plan !== null)
  const pendingPlan = usePlanStore((s) => s.pendingPlan)
  const measuring = usePlanStore((s) => s.tape !== null)
  const selected = usePlanStore((s) => s.selectedId !== null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingNew, setConfirmingNew] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Decoding is async; only the most recently chosen file may win
  const latestLoad = useRef(0)

  const openFile = async (file: File) => {
    const load = ++latestLoad.current
    setError(null)
    try {
      const plan = await loadPlanFile(file)
      if (load !== latestLoad.current) return plan.image.close()
      planStore.getState().offerPlan(plan, viewport)
    } catch (e) {
      if (load !== latestLoad.current) return
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // No new plans while a prompt is open
  const dragging = useFileDrop(openFile, !pendingPlan && !confirmingNew)

  return (
    <>
      <div className="toolbar">
        <button
          type="button"
          className="button"
          onMouseDown={keepFocusOffToolbar}
          onClick={() => inputRef.current?.click()}
        >
          Open plan…
        </button>
        {hasPlan && (
          <button
            type="button"
            className="button"
            onMouseDown={keepFocusOffToolbar}
            onClick={() => setConfirmingNew(true)}
          >
            New project
          </button>
        )}
        {hasPlan && (
          <button
            type="button"
            className="button"
            onMouseDown={keepFocusOffToolbar}
            onClick={() => planStore.getState().fitToScreen(viewport)}
          >
            Fit to screen
          </button>
        )}
        {hasPlan && <CalibrateButton onMouseDown={keepFocusOffToolbar} />}
        {hasPlan && <MeasureButton onMouseDown={keepFocusOffToolbar} />}
        {hasPlan && (
          <AddFurnitureButton
            viewport={viewport}
            onMouseDown={keepFocusOffToolbar}
          />
        )}
        <DeleteFurnitureButton onMouseDown={keepFocusOffToolbar} />
        <input
          ref={inputRef}
          type="file"
          accept={PLAN_FILE_TYPES.join(',')}
          hidden
          onChange={(e) => {
            const file = e.currentTarget.files?.[0]
            e.currentTarget.value = '' // let the same file be picked again
            if (file) void openFile(file)
          }}
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>

      {!hasPlan && !dragging && (
        <p className="empty-hint">
          Drop a floor plan image (PNG or JPG) here, or use “Open plan…”
        </p>
      )}

      {/* Tools and selection exclude each other, so one status fits */}
      {hasPlan &&
        (measuring ? (
          <MeasuringTapeStatus />
        ) : selected ? (
          <FurnitureStatus />
        ) : (
          <CalibrationStatus />
        ))}

      <FurniturePanel />

      {dragging && <div className="drop-overlay">Drop to open the plan</div>}

      {pendingPlan && (
        <ConfirmDialog
          title="Replace the current plan?"
          confirmLabel="Replace"
          onConfirm={() => planStore.getState().confirmReplace(viewport)}
          onCancel={() => planStore.getState().cancelReplace()}
        >
          The current plan will be replaced by {pendingPlan.name}.
        </ConfirmDialog>
      )}

      {confirmingNew && (
        <ConfirmDialog
          title="Start a new project?"
          confirmLabel="Start new project"
          onConfirm={() => {
            setConfirmingNew(false)
            setError(null)
            latestLoad.current++ // a plan still decoding belongs to the old project
            onNewProject()
          }}
          onCancel={() => setConfirmingNew(false)}
        >
          The plan, its scale and all furniture will be removed. This cannot be
          undone.
        </ConfirmDialog>
      )}
    </>
  )
}
