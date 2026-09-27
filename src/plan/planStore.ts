import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { Size } from '../useViewportSize'
import { fitToViewport, type View } from './fitToViewport'
import { scaleFromLine, type Scale } from './scale'
import { zoomView, type Point } from './zoomView'

/** Zoom limits, as multiples of the scale that fits the plan to the viewport. */
export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 16

/** A decoded floor plan image; its pixels are the plan's coordinate space. */
export type Plan = {
  name: string
  image: ImageBitmap
  width: number
  height: number
}

/**
 * A line drawn along a wall of known length, and the scale it sets. Points are
 * in plan-image pixels, so the calibration survives zoom and pan.
 */
export type Calibration = {
  start: Point
  end: Point
  lengthCm: number
  scale: Scale
}

export type PlanState = {
  plan: Plan | null
  /** The plan's calibration; null until the scale is set. */
  calibration: Calibration | null
  /**
   * Points placed so far with the calibrate tool (0–2), or null when the tool
   * is not active.
   */
  calibrationDraft: Point[] | null
  /** A new plan waiting for the user to confirm it replaces `plan`. */
  pendingPlan: Plan | null
  view: View
  /** Show `plan`, fitted to the viewport, unless one is already loaded. */
  offerPlan: (plan: Plan, viewport: Size) => void
  /** Show the pending plan, fitted to the viewport. */
  confirmReplace: (viewport: Size) => void
  /** Keep the current plan and drop the pending one. */
  cancelReplace: () => void
  /** Scale the view by `factor` around a screen point, within the zoom limits. */
  zoomAt: (at: Point, factor: number, viewport: Size) => void
  /** Move the view by a screen distance. */
  panBy: (delta: Point) => void
  /** Fit the whole plan to the viewport again. */
  fitToScreen: (viewport: Size) => void
  /** Activate the calibrate tool. */
  startCalibration: () => void
  /** Place the next end of the calibration line, in plan pixels. */
  placeCalibrationPoint: (point: Point) => void
  /** Set the scale from the drawn line and its real length. */
  finishCalibration: (lengthCm: number) => void
  /** Leave the calibrate tool, keeping any earlier calibration. */
  cancelCalibration: () => void
}

export function createPlanStore() {
  return createStore<PlanState>()((set, get) => ({
    plan: null,
    calibration: null,
    calibrationDraft: null,
    pendingPlan: null,
    view: { scale: 1, x: 0, y: 0 },
    offerPlan: (plan, viewport) => {
      const { plan: current, pendingPlan } = get()
      if (!current) return set({ plan, view: fitToViewport(plan, viewport) })
      pendingPlan?.image.close()
      set({ pendingPlan: plan })
    },
    confirmReplace: (viewport) => {
      const { plan: old, pendingPlan: plan } = get()
      if (!plan) return
      set({
        plan,
        pendingPlan: null,
        view: fitToViewport(plan, viewport),
        // A new image has its own scale
        calibration: null,
        calibrationDraft: null,
      })
      // Released after the swap so nothing renders a closed bitmap
      old?.image.close()
    },
    cancelReplace: () => {
      get().pendingPlan?.image.close()
      set({ pendingPlan: null })
    },
    zoomAt: (at, factor, viewport) => {
      const { plan, view } = get()
      if (!plan) return
      const fit = fitToViewport(plan, viewport).scale
      set({
        view: zoomView(view, at, factor, {
          min: fit * MIN_ZOOM,
          max: fit * MAX_ZOOM,
        }),
      })
    },
    panBy: (delta) => {
      const { plan, view } = get()
      if (!plan) return
      set({ view: { ...view, x: view.x + delta.x, y: view.y + delta.y } })
    },
    fitToScreen: (viewport) => {
      const { plan } = get()
      if (plan) set({ view: fitToViewport(plan, viewport) })
    },
    startCalibration: () => {
      if (get().plan) set({ calibrationDraft: [] })
    },
    placeCalibrationPoint: (point) => {
      const { calibrationDraft: draft } = get()
      if (!draft || draft.length >= 2) return
      const [start] = draft
      // A zero-length line cannot set a scale
      if (start && start.x === point.x && start.y === point.y) return
      set({ calibrationDraft: [...draft, point] })
    },
    finishCalibration: (lengthCm) => {
      const [start, end] = get().calibrationDraft ?? []
      if (!start || !end || !(lengthCm > 0) || !isFinite(lengthCm)) return
      set({
        calibration: {
          start,
          end,
          lengthCm,
          scale: scaleFromLine(start, end, lengthCm),
        },
        calibrationDraft: null,
      })
    },
    cancelCalibration: () => set({ calibrationDraft: null }),
  }))
}

export const planStore = createPlanStore()

/**
 * The plan's scale, or null until it is calibrated. Measuring tools stay
 * disabled while this is null.
 */
export const selectScale = (state: PlanState): Scale | null =>
  state.calibration?.scale ?? null

export const usePlanStore = <T>(selector: (state: PlanState) => T): T =>
  useStore(planStore, selector)
