import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Size } from '../useViewportSize'
import { planStore } from './planStore'
import type { Point } from './zoomView'

// Zoom factor per pixel of wheel delta: ~1.16× per mouse wheel notch (100 px);
// trackpad pinches arrive as ctrl+wheel with much smaller deltas
const WHEEL_SPEED = 0.0015
const PINCH_SPEED = 0.01
// Most one wheel event may zoom, so ctrl+mouse wheel doesn't leap like a pinch
const MAX_WHEEL_ZOOM = 1.25
// Pixels per wheel "line" (Firefox reports some wheels in lines)
const WHEEL_LINE_PX = 40

/** Safari's non-standard trackpad pinch event. */
type GestureEvent = UIEvent & {
  scale: number
  clientX: number
  clientY: number
}

const wheelPixels = (e: WheelEvent, viewport: Size) =>
  e.deltaY *
  (e.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? WHEEL_LINE_PX
    : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? viewport.height
      : 1)

/**
 * Whether a key event's target is a form control: keys typed there (space,
 * Delete) belong to that control, not to the canvas.
 */
export const isControl = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName))

type StageNavigationProps = {
  onWheel: (e: KonvaEventObject<WheelEvent>) => void
  onPointerDown: (e: KonvaEventObject<PointerEvent>) => void
  style: { cursor?: string }
}

/**
 * Zoom (wheel, trackpad pinch) and pan (drag on empty canvas, space+drag) the
 * plan view. Returns props for the Stage.
 *
 * While a tool is active, pass `onCanvasPress`: a primary press on the canvas
 * then goes to the tool instead of panning, and only space+drag pans.
 */
export function useViewNavigation(
  stageRef: RefObject<Konva.Stage | null>,
  viewport: Size,
  onCanvasPress?: (e: PointerEvent) => void,
): StageNavigationProps {
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [panning, setPanning] = useState(false)
  const lastPointer = useRef<Point>({ x: 0, y: 0 })
  const pinching = useRef(false)
  const viewportRef = useRef(viewport)

  useEffect(() => {
    viewportRef.current = viewport
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isControl(e.target)) return
      e.preventDefault()
      setSpaceHeld(true)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    const release = () => setSpaceHeld(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', release)
    }
  }, [])

  useEffect(() => {
    if (!panning) return
    const onMove = (e: PointerEvent) => {
      planStore.getState().panBy({
        x: e.clientX - lastPointer.current.x,
        y: e.clientY - lastPointer.current.y,
      })
      lastPointer.current = { x: e.clientX, y: e.clientY }
    }
    const stop = () => setPanning(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    window.addEventListener('blur', stop)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      window.removeEventListener('blur', stop)
    }
  }, [panning])

  // Pinching over the toolbar must not zoom the page either
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault()
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])

  // Safari reports trackpad pinches as gesture events rather than ctrl+wheel
  useEffect(() => {
    let lastScale = 1
    const onStart = (e: Event) => {
      e.preventDefault()
      pinching.current = true
      lastScale = 1
    }
    const onChange = (e: Event) => {
      e.preventDefault()
      const container = stageRef.current?.container()
      if (!container) return
      const { scale, clientX, clientY } = e as GestureEvent
      const rect = container.getBoundingClientRect()
      planStore
        .getState()
        .zoomAt(
          { x: clientX - rect.left, y: clientY - rect.top },
          scale / lastScale,
          viewportRef.current,
        )
      lastScale = scale
    }
    const onEnd = (e: Event) => {
      e.preventDefault()
      pinching.current = false
    }
    window.addEventListener('gesturestart', onStart)
    window.addEventListener('gesturechange', onChange)
    window.addEventListener('gestureend', onEnd)
    return () => {
      window.removeEventListener('gesturestart', onStart)
      window.removeEventListener('gesturechange', onChange)
      window.removeEventListener('gestureend', onEnd)
    }
  }, [stageRef])

  const onWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault() // no page zoom on ctrl+wheel / pinch
    const at = e.target.getStage()?.getPointerPosition()
    if (!at || pinching.current) return
    const speed = e.evt.ctrlKey ? PINCH_SPEED : WHEEL_SPEED
    const zoom = -wheelPixels(e.evt, viewport) * speed
    const limit = Math.log(MAX_WHEEL_ZOOM)
    const factor = Math.exp(Math.min(limit, Math.max(-limit, zoom)))
    planStore.getState().zoomAt(at, factor, viewport)
  }

  const onPointerDown = (e: KonvaEventObject<PointerEvent>) => {
    const { button, isPrimary, clientX, clientY } = e.evt
    if (button !== 0 || !isPrimary) return
    // An active tool takes presses on the canvas; space+drag still pans
    if (onCanvasPress && !spaceHeld) return onCanvasPress(e.evt)
    const onEmptyCanvas = e.target === e.target.getStage()
    if (!(spaceHeld || onEmptyCanvas)) return
    lastPointer.current = { x: clientX, y: clientY }
    setPanning(true)
  }

  const cursor = panning ? 'grabbing' : spaceHeld ? 'grab' : undefined

  return { onWheel, onPointerDown, style: { cursor } }
}
