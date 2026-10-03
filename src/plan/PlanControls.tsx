import { useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { useKeyboardInset } from '../keyboardInset'
import { usePhoneLayout } from '../useMediaQuery'
import type { Size } from '../useViewportSize'
import {
  CalibrateButton,
  CalibrationLengthDialog,
  CalibrationStatus,
} from './CalibrationControls'
import { ConfirmDialog } from './ConfirmDialog'
import {
  AddFurnitureButton,
  AddFurnitureForm,
  DeleteFurnitureButton,
  FurniturePanel,
  FurnitureStatus,
} from './FurnitureControls'
import { MeasureButton, MeasuringTapeStatus } from './MeasuringTapeControls'
import { loadPlanFile, PLAN_FILE_TYPES } from './loadPlanFile'
import { OverflowMenu } from './OverflowMenu'
import { planStore, usePlanStore } from './planStore'
import { RedoButton, UndoButton } from './UndoControls'
import { useFileDrop } from './useFileDrop'

// A clicked button keeps focus, so the space bar would press it again instead
// of panning; keyboard users still focus buttons with Tab
const keepFocusOffToolbar = (e: MouseEvent) => e.preventDefault()

/**
 * HTML overlay for opening a plan (file picker, drop target, replace prompt),
 * undoing and redoing edits, fitting it to the screen, calibrating its scale,
 * measuring it, adding or deleting furniture and starting a new project. On a
 * phone-narrow screen the main tools sit in a bar at the bottom, the rest in
 * its "⋯" menu; otherwise all of them in a toolbar at the top.
 */
export function PlanControls({
  viewport,
  onNewProject,
}: {
  viewport: Size
  /** Drop the plan and everything on it, once the user has confirmed. */
  onNewProject: () => void
}) {
  const phone = usePhoneLayout()
  const hasPlan = usePlanStore((s) => s.plan !== null)
  const pendingPlan = usePlanStore((s) => s.pendingPlan)
  const measuring = usePlanStore((s) => s.tape !== null)
  const nextRedo = usePlanStore((s) => s.nextRedo?.label)
  const [error, setError] = useState<string | null>(null)
  const [confirmingNew, setConfirmingNew] = useState(false)
  // Here, not in its button, so the form and what is typed in it survive the
  // button moving between toolbar and bottom bar at the phone width
  const [addingFurniture, setAddingFurniture] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [toolbarBottom, measureToolbar] = useBoxMeasure(bottomEdge)
  const [barHeight, measureBar] = useBoxMeasure(height)
  const keyboard = useKeyboardInset()
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

  const choosePlan = () => inputRef.current?.click()
  // On a phone, the bottom bar, and the item sheet while it is expanded,
  // cover the foot of the canvas: fits leave them clear
  const bar = useRef<HTMLDivElement | null>(null)
  const expandedSheet = useRef<HTMLElement>(null)
  // The selection last drawn, so the cover can tell one not drawn yet
  const selectedId = usePlanStore((s) => s.selectedId)
  const drawnSelection = useRef(selectedId)
  useLayoutEffect(() => {
    drawnSelection.current = selectedId
  }, [selectedId])
  useLayoutEffect(() => {
    if (!phone) return
    planStore.getState().setCanvasCover(() => {
      // An item just selected (a new one, say) opens its sheet: draw it
      // first, so the sheet is measured too
      if (planStore.getState().selectedId !== drawnSelection.current)
        flushSync(() => {})
      return (expandedSheet.current ?? bar.current)?.getBoundingClientRect().top
    })
    return () => planStore.getState().setCanvasCover(null)
  }, [phone])
  const fitToScreen = () => planStore.getState().fitToScreen(viewport)
  // A restored plan was fitted before the controls showed: fit it again,
  // clear of them
  const [initialViewport] = useState(viewport)
  useLayoutEffect(() => {
    planStore.getState().fitToScreen(initialViewport)
  }, [initialViewport])

  const openPlanButton = (
    <button
      type="button"
      className="button"
      onMouseDown={keepFocusOffToolbar}
      onClick={choosePlan}
    >
      Open plan…
    </button>
  )

  const errorMessage = error && (
    <p className="error" role="alert">
      {error}
    </p>
  )

  // Tools and selection exclude each other, so one status fits
  const status =
    hasPlan &&
    (measuring ? (
      <MeasuringTapeStatus />
    ) : selectedId !== null ? (
      <FurnitureStatus />
    ) : (
      <CalibrationStatus />
    ))

  return (
    <>
      {!phone && (
        <div ref={measureToolbar} className="toolbar">
          {openPlanButton}
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
            <UndoButton viewport={viewport} onMouseDown={keepFocusOffToolbar} />
          )}
          {hasPlan && (
            <RedoButton viewport={viewport} onMouseDown={keepFocusOffToolbar} />
          )}
          {hasPlan && (
            <button
              type="button"
              className="button"
              onMouseDown={keepFocusOffToolbar}
              onClick={fitToScreen}
            >
              Fit to screen
            </button>
          )}
          {hasPlan && <CalibrateButton onMouseDown={keepFocusOffToolbar} />}
          {hasPlan && <MeasureButton onMouseDown={keepFocusOffToolbar} />}
          {hasPlan && (
            <AddFurnitureButton
              onMouseDown={keepFocusOffToolbar}
              onClick={() => setAddingFurniture(true)}
            />
          )}
          <DeleteFurnitureButton onMouseDown={keepFocusOffToolbar} />
          {errorMessage}
        </div>
      )}
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

      {!hasPlan && !dragging && (
        <p className="empty-hint">
          Drop a floor plan image (PNG or JPG) here, or use “Open plan…”
        </p>
      )}

      {!phone && status}

      {/* The dock is there in both layouts, so the item panel keeps its place
          in the tree, and with it unapplied text, an error and whether the
          sheet is collapsed, while it turns from side panel into sheet */}
      <div
        className={phone ? 'bottom-dock' : undefined}
        style={
          phone
            ? // With the on-screen keyboard up, the bar goes behind it and the
              // sheet, and the field being typed in, sits on it. The canvas
              // stays as it is (it fills the page, which the keyboard doesn't
              // resize)
              { bottom: Math.max(0, keyboard - barHeight) }
            : // No box of its own: the panel sits at the side
              { display: 'contents' }
        }
      >
        {phone && errorMessage}
        {phone && status}
        {/* Before the bar, so the open menu covers it */}
        <FurniturePanel
          sheet={phone}
          below={toolbarBottom}
          expandedSheetRef={expandedSheet}
        />
        {phone && (
          <div
            ref={(element) => {
              bar.current = element
              measureBar(element)
            }}
            className="bottom-bar"
          >
            {hasPlan ? (
              <>
                <CalibrateButton compact onMouseDown={keepFocusOffToolbar} />
                <MeasureButton onMouseDown={keepFocusOffToolbar} />
                <AddFurnitureButton
                  compact
                  onMouseDown={keepFocusOffToolbar}
                  onClick={() => setAddingFurniture(true)}
                />
                <UndoButton
                  viewport={viewport}
                  onMouseDown={keepFocusOffToolbar}
                />
                <OverflowMenu
                  label="More"
                  onMouseDown={keepFocusOffToolbar}
                  items={[
                    { label: 'Open plan…', onSelect: choosePlan },
                    {
                      label: 'New project',
                      onSelect: () => setConfirmingNew(true),
                    },
                    {
                      label: 'Redo',
                      onSelect: () => planStore.getState().redo(viewport),
                      disabled: !nextRedo,
                      title: nextRedo && `Redo ${nextRedo}`,
                    },
                    { label: 'Fit to screen', onSelect: fitToScreen },
                    {
                      label: 'Delete item',
                      onSelect: () =>
                        planStore.getState().deleteSelectedFurniture(),
                      disabled: selectedId === null,
                    },
                  ]}
                />
              </>
            ) : (
              // Nothing else to do until there is a plan
              openPlanButton
            )}
          </div>
        )}
      </div>

      {dragging && <div className="drop-overlay">Drop to open the plan</div>}

      <CalibrationLengthDialog />

      {addingFurniture && (
        <AddFurnitureForm
          viewport={viewport}
          onClose={() => setAddingFurniture(false)}
        />
      )}

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

/**
 * One measure of an element's box, in px, following its size (the toolbar
 * grows a row when it wraps); 0 while there is no element. Pass the setter as
 * the element's ref.
 */
function useBoxMeasure(measureBox: (box: DOMRect) => number) {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [value, setValue] = useState(0)
  useLayoutEffect(() => {
    if (!element) return
    const measure = () => setValue(measureBox(element.getBoundingClientRect()))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      observer.disconnect()
      setValue(0)
    }
  }, [element, measureBox])
  return [value, setElement] as const
}

const bottomEdge = (box: DOMRect) => box.bottom
const height = (box: DOMRect) => box.height
