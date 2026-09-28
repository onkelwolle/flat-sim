import type { View } from './fitToViewport'
import type { Point } from './zoomView'

/** Diameter of the loupe, in screen pixels. */
export const LOUPE_SIZE = 120
// How far the loupe's centre sits from the finger, across and down
const OFFSET = 100
// How much more the loupe magnifies than the view
const MAGNIFICATION = 2

/**
 * Where the loupe's centre goes on the canvas for a finger at `finger`:
 * above-left of it, clear of the hand, unless that would cut it off at the
 * top or left edge.
 */
export function loupeCentre(finger: Point): Point {
  const radius = LOUPE_SIZE / 2
  const left = finger.x - OFFSET
  const above = finger.y - OFFSET
  // Near the top edge it flips below the finger, near the left edge right
  return {
    x: left - radius < 0 ? finger.x + OFFSET : left,
    y: above - radius < 0 ? finger.y + OFFSET : above,
  }
}

/**
 * The loupe's own view of the plan: magnified twice as much as the view at
 * `zoom`, with the plan point `at` in the loupe's centre.
 */
export function loupeView(at: Point, zoom: number): View {
  const scale = zoom * MAGNIFICATION
  const centre = LOUPE_SIZE / 2
  return { scale, x: centre - at.x * scale, y: centre - at.y * scale }
}
