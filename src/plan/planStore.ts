import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { Size } from '../useViewportSize'
import { fitToViewport, type View } from './fitToViewport'

/** A decoded floor plan image; its pixels are the plan's coordinate space. */
export type Plan = {
  name: string
  image: CanvasImageSource
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
}

export function createPlanStore() {
  return createStore<PlanState>()((set, get) => ({
    plan: null,
    pendingPlan: null,
    view: { scale: 1, x: 0, y: 0 },
    offerPlan: (plan, viewport) =>
      set(
        get().plan
          ? { pendingPlan: plan }
          : { plan, view: fitToViewport(plan, viewport) },
      ),
    confirmReplace: (viewport) => {
      const plan = get().pendingPlan
      if (plan)
        set({ plan, pendingPlan: null, view: fitToViewport(plan, viewport) })
    },
    cancelReplace: () => set({ pendingPlan: null }),
  }))
}

export const planStore = createPlanStore()

export const usePlanStore = <T>(selector: (state: PlanState) => T): T =>
  useStore(planStore, selector)
