import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { Size } from '../useViewportSize'
import { fitToViewport, type View } from './fitToViewport'
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

export type PlanState = {
  plan: Plan | null
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
}

export function createPlanStore() {
  return createStore<PlanState>()((set, get) => ({
    plan: null,
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
      set({ plan, pendingPlan: null, view: fitToViewport(plan, viewport) })
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
  }))
}

export const planStore = createPlanStore()

export const usePlanStore = <T>(selector: (state: PlanState) => T): T =>
  useStore(planStore, selector)
