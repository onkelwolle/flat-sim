import type { View } from './fitToViewport'

export type Point = { x: number; y: number }

/**
 * Scale the view by `factor`, clamped to `limits`, keeping the plan point
 * under the screen point `at` in place.
 */
export function zoomView(
  view: View,
  at: Point,
  factor: number,
  limits: { min: number; max: number },
): View {
  // A scale already outside the limits (the viewport changed) may only move
  // back towards them, never jump the other way
  const min = Math.min(limits.min, view.scale)
  const max = Math.max(limits.max, view.scale)
  const scale = Math.min(max, Math.max(min, view.scale * factor))
  const ratio = scale / view.scale
  return {
    scale,
    x: at.x - (at.x - view.x) * ratio,
    y: at.y - (at.y - view.y) * ratio,
  }
}
