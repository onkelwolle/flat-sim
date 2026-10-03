import type Konva from 'konva'
import { useEffect, useRef, useState } from 'react'
import { Layer } from 'react-konva'
import { useCoarsePointer } from '../useMediaQuery'
import { MeasuredLine, type HandleDrag, type LineEnd } from './MeasuredLine'
import { planStore, usePlanStore } from './planStore'
import { formatLength } from './scale'
import type { Point } from './zoomView'

const COLOUR = '#dd6b20'

/**
 * How far from an end of the saved line a press grabs it, in screen pixels:
 * a 44 px circle for fingers, less for a mouse.
 */
const HIT_RADIUS = { coarse: 22, fine: 8 }

type CalibrationLayerProps = {
  pointer: Point | null
  zoom?: number
  /** Whether the saved line's ends can be dragged while no tool is active. */
  adjustable?: boolean
  /** Called when the pointer starts or stops hovering over an end. */
  onHoverChange?: (hovering: boolean) => void
  /**
   * Whether a two-finger gesture is under way: it cancels dragging an end,
   * which snaps back and records no step, and starts none until it ends.
   */
  interrupted?: boolean
}

/**
 * The calibration line on the plan: the saved one with its real length, or,
 * while the calibrate tool is active, the line being drawn (rubber-banding to
 * `pointer` after the first click). Drawn in plan pixels; strokes and labels
 * keep a constant size on screen, at the view's zoom or the given `zoom`.
 *
 * While no tool is active, the saved line's ends can be dragged: the line
 * keeps its real length, so the scale follows when an end is dropped.
 */
export function CalibrationLayer({
  pointer,
  zoom: ownZoom,
  adjustable = false,
  onHoverChange,
  interrupted = false,
}: CalibrationLayerProps) {
  const calibration = usePlanStore((s) => s.calibration)
  const draft = usePlanStore((s) => s.calibrationDraft)
  const toolActive = usePlanStore((s) => s.tape !== null || draft !== null)
  const viewZoom = usePlanStore((s) => s.view.scale)
  const zoom = ownZoom ?? viewZoom
  const coarsePointer = useCoarsePointer()
  const layerRef = useRef<Konva.Layer>(null)
  const interruptedRef = useRef(interrupted)
  // The end being dragged and where it is, until it is dropped
  const [dragging, setDragging] = useState<{
    which: LineEnd
    at: Point
  } | null>(null)

  useEffect(() => {
    interruptedRef.current = interrupted
    if (!interrupted) return
    // Ending the drag now snaps it back (see `onDrop`)
    layerRef.current
      ?.find((node: Konva.Node) => node.isDragging())
      .forEach((node) => node.stopDrag())
  }, [interrupted])

  const draggable = adjustable && !toolActive && !!calibration
  const drag: HandleDrag | undefined = draggable
    ? {
        hitRadius: coarsePointer ? HIT_RADIUS.coarse : HIT_RADIUS.fine,
        onMove: (which, at) => setDragging({ which, at }),
        onDrop: (which, at) => {
          setDragging(null)
          if (at) planStore.getState().moveCalibrationEnd(which, at)
        },
        cancelled: () => interruptedRef.current,
        onHoverChange,
      }
    : undefined

  // The pointer may leave an end without a leave event if it goes away
  useEffect(() => () => onHoverChange?.(false), [onHoverChange, draggable])

  // Placed points, then the line: to the pointer while only one is placed
  const saved = calibration && {
    start: calibration.start,
    end: calibration.end,
    ...(dragging && { [dragging.which]: dragging.at }),
  }
  const points: Point[] = draft ?? (saved ? [saved.start, saved.end] : [])
  const [start, end = draft && pointer] = points
  const label =
    !draft && calibration ? formatLength(calibration.lengthCm) : null

  return (
    <Layer ref={layerRef} listening={draggable}>
      {start && (
        <MeasuredLine
          start={start}
          end={end}
          label={label}
          colour={COLOUR}
          zoom={zoom}
          dashed={!!draft}
          handles={points.length > 1 ? 'both' : 'start'}
          drag={drag}
        />
      )}
    </Layer>
  )
}
