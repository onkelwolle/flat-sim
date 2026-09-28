import type Konva from 'konva'
import { useEffect, useRef, type RefObject } from 'react'
import { isDialogOpen } from '../dialogs'
import { distance, snapToAngle, snapToAngleNear } from './geometry'
import { planStore, usePlanStore } from './planStore'
import type { PlacingPressHandlers } from './usePlacingPress'
import type { Point } from './zoomView'

// Screen pixels the pointer must travel between press and release for the
// release to end the measurement (a drag) rather than leave it following the
// pointer until the next click
const DRAG_THRESHOLD = 4

/**
 * How the measurement's end snaps: fully (to the nearest of horizontal,
 * vertical or 45°), magnetically (only when already close to one) or not.
 */
type Snap = 'full' | 'near' | 'none'

/**
 * How a pointer event snaps: a mouse fully while Shift is held, a finger or
 * pen always magnetically, as they have no Shift key.
 */
const snapFor = (e: PointerEvent): Snap =>
  e.pointerType === 'touch' || e.pointerType === 'pen'
    ? 'near'
    : e.shiftKey
      ? 'full'
      : 'none'

/** Where the measurement's end goes for the pointer's position on the plan. */
function endAt(stage: Konva.Stage | null, snap: Snap): Point | null {
  const at = stage?.getRelativePointerPosition()
  return at ? snapped(at, snap) : null
}

/** `at`, snapped from the measurement's start as `snap` says. */
function snapped(at: Point, snap: Snap): Point {
  const { tape } = planStore.getState()
  const start = tape?.stretching ? tape.measurement?.start : undefined
  if (!start || snap === 'none') return at
  return snap === 'full' ? snapToAngle(start, at) : snapToAngleNear(start, at)
}

type MeasuringTapeHandlers = {
  /** For `useViewNavigation`'s `onCanvasPress` while the tape is active. */
  onCanvasPress: (e: PointerEvent) => void
  onPointerMove: (e: PointerEvent) => void
  onPointerUp: (e: PointerEvent) => void
  /**
   * Cancel the press under way (a second finger landed), placing nothing: a
   * measurement it started goes, an end placed before it stays.
   */
  cancelPress: () => void
}

/**
 * Pointer input for the measuring tape: click, click or click-drag between
 * two points; Shift snaps the end to horizontal, vertical or 45°, and a finger
 * or pen snaps it there within a few degrees; Esc leaves the tape. Points go to the plan store in plan pixels.
 *
 * Touch and pen go through `placing`: the loupe shows each press, a drag's
 * end or a second tap's end goes where the finger lifts, and lifting off the
 * plan places nothing.
 */
export function useMeasuringTape(
  stageRef: RefObject<Konva.Stage | null>,
  placing: Pick<PlacingPressHandlers, 'begin' | 'lift'>,
): MeasuringTapeHandlers {
  const active = usePlanStore((s) => s.tape !== null)
  // Screen position of the press that started the current measurement
  const pressedAt = useRef<Point | null>(null)

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (isDialogOpen()) return
      const store = planStore.getState()
      if (e.type === 'keydown' && e.key === 'Escape') store.stopMeasuring()
      // Pressing or releasing Shift re-snaps without moving the pointer
      if (e.key === 'Shift') {
        const at = endAt(
          stageRef.current,
          e.type === 'keydown' ? 'full' : 'none',
        )
        if (at) store.stretchMeasurementTo(at)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [active, stageRef])

  const onCanvasPress = (e: PointerEvent) => {
    const store = planStore.getState()
    const at = endAt(stageRef.current, snapFor(e))
    if (!at) return
    const touching = placing.begin(e)
    if (store.tape?.stretching) {
      pressedAt.current = null
      // A finger's end follows it until it lifts
      if (touching) store.stretchMeasurementTo(at)
      else store.finishMeasurementAt(at)
    } else {
      pressedAt.current = { x: e.clientX, y: e.clientY }
      store.startMeasurementAt(at)
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!active) return
    const at = endAt(stageRef.current, snapFor(e))
    if (at) planStore.getState().stretchMeasurementTo(at)
  }

  const onPointerUp = (e: PointerEvent) => {
    const pressed = pressedAt.current
    pressedAt.current = null
    if (!active) return
    const store = planStore.getState()
    const dragged =
      !!pressed &&
      distance(pressed, { x: e.clientX, y: e.clientY }) >= DRAG_THRESHOLD
    const lifted = placing.lift(e)
    if (lifted) {
      const start = store.tape?.measurement?.start
      if (!lifted.at) {
        // Off the plan: a drag measures nothing; a second end is not placed
        if (pressed) store.dropMeasurementInProgress()
        else if (start) store.stretchMeasurementTo(start)
      } else if (!pressed || dragged) {
        store.finishMeasurementAt(snapped(lifted.at, snapFor(e)))
      }
      return
    }
    const at = endAt(stageRef.current, snapFor(e))
    if (dragged && at) store.finishMeasurementAt(at)
  }

  const cancelPress = () => {
    const pressed = pressedAt.current
    pressedAt.current = null
    const store = planStore.getState()
    const start = store.tape?.stretching && store.tape.measurement?.start
    // The press started the measurement: drop it; else it was placing the
    // other end, which goes back to the first until the next tap
    if (pressed) store.dropMeasurementInProgress()
    else if (start) store.stretchMeasurementTo(start)
  }

  return { onCanvasPress, onPointerMove, onPointerUp, cancelPress }
}
