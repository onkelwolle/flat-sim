import { useEffect, useState } from 'react'
import type { Size } from '../useViewportSize'
import { loadPlanFile, PLAN_FILE_TYPES } from './loadPlanFile'
import { planStore, usePlanStore } from './planStore'
import { useFileDrop } from './useFileDrop'

/** HTML overlay for opening a plan: file picker, drop target, replace prompt. */
export function PlanControls({ viewport }: { viewport: Size }) {
  const hasPlan = usePlanStore((s) => s.plan !== null)
  const pendingPlan = usePlanStore((s) => s.pendingPlan)
  const [error, setError] = useState<string | null>(null)

  const openFile = async (file: File) => {
    setError(null)
    try {
      planStore.getState().offerPlan(await loadPlanFile(file), viewport)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const dragging = useFileDrop(openFile)

  return (
    <>
      <div className="toolbar">
        <label className="button">
          Open plan…
          <input
            type="file"
            accept={PLAN_FILE_TYPES.join(',')}
            hidden
            onChange={(e) => {
              const file = e.currentTarget.files?.[0]
              e.currentTarget.value = '' // let the same file be picked again
              if (file) void openFile(file)
            }}
          />
        </label>
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
