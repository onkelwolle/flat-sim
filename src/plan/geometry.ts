import type { Point } from './zoomView'

/** Straight-line distance between two points. */
export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)

const SNAP_STEP = Math.PI / 4

/**
 * `to`, moved onto the nearest horizontal, vertical or 45° line through
 * `from`: its projection onto that line, so the end still follows how far
 * along the pointer reaches.
 */
export function snapToAngle(from: Point, to: Point): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const angle = Math.round(Math.atan2(dy, dx) / SNAP_STEP) * SNAP_STEP
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  const along = dx * ux + dy * uy
  // Round away float noise so axis-aligned ends keep exact coordinates
  const clean = (n: number) => Math.round(n * 1e9) / 1e9
  return { x: clean(from.x + along * ux), y: clean(from.y + along * uy) }
}
