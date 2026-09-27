import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { Size } from '../useViewportSize'
import { CalibrateButton, CalibrationStatus } from './CalibrationControls'
import { loadPlanFile, PLAN_FILE_TYPES } from './loadPlanFile'
import { planStore, usePlanStore } from './planStore'
import { useFileDrop } from './useFileDrop'

// A clicked button keeps focus, so the space bar would press it again instead
// of panning; keyboard users still focus buttons with Tab
const keepFocusOffToolbar = (e: MouseEvent) => e.preventDefault()

/**
 * HTML overlay for opening a plan (file picker, drop target, replace prompt),
 * fitting it to the screen and calibrating its scale.
 */
export function PlanControls({ viewport }: { viewport: Size }) {
  const hasPlan = usePlanStore((s) => s.plan !== null)
  const pendingPlan = usePlanStore((s) => s.pendingPlan)
  const [error, setError] = useState<string | null>(null)
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

  // No new plans while the replace prompt is open
  const dragging = useFileDrop(openFile, !pendingPlan)

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
            onClick={() => planStore.getState().fitToScreen(viewport)}
          >
            Fit to screen
          </button>
        )}
        {hasPlan && <CalibrateButton onMouseDown={keepFocusOffToolbar} />}
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

      {hasPlan && <CalibrationStatus />}

      {dragging && <div className="drop-overlay">Drop to open the plan</div>}

      {pendingPlan && (
        <ReplacePlanDialog
          name={pendingPlan.name}
          onConfirm={() => planStore.getState().confirmReplace(viewport)}
          onCancel={() => planStore.getState().cancelReplace()}
        />
      )}
    </>
  )
}

function ReplacePlanDialog({
  name,
  onConfirm,
  onCancel,
}: {
  name: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className="backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="replace-plan-title"
        className="dialog"
      >
        <h2 id="replace-plan-title">Replace the current plan?</h2>
        <p>The current plan will be replaced by {name}.</p>
        <div className="dialog-actions">
          <button type="button" className="button" autoFocus onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="button primary" onClick={onConfirm}>
            Replace
          </button>
        </div>
      </div>
    </div>
  )
}
