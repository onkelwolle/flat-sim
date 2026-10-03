import { cmToPx, type Scale } from './scale'
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

/** How close, in degrees, a line must come to snap without Shift. */
export const MAGNETIC_SNAP_DEG = 5

/**
 * `to`, snapped as `snapToAngle` does, but only if the line from `from`
 * already lies within `MAGNETIC_SNAP_DEG` of horizontal, vertical or 45°:
 * magnetic snapping, for fingers and pens, which have no Shift key.
 */
export function snapToAngleNear(from: Point, to: Point): Point {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const off = Math.abs(angle - Math.round(angle / SNAP_STEP) * SNAP_STEP)
  return off <= (MAGNETIC_SNAP_DEG * Math.PI) / 180 ? snapToAngle(from, to) : to
}

/** Rotation steps an item snaps to while being rotated, in degrees. */
export const ROTATION_STEP = 15

/**
 * A clockwise rotation brought within [0, 360), snapped to the nearest `step`
 * degrees; pass null to leave it unsnapped (free rotation).
 */
export function snapRotation(
  deg: number,
  step: number | null = ROTATION_STEP,
): number {
  const snapped = step ? Math.round(deg / step) * step : deg
  // `+ 0` turns -0 into 0
  return (((snapped % 360) + 360) % 360) + 0
}

/** A way the R key turns an item. */
export type RotationDirection = 'clockwise' | 'counterclockwise'

/**
 * `deg` turned to the next `ROTATION_STEP` in `direction`, within [0, 360):
 * an angle off the grid lands on the grid (7° goes to 15° or 0°).
 */
export function stepRotation(
  deg: number,
  direction: RotationDirection,
): number {
  const steps = deg / ROTATION_STEP
  const next =
    direction === 'clockwise' ? Math.floor(steps) + 1 : Math.ceil(steps) - 1
  return snapRotation(next * ROTATION_STEP)
}

/**
 * A clockwise rotation typed by the user, in degrees, brought within
 * [0, 360) (so 370° is 10° and -90° is 270°), or null if the text is not an
 * angle. Accepts a decimal point or comma and a trailing °.
 */
export function parseRotation(text: string): number | null {
  const normalized = text.trim().replace(/°$/, '').replace(',', '.')
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(normalized)) return null
  return snapRotation(Number(normalized), null)
}

/** A direction an arrow key moves an item in, as seen on screen. */
export type NudgeDirection = 'left' | 'right' | 'up' | 'down'

const NUDGE_UNIT: Record<NudgeDirection, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
}

/**
 * How far, in plan pixels, nudging `cm` real centimetres in `direction` moves
 * an item. The view never rotates, so screen directions are plan directions.
 */
export function nudgeOffset(
  direction: NudgeDirection,
  cm: number,
  scale: Scale,
): Point {
  const { x, y } = NUDGE_UNIT[direction]
  const px = cmToPx(cm, scale)
  // `+ 0` turns -0 into 0
  return { x: x * px + 0, y: y * px + 0 }
}

/**
 * Whether an item's label should turn half a turn so it reads from the bottom
 * or the right of the plan, as on architectural drawings, never upside down.
 */
export const labelFlipped = (rotationDeg: number) => {
  const deg = snapRotation(rotationDeg, null)
  return deg > 90 && deg <= 270
}

/**
 * The clockwise rotation, in [0, 360), for text along a line turned `deg`:
 * the line's own, or half a turn on from it if that would read upside down,
 * so the text reads from the bottom or the right of the plan.
 */
export const readableRotation = (deg: number) =>
  snapRotation(labelFlipped(deg) ? deg + 180 : deg, null)
