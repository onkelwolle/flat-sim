import type { Size } from '../useViewportSize'

/** Stage transform: screen px = plan px × scale + offset. */
export type View = { scale: number; x: number; y: number }

/** Largest scale at which the whole plan fits the viewport, centred. */
export function fitToViewport(plan: Size, viewport: Size): View {
  const scale = Math.min(
    viewport.width / plan.width,
    viewport.height / plan.height,
  )
  return {
    scale,
    x: (viewport.width - plan.width * scale) / 2,
    y: (viewport.height - plan.height * scale) / 2,
  }
}
