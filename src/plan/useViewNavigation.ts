import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Size } from '../useViewportSize'
import { pinchStep, type Fingers } from './pinch'
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
  style: { cursor?: string; touchAction: 'none' }
}

type ViewNavigation = {
  /** Props for the Stage. */
  stageProps: StageNavigationProps
  /**
   * Whether a drag is panning the view. The pointer then moves with the plan,
   * so tools must not follow it until the pan ends.
   */
  panning: boolean
  /**
   * Whether two fingers are pinching the view: from the second finger down
   * until every finger is lifted. Tools and items must ignore touches then.
   */
  pinching: boolean
}

/**
 * Zoom (wheel, trackpad pinch, two-finger pinch) and pan (drag on empty
 * canvas, space+drag, two fingers) the plan view. The page itself never zooms
 * or scrolls from the canvas.
 *
 * While a tool is active, pass `onCanvasPress`: a primary press on the canvas
 * then goes to the tool instead of panning, and only space+drag or two
 * fingers pan. `onPinchStart` is called when a second finger lands, to
 * cancel whatever the first one was doing.
 */
export function useViewNavigation(
  stageRef: RefObject<Konva.Stage | null>,
  viewport: Size,
  onCanvasPress?: (e: PointerEvent) => void,
  onPinchStart?: () => void,
): ViewNavigation {
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [panning, setPanning] = useState(false)
  const [pinching, setPinching] = useState(false)
  const lastPointer = useRef<Point>({ x: 0, y: 0 })
  // The pointer dragging a pan; others (a second finger) don't move it
  const panPointer = useRef<number | null>(null)
  // A Safari trackpad pinch (gesture events) is under way
  const gesturing = useRef(false)
  // Screen positions of the fingers on the canvas, by pointer id
  const touches = useRef(new Map<number, Point>())
  const pinchingRef = useRef(false)
  const viewportRef = useRef(viewport)
  const onPinchStartRef = useRef(onPinchStart)

  useEffect(() => {
    viewportRef.current = viewport
    onPinchStartRef.current = onPinchStart
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
      if (e.pointerId !== panPointer.current) return
      planStore.getState().panBy({
        x: e.clientX - lastPointer.current.x,
        y: e.clientY - lastPointer.current.y,
      })
      lastPointer.current = { x: e.clientX, y: e.clientY }
    }
    const stop = () => setPanning(false)
    const onUp = (e: PointerEvent) => {
      if (e.pointerId === panPointer.current) stop()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('blur', stop)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('blur', stop)
    }
  }, [panning])

  // Two fingers on the canvas pan and pinch-zoom the view
  useEffect(() => {
    const container = stageRef.current?.container()
    if (!container) return
    const fingers = touches.current
    /** The two fingers that steer, if two are down. */
    const pair = (): Fingers | null => {
      const [a, b] = fingers.values()
      return a && b ? [a, b] : null
    }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (fingers.size < 2 || pinchingRef.current) return
      pinchingRef.current = true
      setPinching(true)
      setPanning(false)
      onPinchStartRef.current?.()
    }
    const onMove = (e: PointerEvent) => {
      if (!fingers.has(e.pointerId)) return
      const before = pair()
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const after = pair()
      if (!pinchingRef.current || !before || !after) return
      const { at, factor, pan } = pinchStep(before, after)
      const rect = container.getBoundingClientRect()
      const store = planStore.getState()
      store.panBy(pan)
      store.zoomAt(
        { x: at.x - rect.left, y: at.y - rect.top },
        factor,
        viewportRef.current,
      )
    }
    const onUp = (e: PointerEvent) => {
      if (!fingers.delete(e.pointerId) || fingers.size > 0) return
      if (!pinchingRef.current) return
      pinchingRef.current = false
      setPinching(false)
    }
    container.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      container.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      fingers.clear()
    }
  }, [stageRef])

  // Pinching over the toolbar must not zoom the page either
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault()
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])

  // Safari reports trackpad pinches as gesture events rather than ctrl+wheel.
  // On iPad it reports finger pinches as gesture events too, alongside the
  // touches that already zoom: those it must not zoom a second time.
  useEffect(() => {
    let lastScale = 1
    const onStart = (e: Event) => {
      e.preventDefault()
      gesturing.current = true
      lastScale = 1
    }
    const onChange = (e: Event) => {
      e.preventDefault()
      const container = stageRef.current?.container()
      if (!container || touches.current.size > 0) return
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
      gesturing.current = false
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
    if (!at || gesturing.current) return
    const speed = e.evt.ctrlKey ? PINCH_SPEED : WHEEL_SPEED
    const zoom = -wheelPixels(e.evt, viewport) * speed
    const limit = Math.log(MAX_WHEEL_ZOOM)
    const factor = Math.exp(Math.min(limit, Math.max(-limit, zoom)))
    planStore.getState().zoomAt(at, factor, viewport)
  }

  const onPointerDown = (e: KonvaEventObject<PointerEvent>) => {
    const { button, isPrimary, clientX, clientY, pointerId } = e.evt
    if (button !== 0 || !isPrimary || pinchingRef.current) return
    // An active tool takes presses on the canvas; space+drag still pans
    if (onCanvasPress && !spaceHeld) return onCanvasPress(e.evt)
    const onEmptyCanvas = e.target === e.target.getStage()
    if (!(spaceHeld || onEmptyCanvas)) return
    lastPointer.current = { x: clientX, y: clientY }
    panPointer.current = pointerId
    setPanning(true)
  }

  const cursor = panning ? 'grabbing' : spaceHeld ? 'grab' : undefined

  return {
    stageProps: {
      onWheel,
      onPointerDown,
      style: { cursor, touchAction: 'none' },
    },
    panning,
    pinching,
  }
}
