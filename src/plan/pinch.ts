import { distance } from './geometry'
import type { Point } from './zoomView'

/** Two fingers' screen positions. */
export type Fingers = readonly [Point, Point]

/** How one move of two fingers changes the view. */
export type PinchStep = {
  /** The fingers' new midpoint: the screen point to zoom around. */
  at: Point
  /** How much to zoom: the ratio of the fingers' new and old spread. */
  factor: number
  /** How far to pan first: the distance the midpoint moved. */
  pan: Point
}

const midpoint = ([a, b]: Fingers): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
})

/**
 * The view change for two fingers moving from `before` to `after`: panning
 * by `pan` and then zooming by `factor` around `at` keeps the plan under
 * the fingers.
 */
export function pinchStep(before: Fingers, after: Fingers): PinchStep {
  const from = midpoint(before)
  const at = midpoint(after)
  const spread = distance(...before)
  return {
    at,
    factor: spread > 0 ? distance(...after) / spread : 1,
    pan: { x: at.x - from.x, y: at.y - from.y },
  }
}
