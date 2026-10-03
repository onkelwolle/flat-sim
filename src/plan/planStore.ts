import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { Size } from '../useViewportSize'
import { fitToViewport, type View } from './fitToViewport'
import { createHistory } from './history'
import {
  distance,
  nudgeOffset,
  snapRotation,
  type NudgeDirection,
} from './geometry'
import { cmToPx, pxToCm, scaleFromLine, type Scale } from './scale'
import { screenToPlan, zoomView, type Point } from './zoomView'

/**
 * Zoom limits, as multiples of the scale that fits the plan to the visible
 * part of the viewport.
 */
export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 16

/** The shortest a calibration line's ends may be dragged, in plan pixels. */
export const MIN_CALIBRATION_PX = 1

/**
 * The screen y at which controls covering the foot of the canvas begin, read
 * when the plan is fitted; undefined while nothing covers it.
 */
export type CanvasCover = () => number | undefined

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

/** Either end of the calibration line. */
export type CalibrationEnd = 'start' | 'end'

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

/** An edit to the project that can be undone, as the user would name it. */
export type Step = {
  /** What the step did, such as "move Sofa". */
  label: string
  /** The item the step touched, or null if it concerned no single item. */
  itemId: string | null
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
  /** The step undo would take back, or null if there is none. */
  nextUndo: Step | null
  /** The step redo would take again, or null if there is none. */
  nextRedo: Step | null
  /**
   * Take back the last edit to the project, selecting the item it touched.
   * With calibration points placed, only leaves the calibrate tool instead.
   */
  undo: (viewport: Size) => void
  /** Make the last undone edit again, selecting the item it touched. */
  redo: (viewport: Size) => void
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
  /**
   * Fit the whole plan to the viewport again. Every fit leaves clear what
   * covers the foot of the canvas (see `setCanvasCover`).
   */
  fitToScreen: (viewport: Size) => void
  /**
   * Set what covers the foot of the canvas (a phone's bottom bar, say), so
   * fits leave it clear; null when nothing does.
   */
  setCanvasCover: (cover: CanvasCover | null) => void
  /** Activate the calibrate tool. */
  startCalibration: () => void
  /** Place the next end of the calibration line, in plan pixels. */
  placeCalibrationPoint: (point: Point) => void
  /** Set the scale from the drawn line and its real length. */
  finishCalibration: (lengthCm: number) => void
  /** Leave the calibrate tool, keeping any earlier calibration. */
  cancelCalibration: () => void
  /**
   * Move one end of the saved calibration line to a point, in plan pixels,
   * keeping its real length: the scale follows. Ignored if the ends would
   * come within `MIN_CALIBRATION_PX` of each other.
   */
  moveCalibrationEnd: (which: CalibrationEnd, point: Point) => void
  /** Activate the measuring tape; only possible once the scale is set. */
  startMeasuring: () => void
  /** Start a new measurement at a point, in plan pixels; its end follows. */
  startMeasurementAt: (point: Point) => void
  /** Move the end of the measurement being stretched. */
  stretchMeasurementTo: (point: Point) => void
  /** Fix the end of the measurement being stretched. */
  finishMeasurementAt: (point: Point) => void
  /** Drop the measurement being stretched, if any; the tape stays active. */
  dropMeasurementInProgress: () => void
  /** Leave the measuring tape; its measurement disappears. */
  stopMeasuring: () => void
  /**
   * Add an item centred in the visible part of the view (above what covers
   * the foot of the canvas); only possible once the scale is set.
   */
  addFurniture: (spec: FurnitureSpec, viewport: Size) => void
  /** Select an item, replacing any earlier selection. */
  selectFurniture: (id: string) => void
  /** Select nothing. */
  clearSelection: () => void
  /** Remove the selected item from the plan. */
  deleteSelectedFurniture: () => void
  /** Put an item's centre at a point, in plan pixels. */
  moveFurniture: (id: string, position: Point) => void
  /** Rename an item; the name is trimmed, and ignored if that leaves it empty. */
  renameFurniture: (id: string, name: string) => void
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

/** The parts of the state that make up the project. */
export const projectOf = ({
  plan,
  calibration,
  furniture,
}: Project): Project => ({ plan, calibration, furniture })

/**
 * Whether two projects are the same. Each part is replaced on change, never
 * mutated, so comparing references tells.
 */
export const sameProject = (a: Project, b: Project) =>
  a.plan === b.plan &&
  a.calibration === b.calibration &&
  a.furniture === b.furniture

export function createPlanStore() {
  let lastId = 0
  const history = createHistory<Project, Step>()
  // Plan images the project or its history has held and not yet released
  const images = new Set<ImageBitmap>()
  let canvasCover: CanvasCover | null = null

  /**
   * The part of the viewport the plan can be seen in: above whatever covers
   * the foot of the canvas, else all of it.
   */
  const visibleArea = (viewport: Size): Size => {
    const top = canvasCover?.()
    return top ? { width: viewport.width, height: top } : viewport
  }
  /** The view fitting `plan` into the visible area. */
  const fit = (plan: Size, viewport: Size) =>
    fitToViewport(plan, visibleArea(viewport))

  return createStore<PlanState>()((set, get) => {
    /** What undo and redo would do next, for the state. */
    const nextSteps = () => ({
      nextUndo: history.nextUndo(),
      nextRedo: history.nextRedo(),
    })

    /**
     * Release every plan image neither the project nor any step refers to
     * any more; call after either changes.
     */
    const releaseImages = () => {
      const held = new Set<ImageBitmap>()
      for (const { plan } of [get(), ...history.states()]) {
        if (plan) held.add(plan.image)
      }
      for (const image of images) {
        // Released after the swap so nothing renders a closed bitmap
        if (!held.has(image)) image.close()
      }
      images.clear()
      held.forEach((image) => images.add(image))
    }

    /**
     * Apply `change` as one undoable step; runs of steps with the same
     * `mergeKey` in quick succession undo as one. A change that leaves the
     * project as it was is no step.
     */
    const edit = (
      step: Step,
      change: Partial<PlanState>,
      mergeKey?: string,
    ) => {
      const before = projectOf(get())
      set(change)
      if (sameProject(before, projectOf(get()))) return
      history.record(before, step, mergeKey)
      set(nextSteps())
      releaseImages()
    }

    /** Show `project` as undo or redo left it, after `step`. */
    const travel = (project: Project, step: Step, viewport: Size) => {
      const { plan, tape, calibrationDraft, view } = get()
      // Tools and selection exclude each other: an active tool stays
      const toolActive = tape !== null || calibrationDraft !== null
      const touched = project.furniture.some((f) => f.id === step.itemId)
      set({
        ...project,
        selectedId: touched && !toolActive ? step.itemId : null,
        // Measuring needs a scale
        tape: project.calibration ? tape : null,
        view:
          project.plan && project.plan !== plan
            ? fit(project.plan, viewport)
            : view,
        ...nextSteps(),
      })
      releaseImages()
    }

    return {
      ...blankProject,
      view: { scale: 1, x: 0, y: 0 },
      nextUndo: null,
      nextRedo: null,
      undo: (viewport) => {
        // The unfinished line goes first, as with Esc
        if (get().calibrationDraft?.length) return get().cancelCalibration()
        const entry = history.undo(projectOf(get()))
        if (entry) travel(entry.state, entry.step, viewport)
      },
      redo: (viewport) => {
        const entry = history.redo(projectOf(get()))
        if (entry) travel(entry.state, entry.step, viewport)
      },
      restoreProject: ({ plan, calibration, furniture }, viewport) => {
        const old = get()
        // New items must not reuse a restored item's id
        lastId = Math.max(0, ...furniture.map((f) => idNumber(f.id)))
        set({
          ...blankProject,
          plan,
          calibration,
          furniture,
          view: plan ? fit(plan, viewport) : old.view,
        })
        // Undo starts afresh with the restored project
        history.clear()
        set(nextSteps())
        releaseImages()
        old.pendingPlan?.image.close()
      },
      newProject: () => {
        const { pendingPlan } = get()
        lastId = 0
        set(blankProject)
        // A new project cannot be undone
        history.clear()
        set(nextSteps())
        releaseImages()
        pendingPlan?.image.close()
      },
      offerPlan: (plan, viewport) => {
        const { plan: current, pendingPlan } = get()
        if (!current) {
          set({ plan, view: fit(plan, viewport) })
          return releaseImages()
        }
        pendingPlan?.image.close()
        set({ pendingPlan: plan })
      },
      confirmReplace: (viewport) => {
        const { pendingPlan: plan } = get()
        if (!plan) return
        edit(
          { label: 'replace plan', itemId: null },
          {
            plan,
            pendingPlan: null,
            view: fit(plan, viewport),
            // A new image has its own scale
            calibration: null,
            calibrationDraft: null,
            tape: null,
            // Furniture was placed against the old image
            furniture: [],
            selectedId: null,
          },
        )
      },
      cancelReplace: () => {
        get().pendingPlan?.image.close()
        set({ pendingPlan: null })
      },
      zoomAt: (at, factor, viewport) => {
        const { plan, view } = get()
        if (!plan) return
        const fitted = fit(plan, viewport).scale
        set({
          view: zoomView(view, at, factor, {
            min: fitted * MIN_ZOOM,
            max: fitted * MAX_ZOOM,
          }),
        })
      },
      panBy: (delta) => {
        const { plan, view } = get()
        if (!plan) return
        set({ view: { ...view, x: view.x + delta.x, y: view.y + delta.y } })
      },
      setCanvasCover: (cover) => {
        canvasCover = cover
      },
      fitToScreen: (viewport) => {
        const { plan } = get()
        if (plan) set({ view: fit(plan, viewport) })
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
        edit(
          { label: 'calibrate scale', itemId: null },
          {
            calibration: {
              start,
              end,
              lengthCm,
              scale: scaleFromLine(start, end, lengthCm),
            },
            calibrationDraft: null,
          },
        )
      },
      cancelCalibration: () => set({ calibrationDraft: null }),
      moveCalibrationEnd: (which, point) => {
        const { calibration } = get()
        if (!calibration) return
        const { start, end, lengthCm }: Calibration = {
          ...calibration,
          [which]: point,
        }
        // Too short a line cannot set a scale: a drop on the other end
        // rarely lands on exactly the same point
        if (distance(start, end) < MIN_CALIBRATION_PX) return
        edit(
          { label: 'adjust calibration', itemId: null },
          {
            calibration: {
              start,
              end,
              lengthCm,
              scale: scaleFromLine(start, end, lengthCm),
            },
          },
        )
      },
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
      dropMeasurementInProgress: () => {
        if (get().tape?.stretching)
          set({ tape: { measurement: null, stretching: false } })
      },
      stopMeasuring: () => set({ tape: null }),
      addFurniture: (spec, viewport) => {
        const { furniture, view } = get()
        if (!selectScale(get())) return
        const visible = visibleArea(viewport)
        const centre = { x: visible.width / 2, y: visible.height / 2 }
        const item: Furniture = {
          ...spec,
          id: `item-${++lastId}`,
          position: screenToPlan(view, centre),
          rotationDeg: 0,
        }
        edit(
          { label: `add ${item.name}`, itemId: item.id },
          {
            furniture: [...furniture, item],
            // Selecting leaves any tool, so the new item is ready to work on
            ...selectItem(item.id),
          },
        )
      },
      selectFurniture: (id) => {
        if (get().furniture.some((f) => f.id === id)) set(selectItem(id))
      },
      clearSelection: () => set({ selectedId: null }),
      deleteSelectedFurniture: () => {
        const { furniture, selectedId } = get()
        if (!selectedId) return
        edit(itemStep('delete', furniture, selectedId), {
          furniture: furniture.filter((f) => f.id !== selectedId),
          selectedId: null,
        })
      },
      moveFurniture: (id, position) =>
        edit(itemStep('move', get().furniture, id), {
          furniture: updateItem(get().furniture, id, { position }),
        }),
      renameFurniture: (id, name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        const step = itemStep('rename', get().furniture, id)
        edit(
          { ...step, label: `${step.label} to ${trimmed}` },
          { furniture: updateItem(get().furniture, id, { name: trimmed }) },
        )
      },
      rotateFurniture: (id, deg) =>
        edit(itemStep('rotate', get().furniture, id), {
          furniture: updateItem(get().furniture, id, {
            rotationDeg: snapRotation(deg, null),
          }),
        }),
      resizeFurniture: (id, widthCm, depthCm) => {
        if (!isPositive(widthCm) || !isPositive(depthCm)) return
        edit(itemStep('resize', get().furniture, id), {
          furniture: updateItem(get().furniture, id, { widthCm, depthCm }),
        })
      },
      nudgeSelectedFurniture: (direction, cm) => {
        const { furniture, selectedId } = get()
        const scale = selectScale(get())
        const item = furniture.find((f) => f.id === selectedId)
        if (!item || !scale) return
        const offset = nudgeOffset(direction, cm, scale)
        const position = {
          x: item.position.x + offset.x,
          y: item.position.y + offset.y,
        }
        // A run of nudges to one item is one step
        edit(
          itemStep('move', furniture, item.id),
          { furniture: updateItem(furniture, item.id, { position }) },
          `nudge ${item.id}`,
        )
      },
    }
  })
}

/** A step that `verb`s the item `id`, named after it ("move Sofa"). */
const itemStep = (verb: string, furniture: Furniture[], id: string): Step => ({
  label: `${verb} ${furniture.find((f) => f.id === id)?.name ?? 'item'}`,
  itemId: id,
})

const isPositive = (n: number) => n > 0 && isFinite(n)

/** `furniture` with the item `id` changed; unchanged if there is none. */
const updateItem = (
  furniture: Furniture[],
  id: string,
  change: Partial<Furniture>,
) => {
  const item = furniture.find((f) => f.id === id)
  if (!item) return furniture
  const changed = { ...item, ...change }
  // The same array when nothing changes, so it is no step to undo
  if (JSON.stringify(changed) === JSON.stringify(item)) return furniture
  return furniture.map((f) => (f === item ? changed : f))
}

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
