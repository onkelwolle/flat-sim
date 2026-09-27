import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { Size } from '../useViewportSize'
import { fitToViewport, type View } from './fitToViewport'
import {
  distance,
  nudgeOffset,
  snapRotation,
  type NudgeDirection,
} from './geometry'
import { cmToPx, pxToCm, scaleFromLine, type Scale } from './scale'
import { screenToPlan, zoomView, type Point } from './zoomView'

/** Zoom limits, as multiples of the scale that fits the plan to the viewport. */
export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 16

/** A decoded floor plan image; its pixels are the plan's coordinate space. */
export type Plan = {
  name: string
  image: ImageBitmap
  width: number
  height: number
  /** The image file the plan was decoded from, kept so it can be saved. */
  source: Blob
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

/** A straight line between two points on the plan, in plan pixels. */
export type Measurement = { start: Point; end: Point }

/** The measuring tape while it is active. */
export type Tape = {
  /** The current measurement, if one has been started. */
  measurement: Measurement | null
  /** Whether the measurement's end still follows the pointer. */
  stretching: boolean
}

/** What the user enters to add an item of furniture. */
export type FurnitureSpec = {
  name: string
  /** Real size in centimetres, so re-calibrating keeps it correct. */
  widthCm: number
  depthCm: number
}

/**
 * A rectangular item of furniture on the plan. Its size is real (cm) and
 * converts through the scale when drawn; its centre is in plan pixels.
 */
export type Furniture = FurnitureSpec & {
  id: string
  /** Centre of the item, in plan pixels. */
  position: Point
  /** Clockwise rotation about the centre, in degrees; 0 keeps width along x. */
  rotationDeg: number
}

/**
 * What a project keeps between visits: the plan, its calibration and the
 * furniture on it. The view and anything in progress are left out.
 */
export type Project = {
  plan: Plan | null
  calibration: Calibration | null
  furniture: Furniture[]
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
  /** The measuring tape, or null when the tool is not active. */
  tape: Tape | null
  /** Furniture placed on the plan, bottom to top. */
  furniture: Furniture[]
  /** Id of the selected item, or null when nothing is selected. */
  selectedId: string | null
  /** A new plan waiting for the user to confirm it replaces `plan`. */
  pendingPlan: Plan | null
  view: View
  /** Replace everything with a saved project, fitted to the viewport. */
  restoreProject: (project: Project, viewport: Size) => void
  /** Drop the plan, its calibration and all furniture. */
  newProject: () => void
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
  /** Activate the measuring tape; only possible once the scale is set. */
  startMeasuring: () => void
  /** Start a new measurement at a point, in plan pixels; its end follows. */
  startMeasurementAt: (point: Point) => void
  /** Move the end of the measurement being stretched. */
  stretchMeasurementTo: (point: Point) => void
  /** Fix the end of the measurement being stretched. */
  finishMeasurementAt: (point: Point) => void
  /** Leave the measuring tape; its measurement disappears. */
  stopMeasuring: () => void
  /** Add an item centred in the view; only possible once the scale is set. */
  addFurniture: (spec: FurnitureSpec, viewport: Size) => void
  /** Select an item, replacing any earlier selection. */
  selectFurniture: (id: string) => void
  /** Select nothing. */
  clearSelection: () => void
  /** Remove the selected item from the plan. */
  deleteSelectedFurniture: () => void
  /** Put an item's centre at a point, in plan pixels. */
  moveFurniture: (id: string, position: Point) => void
  /** Set an item's clockwise rotation, in degrees; kept within [0, 360). */
  rotateFurniture: (id: string, deg: number) => void
  /** Set an item's real size; ignored unless both are greater than zero. */
  resizeFurniture: (id: string, widthCm: number, depthCm: number) => void
  /** Move the selected item `cm` real centimetres in a screen direction. */
  nudgeSelectedFurniture: (direction: NudgeDirection, cm: number) => void
}

/** State change that selects an item; one activity at a time, so tools end. */
const selectItem = (id: string) => ({
  selectedId: id,
  calibrationDraft: null,
  tape: null,
})

/** Everything that belongs to one plan, as it is before any work on it. */
const blankProject = {
  plan: null,
  calibration: null,
  calibrationDraft: null,
  tape: null,
  furniture: [],
  selectedId: null,
  pendingPlan: null,
} satisfies Partial<PlanState>

/** The number in an item id (`item-7` → 7), or 0 if it has none. */
const idNumber = (id: string) => Number(/^item-(\d+)$/.exec(id)?.[1] ?? 0)

export function createPlanStore() {
  let lastId = 0
  return createStore<PlanState>()((set, get) => ({
    ...blankProject,
    view: { scale: 1, x: 0, y: 0 },
    restoreProject: ({ plan, calibration, furniture }, viewport) => {
      const old = get()
      // New items must not reuse a restored item's id
      lastId = Math.max(0, ...furniture.map((f) => idNumber(f.id)))
      set({
        ...blankProject,
        plan,
        calibration,
        furniture,
        view: plan ? fitToViewport(plan, viewport) : old.view,
      })
      if (old.plan !== plan) old.plan?.image.close()
      old.pendingPlan?.image.close()
    },
    newProject: () => {
      const { plan, pendingPlan } = get()
      lastId = 0
      set(blankProject)
      plan?.image.close()
      pendingPlan?.image.close()
    },
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
        tape: null,
        // Furniture was placed against the old image
        furniture: [],
        selectedId: null,
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
      // One tool at a time
      if (get().plan)
        set({ calibrationDraft: [], tape: null, selectedId: null })
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
    startMeasuring: () => {
      if (!selectScale(get())) return
      set({
        tape: { measurement: null, stretching: false },
        calibrationDraft: null,
        selectedId: null,
      })
    },
    startMeasurementAt: (point) => {
      if (!get().tape) return
      set({
        tape: { measurement: { start: point, end: point }, stretching: true },
      })
    },
    stretchMeasurementTo: (point) => {
      const { tape } = get()
      if (!tape?.measurement || !tape.stretching) return
      set({
        tape: { ...tape, measurement: { ...tape.measurement, end: point } },
      })
    },
    finishMeasurementAt: (point) => {
      const { tape } = get()
      if (!tape?.measurement || !tape.stretching) return
      const { start } = tape.measurement
      // Nothing to measure yet; the end keeps following the pointer
      if (start.x === point.x && start.y === point.y) return
      set({
        tape: {
          measurement: { ...tape.measurement, end: point },
          stretching: false,
        },
      })
    },
    stopMeasuring: () => set({ tape: null }),
    addFurniture: (spec, viewport) => {
      const { furniture, view } = get()
      if (!selectScale(get())) return
      const centre = { x: viewport.width / 2, y: viewport.height / 2 }
      const item: Furniture = {
        ...spec,
        id: `item-${++lastId}`,
        position: screenToPlan(view, centre),
        rotationDeg: 0,
      }
      set({
        furniture: [...furniture, item],
        // Selecting leaves any tool, so the new item is ready to work on
        ...selectItem(item.id),
      })
    },
    selectFurniture: (id) => {
      if (get().furniture.some((f) => f.id === id)) set(selectItem(id))
    },
    clearSelection: () => set({ selectedId: null }),
    deleteSelectedFurniture: () => {
      const { furniture, selectedId } = get()
      if (!selectedId) return
      set({
        furniture: furniture.filter((f) => f.id !== selectedId),
        selectedId: null,
      })
    },
    moveFurniture: (id, position) =>
      set({ furniture: updateItem(get().furniture, id, { position }) }),
    rotateFurniture: (id, deg) =>
      set({
        furniture: updateItem(get().furniture, id, {
          rotationDeg: snapRotation(deg, null),
        }),
      }),
    resizeFurniture: (id, widthCm, depthCm) => {
      if (!isPositive(widthCm) || !isPositive(depthCm)) return
      set({ furniture: updateItem(get().furniture, id, { widthCm, depthCm }) })
    },
    nudgeSelectedFurniture: (direction, cm) => {
      const { furniture, selectedId } = get()
      const scale = selectScale(get())
      const item = furniture.find((f) => f.id === selectedId)
      if (!item || !scale) return
      const offset = nudgeOffset(direction, cm, scale)
      get().moveFurniture(item.id, {
        x: item.position.x + offset.x,
        y: item.position.y + offset.y,
      })
    },
  }))
}

const isPositive = (n: number) => n > 0 && isFinite(n)

/** `furniture` with the item `id` changed; unchanged if there is none. */
const updateItem = (
  furniture: Furniture[],
  id: string,
  change: Partial<Furniture>,
) => furniture.map((f) => (f.id === id ? { ...f, ...change } : f))

export const planStore = createPlanStore()

/**
 * The plan's scale, or null until it is calibrated. Measuring tools stay
 * disabled while this is null.
 */
export const selectScale = (state: PlanState): Scale | null =>
  state.calibration?.scale ?? null

/**
 * Real length, in centimetres, of the measuring tape's current measurement,
 * or null when there is none.
 */
export const selectMeasuredLength = (state: PlanState): number | null => {
  const scale = selectScale(state)
  const measurement = state.tape?.measurement
  if (!scale || !measurement) return null
  return pxToCm(distance(measurement.start, measurement.end), scale)
}

/**
 * An item's size on the plan, in plan pixels (`width` along its width,
 * `height` along its depth), or null while the plan has no scale.
 */
export const selectFurnitureSizePx = (
  state: PlanState,
  item: Furniture,
): Size | null => {
  const scale = selectScale(state)
  if (!scale) return null
  return {
    width: cmToPx(item.widthCm, scale),
    height: cmToPx(item.depthCm, scale),
  }
}

export const usePlanStore = <T>(selector: (state: PlanState) => T): T =>
  useStore(planStore, selector)
