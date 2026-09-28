import { useSyncExternalStore } from 'react'

type VisualViewportBox = Pick<VisualViewport, 'height' | 'offsetTop' | 'scale'>

/**
 * How many px at the bottom of the layout viewport (`layoutHeight`, what the
 * canvas fills) the visual viewport doesn't show: the on-screen keyboard.
 * The page keeps its size while the keyboard is up (`interactive-widget=
 * resizes-visual`), so only the visual viewport shrinks, and may be scrolled
 * down to a field. A pinch-zoomed page hides its bottom too, but that is no
 * keyboard: 0.
 */
export function keyboardInset(
  layoutHeight: number,
  visual: VisualViewportBox,
): number {
  if (Math.abs(visual.scale - 1) > 0.01) return 0
  const covered = layoutHeight - visual.offsetTop - visual.height
  return covered < 1 ? 0 : Math.round(covered)
}

const subscribe = (onChange: () => void) => {
  const visual = window.visualViewport
  visual?.addEventListener('resize', onChange)
  visual?.addEventListener('scroll', onChange)
  window.addEventListener('resize', onChange)
  return () => {
    visual?.removeEventListener('resize', onChange)
    visual?.removeEventListener('scroll', onChange)
    window.removeEventListener('resize', onChange)
  }
}

const read = () =>
  window.visualViewport
    ? keyboardInset(window.innerHeight, window.visualViewport)
    : 0

/**
 * The px the on-screen keyboard covers at the bottom of the screen, following
 * it as it opens and closes; 0 while it is closed.
 */
export const useKeyboardInset = () => useSyncExternalStore(subscribe, read)
