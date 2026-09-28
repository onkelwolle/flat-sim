import type Konva from 'konva'
import { useEffect, useState, type RefObject } from 'react'
import { planStore } from './planStore'
import { screenToPlan, type Point } from './zoomView'

/** A finger or pen down on the canvas, placing a point where it lifts. */
export type PlacingPress = {
  pointerId: number
  /** Where it is on screen (client pixels). */
  finger: Point
}

export type PlacingPressHandlers = {
  /** The press under way, for the loupe; null when none is. */
  press: PlacingPress | null
  /**
   * Start a press if `e` is a touch or pen press, which places its point
   * where it lifts; returns whether it did. Mouse presses place at once.
   */
  begin: (e: PointerEvent) => boolean
  /** Follow the press as the finger slides. */
  follow: (e: PointerEvent) => void
  /**
   * End the press `e` lifts: null if it was none, else where on the plan it
   * lifted, in plan pixels, or `at: null` off the plan or off the canvas.
   */
  lift: (e: PointerEvent) => { at: Point | null } | null
  /** Drop the press under way, placing nothing (a second finger landed). */
  cancel: () => void
}

const placesOnLift = (e: PointerEvent) =>
  e.pointerType === 'touch' || e.pointerType === 'pen'

/**
 * Touch and pen presses for the tools that place points: the finger covers
 * the point, so the loupe shows it while the finger is down, the finger can
 * slide to adjust, and the point goes where it lifts.
 */
export function usePlacingPress(
  stageRef: RefObject<Konva.Stage | null>,
): PlacingPressHandlers {
  const [press, setPress] = useState<PlacingPress | null>(null)
  const pointerId = press?.pointerId

  // A press lifted where the stage doesn't see it places nothing
  useEffect(() => {
    if (pointerId === undefined) return
    const onUp = (e: PointerEvent) => {
      if (e.pointerId === pointerId) setPress(null)
    }
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [pointerId])

  const begin = (e: PointerEvent) => {
    if (!placesOnLift(e)) return false
    setPress({ pointerId: e.pointerId, finger: { x: e.clientX, y: e.clientY } })
    return true
  }

  const follow = (e: PointerEvent) => {
    if (e.pointerId !== press?.pointerId) return
    setPress({ ...press, finger: { x: e.clientX, y: e.clientY } })
  }

  const lift = (e: PointerEvent) => {
    if (e.pointerId !== press?.pointerId) return null
    setPress(null)
    return { at: planPointAt(stageRef.current, e) }
  }

  const cancel = () => setPress(null)

  return { press, begin, follow, lift, cancel }
}

/** The plan point under a pointer event, or null off the plan or canvas. */
function planPointAt(stage: Konva.Stage | null, e: PointerEvent) {
  const container = stage?.container()
  const { plan, view } = planStore.getState()
  if (!container || !plan) return null
  const over = document.elementFromPoint(e.clientX, e.clientY)
  if (!over || !container.contains(over)) return null
  const rect = container.getBoundingClientRect()
  const at = screenToPlan(view, {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  })
  const onPlan =
    at.x >= 0 && at.y >= 0 && at.x <= plan.width && at.y <= plan.height
  return onPlan ? at : null
}
