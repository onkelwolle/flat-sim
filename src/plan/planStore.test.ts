import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPlanStore,
  MAX_ZOOM,
  MIN_ZOOM,
  selectFurnitureSizePx,
  selectMeasuredLength,
  type Plan,
} from './planStore'
import type { Point } from './zoomView'

const viewport = { width: 1000, height: 800 }

const closedImages = new WeakSet<object>()

const plan = (name: string, width = 2000, height = 1000): Plan => {
  const image = {
    width,
    height,
    close() {
      closedImages.add(image)
    },
  } as ImageBitmap
  return { name, image, width, height, source: new Blob([name]) }
}

const closed = (p: Plan) => closedImages.has(p.image)

describe('plan store', () => {
  it('shows an offered plan straight away when none is loaded, fitted to the viewport', () => {
    const store = createPlanStore()

    store.getState().offerPlan(plan('flat.png'), viewport)

    expect(store.getState().plan?.name).toBe('flat.png')
    expect(store.getState().pendingPlan).toBeNull()
    expect(store.getState().view).toEqual({ scale: 0.5, x: 0, y: 150 })
  })

  it('holds a second plan pending instead of replacing the current one', () => {
    const store = createPlanStore()
    store.getState().offerPlan(plan('old.png'), viewport)

    store.getState().offerPlan(plan('new.png', 500, 2000), viewport)

    expect(store.getState().plan?.name).toBe('old.png')
    expect(store.getState().pendingPlan?.name).toBe('new.png')
    expect(store.getState().view).toEqual({ scale: 0.5, x: 0, y: 150 })
  })

  it('shows the pending plan, fitted, once the replacement is confirmed', () => {
    const store = createPlanStore()
    store.getState().offerPlan(plan('old.png'), viewport)
    store.getState().offerPlan(plan('new.png', 500, 2000), viewport)

    store.getState().confirmReplace(viewport)

    expect(store.getState().plan?.name).toBe('new.png')
    expect(store.getState().pendingPlan).toBeNull()
    expect(store.getState().view).toEqual({ scale: 0.4, x: 400, y: 0 })
  })

  it('keeps the current plan and drops the pending one when the replacement is cancelled', () => {
    const store = createPlanStore()
    store.getState().offerPlan(plan('old.png'), viewport)
    store.getState().offerPlan(plan('new.png', 500, 2000), viewport)

    store.getState().cancelReplace()

    expect(store.getState().plan?.name).toBe('old.png')
    expect(store.getState().pendingPlan).toBeNull()
    expect(store.getState().view).toEqual({ scale: 0.5, x: 0, y: 150 })
  })

  it('releases the image of a plan that is not taken, keeping a replaced one to undo to', () => {
    const store = createPlanStore()
    const first = plan('first.png')
    const second = plan('second.png')
    const third = plan('third.png')
    store.getState().offerPlan(first, viewport)

    store.getState().offerPlan(second, viewport)
    store.getState().cancelReplace()
    expect(closed(second)).toBe(true)

    store.getState().offerPlan(third, viewport)
    store.getState().confirmReplace(viewport)
    expect(closed(first)).toBe(false)
    expect(closed(third)).toBe(false)
  })
})

describe('plan view navigation', () => {
  // A 2000×1000 plan fits 1000×800 at scale 0.5, offset (0, 150)
  const loaded = () => {
    const store = createPlanStore()
    store.getState().offerPlan(plan('flat.png'), viewport)
    return store
  }

  it('zooms around a screen point', () => {
    const store = loaded()

    store.getState().zoomAt({ x: 500, y: 400 }, 2, viewport)

    expect(store.getState().view).toEqual({ scale: 1, x: -500, y: -100 })
  })

  it('clamps zoom relative to the fitted scale', () => {
    const store = loaded()

    store.getState().zoomAt({ x: 0, y: 0 }, 1000, viewport)
    expect(store.getState().view.scale).toBe(0.5 * MAX_ZOOM)

    store.getState().zoomAt({ x: 0, y: 0 }, 1 / 100000, viewport)
    expect(store.getState().view.scale).toBe(0.5 * MIN_ZOOM)
  })

  it('pans by a screen distance', () => {
    const store = loaded()

    store.getState().panBy({ x: 30, y: -20 })

    expect(store.getState().view).toEqual({ scale: 0.5, x: 30, y: 130 })
  })

  it('fits the plan to the screen again', () => {
    const store = loaded()
    store.getState().zoomAt({ x: 200, y: 300 }, 3, viewport)
    store.getState().panBy({ x: 30, y: -20 })

    store.getState().fitToScreen({ width: 500, height: 800 })

    expect(store.getState().view).toEqual({ scale: 0.25, x: 0, y: 275 })
  })

  it('ignores navigation while no plan is loaded', () => {
    const store = createPlanStore()
    const initial = store.getState().view

    store.getState().zoomAt({ x: 10, y: 10 }, 2, viewport)
    store.getState().panBy({ x: 30, y: -20 })
    store.getState().fitToScreen(viewport)

    expect(store.getState().view).toEqual(initial)
  })
})

describe('calibrating the scale', () => {
  const loaded = () => {
    const store = createPlanStore()
    store.getState().offerPlan(plan('flat.png'), viewport)
    return store
  }

  type Store = ReturnType<typeof loaded>

  const drawLine = (store: Store, start: Point, end: Point) => {
    store.getState().startCalibration()
    store.getState().placeCalibrationPoint(start)
    store.getState().placeCalibrationPoint(end)
  }

  // Calibrated at 50 px per metre
  const calibrated = () => {
    const store = loaded()
    drawLine(store, { x: 100, y: 100 }, { x: 300, y: 100 })
    store.getState().finishCalibration(400)
    return store
  }

  it('has no scale until a plan is calibrated', () => {
    expect(loaded().getState().calibration).toBeNull()
  })

  it('sets the scale from two points on the plan and their real length', () => {
    const store = loaded()

    store.getState().startCalibration()
    store.getState().placeCalibrationPoint({ x: 100, y: 100 })
    store.getState().placeCalibrationPoint({ x: 300, y: 100 })
    store.getState().finishCalibration(400)

    expect(store.getState().calibration).toEqual({
      start: { x: 100, y: 100 },
      end: { x: 300, y: 100 },
      lengthCm: 400,
      scale: { pixelsPerMetre: 50 },
    })
    expect(store.getState().calibrationDraft).toBeNull()
  })

  it('replaces the scale when the plan is calibrated again', () => {
    const store = calibrated()

    drawLine(store, { x: 0, y: 0 }, { x: 0, y: 300 })
    store.getState().finishCalibration(150)

    expect(store.getState().calibration?.scale).toEqual({ pixelsPerMetre: 200 })
    expect(store.getState().calibration?.end).toEqual({ x: 0, y: 300 })
  })

  it('keeps the current scale when re-calibrating is cancelled', () => {
    const store = calibrated()
    const before = store.getState().calibration

    drawLine(store, { x: 0, y: 0 }, { x: 0, y: 300 })
    store.getState().cancelCalibration()

    expect(store.getState().calibration).toBe(before)
    expect(store.getState().calibrationDraft).toBeNull()
  })

  it('ignores a second point on top of the first', () => {
    const store = loaded()
    store.getState().startCalibration()
    store.getState().placeCalibrationPoint({ x: 100, y: 100 })

    store.getState().placeCalibrationPoint({ x: 100, y: 100 })

    expect(store.getState().calibrationDraft).toEqual([{ x: 100, y: 100 }])
  })

  it('ignores clicks once both ends of the line are placed', () => {
    const store = loaded()
    drawLine(store, { x: 100, y: 100 }, { x: 300, y: 100 })

    store.getState().placeCalibrationPoint({ x: 500, y: 500 })

    expect(store.getState().calibrationDraft).toEqual([
      { x: 100, y: 100 },
      { x: 300, y: 100 },
    ])
  })

  it('does not set the scale before both ends are placed or from a non-positive length', () => {
    const store = loaded()
    store.getState().startCalibration()
    store.getState().placeCalibrationPoint({ x: 100, y: 100 })
    store.getState().finishCalibration(400)
    expect(store.getState().calibration).toBeNull()

    store.getState().placeCalibrationPoint({ x: 300, y: 100 })
    store.getState().finishCalibration(0)
    store.getState().finishCalibration(-5)
    store.getState().finishCalibration(NaN)
    expect(store.getState().calibration).toBeNull()
    expect(store.getState().calibrationDraft).toHaveLength(2)
  })

  it('drops the scale when the plan is replaced, but not when replacing is cancelled', () => {
    const store = calibrated()
    store.getState().offerPlan(plan('other.png'), viewport)
    store.getState().cancelReplace()
    expect(store.getState().calibration).not.toBeNull()

    store.getState().startCalibration()
    store.getState().placeCalibrationPoint({ x: 10, y: 10 })
    store.getState().offerPlan(plan('other.png'), viewport)
    store.getState().confirmReplace(viewport)

    expect(store.getState().calibration).toBeNull()
    expect(store.getState().calibrationDraft).toBeNull()
  })

  it('moving an end of the line keeps its real length and rescales', () => {
    const store = calibrated()

    // 400 px now stand for the same 4 m
    store.getState().moveCalibrationEnd('end', { x: 500, y: 100 })

    expect(store.getState().calibration).toEqual({
      start: { x: 100, y: 100 },
      end: { x: 500, y: 100 },
      lengthCm: 400,
      scale: { pixelsPerMetre: 100 },
    })
  })

  it('undoes moving an end of the line as one step, back to the old scale', () => {
    const store = calibrated()
    store.getState().moveCalibrationEnd('end', { x: 500, y: 100 })
    expect(store.getState().nextUndo?.label).toBe('adjust calibration')

    store.getState().undo(viewport)

    expect(store.getState().calibration?.end).toEqual({ x: 300, y: 100 })
    expect(store.getState().calibration?.scale).toEqual({ pixelsPerMetre: 50 })
  })

  it('ignores moving an end of the line onto the other, or nearly', () => {
    const store = calibrated()
    const before = store.getState().calibration

    store.getState().moveCalibrationEnd('start', { x: 300, y: 100 })
    store.getState().moveCalibrationEnd('start', { x: 300.5, y: 100.5 })

    expect(store.getState().calibration).toBe(before)
    expect(store.getState().nextUndo?.label).toBe('calibrate scale')
  })

  it('cannot calibrate while no plan is loaded', () => {
    const store = createPlanStore()

    store.getState().startCalibration()

    expect(store.getState().calibrationDraft).toBeNull()
  })
})

describe('measuring with the tape', () => {
  // Calibrated at 50 px per metre
  const calibrated = () => {
    const store = createPlanStore()
    store.getState().offerPlan(plan('flat.png'), viewport)
    store.getState().startCalibration()
    store.getState().placeCalibrationPoint({ x: 100, y: 100 })
    store.getState().placeCalibrationPoint({ x: 300, y: 100 })
    store.getState().finishCalibration(400)
    return store
  }

  const measured = (store: ReturnType<typeof calibrated>) =>
    selectMeasuredLength(store.getState())

  it('measures the real distance between two points on the plan', () => {
    const store = calibrated()

    store.getState().startMeasuring()
    store.getState().startMeasurementAt({ x: 100, y: 100 })
    store.getState().finishMeasurementAt({ x: 250, y: 300 })

    // 250 px at 50 px per metre
    expect(measured(store)).toBe(500)
    expect(store.getState().tape?.measurement).toEqual({
      start: { x: 100, y: 100 },
      end: { x: 250, y: 300 },
    })
  })

  it('shows the distance live while the end follows the pointer', () => {
    const store = calibrated()
    store.getState().startMeasuring()
    store.getState().startMeasurementAt({ x: 100, y: 100 })

    store.getState().stretchMeasurementTo({ x: 100, y: 125 })
    expect(measured(store)).toBe(50)

    store.getState().stretchMeasurementTo({ x: 100, y: 150 })
    expect(measured(store)).toBe(100)
    expect(store.getState().tape?.stretching).toBe(true)
  })

  it('keeps a finished measurement until the next one starts', () => {
    const store = calibrated()
    store.getState().startMeasuring()
    store.getState().startMeasurementAt({ x: 100, y: 100 })
    store.getState().finishMeasurementAt({ x: 200, y: 100 })

    store.getState().stretchMeasurementTo({ x: 400, y: 100 })
    expect(measured(store)).toBe(200)

    store.getState().startMeasurementAt({ x: 0, y: 0 })
    expect(store.getState().tape?.measurement).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 0, y: 0 },
    })
  })

  it('does not finish a measurement on top of its start', () => {
    const store = calibrated()
    store.getState().startMeasuring()
    store.getState().startMeasurementAt({ x: 100, y: 100 })

    store.getState().finishMeasurementAt({ x: 100, y: 100 })

    expect(store.getState().tape?.stretching).toBe(true)
  })

  it('drops the measurement when the tape is left', () => {
    const store = calibrated()
    store.getState().startMeasuring()
    store.getState().startMeasurementAt({ x: 100, y: 100 })
    store.getState().finishMeasurementAt({ x: 200, y: 100 })

    store.getState().stopMeasuring()

    expect(store.getState().tape).toBeNull()
    expect(measured(store)).toBeNull()

    store.getState().startMeasuring()
    expect(store.getState().tape?.measurement).toBeNull()
  })

  it('drops a measurement being drawn but keeps the tape active', () => {
    const store = calibrated()
    store.getState().startMeasuring()
    store.getState().startMeasurementAt({ x: 100, y: 100 })
    store.getState().stretchMeasurementTo({ x: 200, y: 100 })

    store.getState().dropMeasurementInProgress()

    expect(store.getState().tape).toEqual({
      measurement: null,
      stretching: false,
    })
  })

  it('keeps a finished measurement when none is being drawn', () => {
    const store = calibrated()
    store.getState().startMeasuring()
    store.getState().startMeasurementAt({ x: 100, y: 100 })
    store.getState().finishMeasurementAt({ x: 200, y: 100 })

    store.getState().dropMeasurementInProgress()

    expect(measured(store)).toBe(200)
  })

  it('cannot measure until the scale is set', () => {
    const store = createPlanStore()
    store.getState().offerPlan(plan('flat.png'), viewport)

    store.getState().startMeasuring()

    expect(store.getState().tape).toBeNull()
  })

  it('leaves the calibrate tool when measuring starts, and the other way round', () => {
    const store = calibrated()
    store.getState().startCalibration()
    store.getState().placeCalibrationPoint({ x: 10, y: 10 })

    store.getState().startMeasuring()
    expect(store.getState().calibrationDraft).toBeNull()
    expect(store.getState().tape).not.toBeNull()

    store.getState().startCalibration()
    expect(store.getState().tape).toBeNull()
    expect(store.getState().calibrationDraft).toEqual([])
  })

  it('leaves the tape when the plan is replaced', () => {
    const store = calibrated()
    store.getState().startMeasuring()
    store.getState().startMeasurementAt({ x: 100, y: 100 })

    store.getState().offerPlan(plan('other.png'), viewport)
    store.getState().confirmReplace(viewport)

    expect(store.getState().tape).toBeNull()
  })
})

describe('furniture', () => {
  // A 2000×1000 plan fitted to 1000×800: scale 0.5 at y = 150, so the view's
  // centre (500, 400) is plan (1000, 500). Calibrated at 50 px per metre.
  const calibrated = () => {
    const store = createPlanStore()
    store.getState().offerPlan(plan('flat.png'), viewport)
    store.getState().startCalibration()
    store.getState().placeCalibrationPoint({ x: 100, y: 100 })
    store.getState().placeCalibrationPoint({ x: 300, y: 100 })
    store.getState().finishCalibration(400)
    return store
  }

  type Store = ReturnType<typeof calibrated>

  const sofa = { name: 'Sofa', widthCm: 200, depthCm: 90 }

  it('adds an item centred in the view, sized in cm and unrotated', () => {
    const store = calibrated()

    store.getState().addFurniture(sofa, viewport)

    expect(store.getState().furniture).toEqual([
      {
        id: expect.any(String),
        name: 'Sofa',
        widthCm: 200,
        depthCm: 90,
        position: { x: 1000, y: 500 },
        rotationDeg: 0,
      },
    ])
  })

  const onlyItem = (store: Store) => store.getState().furniture[0]!

  it('draws an item to scale, and re-calibrating keeps its real size', () => {
    const store = calibrated()
    store.getState().addFurniture(sofa, viewport)

    // 200 × 90 cm at 50 px per metre
    expect(selectFurnitureSizePx(store.getState(), onlyItem(store))).toEqual({
      width: 100,
      height: 45,
    })

    // Same line, now 2 m long: 100 px per metre
    store.getState().startCalibration()
    store.getState().placeCalibrationPoint({ x: 100, y: 100 })
    store.getState().placeCalibrationPoint({ x: 300, y: 100 })
    store.getState().finishCalibration(200)

    expect(onlyItem(store)).toMatchObject({ widthCm: 200, depthCm: 90 })
    expect(selectFurnitureSizePx(store.getState(), onlyItem(store))).toEqual({
      width: 200,
      height: 90,
    })
  })

  it('cannot add furniture until the scale is set', () => {
    const store = createPlanStore()
    store.getState().offerPlan(plan('flat.png'), viewport)

    store.getState().addFurniture(sofa, viewport)

    expect(store.getState().furniture).toEqual([])
  })

  const ids = (store: Store) => store.getState().furniture.map((f) => f.id)

  it('selects a newly added item', () => {
    const store = calibrated()
    store.getState().addFurniture(sofa, viewport)
    store.getState().addFurniture({ ...sofa, name: 'Bed' }, viewport)

    const [, bed] = ids(store)
    expect(store.getState().selectedId).toBe(bed)
  })

  it('selects one item at a time, and clears the selection', () => {
    const store = calibrated()
    store.getState().addFurniture(sofa, viewport)
    store.getState().addFurniture({ ...sofa, name: 'Bed' }, viewport)
    const [sofaId] = ids(store)

    store.getState().selectFurniture(sofaId!)
    expect(store.getState().selectedId).toBe(sofaId)

    store.getState().clearSelection()
    expect(store.getState().selectedId).toBeNull()
  })

  it('ignores selecting an item that is not on the plan', () => {
    const store = calibrated()

    store.getState().selectFurniture('nope')

    expect(store.getState().selectedId).toBeNull()
  })

  it('deletes the selected item, leaving nothing selected', () => {
    const store = calibrated()
    store.getState().addFurniture(sofa, viewport)
    store.getState().addFurniture({ ...sofa, name: 'Bed' }, viewport)
    const [sofaId, bedId] = ids(store)
    store.getState().selectFurniture(sofaId!)

    store.getState().deleteSelectedFurniture()

    expect(ids(store)).toEqual([bedId])
    expect(store.getState().selectedId).toBeNull()
  })

  it('deletes nothing while nothing is selected', () => {
    const store = calibrated()
    store.getState().addFurniture(sofa, viewport)
    store.getState().clearSelection()

    store.getState().deleteSelectedFurniture()

    expect(store.getState().furniture).toHaveLength(1)
  })

  it('clears the selection when a tool starts', () => {
    const store = calibrated()
    store.getState().addFurniture(sofa, viewport)

    store.getState().startMeasuring()
    expect(store.getState().selectedId).toBeNull()

    store.getState().selectFurniture(ids(store)[0]!)
    store.getState().startCalibration()
    expect(store.getState().selectedId).toBeNull()
  })

  it('leaves the active tool when an item is added or selected', () => {
    const store = calibrated()
    store.getState().startMeasuring()
    store.getState().addFurniture(sofa, viewport)
    expect(store.getState().tape).toBeNull()

    store.getState().startCalibration()
    store.getState().selectFurniture(ids(store)[0]!)
    expect(store.getState().calibrationDraft).toBeNull()
  })

  it('moves an item to a new centre', () => {
    const store = calibrated()
    store.getState().addFurniture(sofa, viewport)

    store.getState().moveFurniture(onlyItem(store).id, { x: 1200, y: 640 })

    expect(onlyItem(store).position).toEqual({ x: 1200, y: 640 })
  })

  it('rotates an item clockwise, keeping the angle within 0–360°', () => {
    const store = calibrated()
    store.getState().addFurniture(sofa, viewport)
    const { id } = onlyItem(store)

    store.getState().rotateFurniture(id, 45)
    expect(onlyItem(store).rotationDeg).toBe(45)

    store.getState().rotateFurniture(id, -30)
    expect(onlyItem(store).rotationDeg).toBe(330)
  })

  it('renames an item, trimming the name', () => {
    const store = calibrated()
    store.getState().addFurniture(sofa, viewport)

    store.getState().renameFurniture(onlyItem(store).id, '  Couch ')

    expect(onlyItem(store).name).toBe('Couch')
  })

  it('ignores an empty name', () => {
    const store = calibrated()
    store.getState().addFurniture(sofa, viewport)
    const { id } = onlyItem(store)

    store.getState().renameFurniture(id, '')
    store.getState().renameFurniture(id, '   ')

    expect(onlyItem(store).name).toBe('Sofa')
  })

  it('resizes an item in cm, redrawing it to scale around the same centre', () => {
    const store = calibrated()
    store.getState().addFurniture(sofa, viewport)

    store.getState().resizeFurniture(onlyItem(store).id, 240, 100)

    expect(onlyItem(store)).toMatchObject({
      widthCm: 240,
      depthCm: 100,
      position: { x: 1000, y: 500 },
    })
    expect(selectFurnitureSizePx(store.getState(), onlyItem(store))).toEqual({
      width: 120,
      height: 50,
    })
  })

  it('ignores a size that is not greater than zero', () => {
    const store = calibrated()
    store.getState().addFurniture(sofa, viewport)
    const { id } = onlyItem(store)

    store.getState().resizeFurniture(id, 0, 100)
    store.getState().resizeFurniture(id, 100, -5)
    store.getState().resizeFurniture(id, NaN, 100)

    expect(onlyItem(store)).toMatchObject({ widthCm: 200, depthCm: 90 })
  })

  it('nudges the selected item by a real distance', () => {
    const store = calibrated()
    store.getState().addFurniture(sofa, viewport)

    // 50 px per metre: 10 cm is 5 plan px, 1 cm half a plan px
    store.getState().nudgeSelectedFurniture('right', 10)
    store.getState().nudgeSelectedFurniture('up', 1)

    expect(onlyItem(store).position).toEqual({ x: 1005, y: 499.5 })
  })

  it('nudges nothing while nothing is selected', () => {
    const store = calibrated()
    store.getState().addFurniture(sofa, viewport)
    store.getState().clearSelection()

    store.getState().nudgeSelectedFurniture('left', 10)

    expect(onlyItem(store).position).toEqual({ x: 1000, y: 500 })
  })

  it('drops all furniture when the plan is replaced, but not when replacing is cancelled', () => {
    const store = calibrated()
    store.getState().addFurniture(sofa, viewport)

    store.getState().offerPlan(plan('other.png'), viewport)
    store.getState().cancelReplace()
    expect(store.getState().furniture).toHaveLength(1)
    expect(store.getState().selectedId).not.toBeNull()

    store.getState().offerPlan(plan('other.png'), viewport)
    store.getState().confirmReplace(viewport)
    expect(store.getState().furniture).toEqual([])
    expect(store.getState().selectedId).toBeNull()
  })
})

describe('projects', () => {
  const calibration = {
    start: { x: 100, y: 100 },
    end: { x: 300, y: 100 },
    lengthCm: 400,
    scale: { pixelsPerMetre: 50 },
  }
  const item = (id: string) => ({
    id,
    name: 'Sofa',
    widthCm: 200,
    depthCm: 90,
    position: { x: 400, y: 300 },
    rotationDeg: 45,
  })

  it('restores a saved plan, calibration and furniture, fitted to the viewport', () => {
    const store = createPlanStore()

    store.getState().restoreProject(
      {
        plan: plan('flat.png'),
        calibration,
        furniture: [item('item-1'), item('item-7')],
      },
      viewport,
    )

    const state = store.getState()
    expect(state.plan?.name).toBe('flat.png')
    expect(state.calibration).toEqual(calibration)
    expect(state.furniture.map((f) => f.id)).toEqual(['item-1', 'item-7'])
    expect(state.furniture[0]).toEqual(item('item-1'))
    expect(state.view).toEqual({ scale: 0.5, x: 0, y: 150 })
    expect(state.selectedId).toBeNull()
  })

  it('gives items added after a restore ids that no restored item has', () => {
    const store = createPlanStore()
    store.getState().restoreProject(
      {
        plan: plan('flat.png'),
        calibration,
        furniture: [item('item-7'), item('item-2')],
      },
      viewport,
    )

    store
      .getState()
      .addFurniture({ name: 'Bed', widthCm: 140, depthCm: 200 }, viewport)

    expect(store.getState().furniture.map((f) => f.id)).toEqual([
      'item-7',
      'item-2',
      'item-8',
    ])
  })

  it('starts a new project with nothing on it, releasing the images', () => {
    const store = createPlanStore()
    const current = plan('flat.png')
    const pending = plan('next.png')
    store
      .getState()
      .restoreProject(
        { plan: current, calibration, furniture: [item('item-3')] },
        viewport,
      )
    store.getState().selectFurniture('item-3')
    store.getState().offerPlan(pending, viewport)

    store.getState().newProject()

    const state = store.getState()
    expect(state.plan).toBeNull()
    expect(state.pendingPlan).toBeNull()
    expect(state.calibration).toBeNull()
    expect(state.furniture).toEqual([])
    expect(state.selectedId).toBeNull()
    expect(closed(current)).toBe(true)
    expect(closed(pending)).toBe(true)
  })

  it('numbers items from the start again in a new project', () => {
    const store = createPlanStore()
    store
      .getState()
      .restoreProject(
        { plan: plan('flat.png'), calibration, furniture: [item('item-3')] },
        viewport,
      )
    store.getState().newProject()
    store.getState().offerPlan(plan('flat.png'), viewport)
    store.getState().startCalibration()
    store.getState().placeCalibrationPoint({ x: 100, y: 100 })
    store.getState().placeCalibrationPoint({ x: 300, y: 100 })
    store.getState().finishCalibration(400)

    store
      .getState()
      .addFurniture({ name: 'Bed', widthCm: 140, depthCm: 200 }, viewport)

    expect(store.getState().furniture[0]?.id).toBe('item-1')
  })
})

describe('undo and redo', () => {
  // A calibrated 2000×1000 plan at 50 px per metre, with a sofa at (1000, 500)
  const withSofa = () => {
    const store = createPlanStore()
    store.getState().offerPlan(plan('flat.png'), viewport)
    store.getState().startCalibration()
    store.getState().placeCalibrationPoint({ x: 100, y: 100 })
    store.getState().placeCalibrationPoint({ x: 300, y: 100 })
    store.getState().finishCalibration(400)
    store
      .getState()
      .addFurniture({ name: 'Sofa', widthCm: 200, depthCm: 90 }, viewport)
    return store
  }
  type Store = ReturnType<typeof withSofa>
  const sofa = (store: Store) => store.getState().furniture[0]!
  const projectOf = (store: Store) => {
    const { plan, calibration, furniture } = store.getState()
    return { plan, calibration, furniture }
  }

  it('undoes a move, selecting the moved item, and redoes it', () => {
    const store = withSofa()
    store.getState().moveFurniture(sofa(store).id, { x: 10, y: 20 })
    store.getState().clearSelection()

    store.getState().undo(viewport)

    expect(sofa(store).position).toEqual({ x: 1000, y: 500 })
    expect(store.getState().selectedId).toBe(sofa(store).id)

    store.getState().clearSelection()
    store.getState().redo(viewport)

    expect(sofa(store).position).toEqual({ x: 10, y: 20 })
    expect(store.getState().selectedId).toBe(sofa(store).id)
  })

  it('names the steps undo and redo would take', () => {
    const store = withSofa()
    expect(store.getState().nextUndo?.label).toBe('add Sofa')
    expect(store.getState().nextRedo).toBeNull()

    store.getState().moveFurniture(sofa(store).id, { x: 10, y: 20 })
    expect(store.getState().nextUndo?.label).toBe('move Sofa')

    store.getState().undo(viewport)
    expect(store.getState().nextUndo?.label).toBe('add Sofa')
    expect(store.getState().nextRedo?.label).toBe('move Sofa')
  })

  it('makes no step of an edit that changes nothing', () => {
    const store = withSofa()
    const { id } = sofa(store)

    store.getState().moveFurniture(id, { x: 1000, y: 500 })
    store.getState().rotateFurniture(id, 360)
    store.getState().renameFurniture(id, ' Sofa ')
    store.getState().resizeFurniture(id, 200, 90)

    expect(store.getState().nextUndo?.label).toBe('add Sofa')
  })

  it('undoes adding an item, selecting nothing, and redoes it, selecting it', () => {
    const store = withSofa()

    store.getState().undo(viewport)

    expect(store.getState().furniture).toEqual([])
    expect(store.getState().selectedId).toBeNull()

    store.getState().redo(viewport)

    expect(store.getState().furniture).toHaveLength(1)
    expect(store.getState().selectedId).toBe(sofa(store).id)
  })

  it('undoes deleting an item, selecting it, and redoes it, selecting nothing', () => {
    const store = withSofa()
    const before = sofa(store)
    store.getState().deleteSelectedFurniture()
    expect(store.getState().nextUndo?.label).toBe('delete Sofa')

    store.getState().undo(viewport)

    expect(store.getState().furniture).toEqual([before])
    expect(store.getState().selectedId).toBe(before.id)

    store.getState().redo(viewport)

    expect(store.getState().furniture).toEqual([])
    expect(store.getState().selectedId).toBeNull()
  })

  it('undoes renaming, resizing and rotating an item one edit at a time', () => {
    const store = withSofa()
    const { id } = sofa(store)
    store.getState().renameFurniture(id, 'Couch')
    store.getState().resizeFurniture(id, 220, 95)
    store.getState().rotateFurniture(id, 90)

    expect(store.getState().nextUndo?.label).toBe('rotate Couch')
    store.getState().undo(viewport)
    expect(sofa(store)).toMatchObject({ name: 'Couch', widthCm: 220 })
    expect(sofa(store).rotationDeg).toBe(0)

    expect(store.getState().nextUndo?.label).toBe('resize Couch')
    store.getState().undo(viewport)
    expect(sofa(store)).toMatchObject({ widthCm: 200, depthCm: 90 })

    expect(store.getState().nextUndo?.label).toBe('rename Sofa to Couch')
    store.getState().undo(viewport)
    expect(sofa(store).name).toBe('Sofa')
  })

  describe('nudging', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('undoes a run of nudges as one step', () => {
      const store = withSofa()
      store.getState().nudgeSelectedFurniture('right', 10)
      vi.advanceTimersByTime(500)
      store.getState().nudgeSelectedFurniture('right', 10)
      vi.advanceTimersByTime(500)
      store.getState().nudgeSelectedFurniture('down', 10)

      store.getState().undo(viewport)

      expect(sofa(store).position).toEqual({ x: 1000, y: 500 })
      expect(store.getState().nextUndo?.label).toBe('add Sofa')
    })

    it('ends a run of nudges after a pause or another edit', () => {
      const store = withSofa()
      const { id } = sofa(store)
      store.getState().nudgeSelectedFurniture('right', 10)
      vi.advanceTimersByTime(1500)
      store.getState().nudgeSelectedFurniture('right', 10)
      store.getState().rotateFurniture(id, 90)
      store.getState().nudgeSelectedFurniture('right', 10)

      store.getState().undo(viewport)
      expect(sofa(store).position).toEqual({ x: 1010, y: 500 })
      store.getState().undo(viewport)
      store.getState().undo(viewport)
      expect(sofa(store).position).toEqual({ x: 1005, y: 500 })
    })
  })

  const recalibrate = (store: Store, lengthCm: number) => {
    store.getState().startCalibration()
    store.getState().placeCalibrationPoint({ x: 100, y: 100 })
    store.getState().placeCalibrationPoint({ x: 300, y: 100 })
    store.getState().finishCalibration(lengthCm)
  }

  it('undoes a calibration, selecting nothing', () => {
    const store = withSofa()
    recalibrate(store, 200)
    expect(store.getState().nextUndo?.label).toBe('calibrate scale')

    store.getState().undo(viewport)

    expect(store.getState().calibration?.lengthCm).toBe(400)
    expect(store.getState().selectedId).toBeNull()

    store.getState().redo(viewport)

    expect(store.getState().calibration?.lengthCm).toBe(200)
  })

  it('drops only the unfinished calibration line while points are placed', () => {
    const store = withSofa()
    store.getState().startCalibration()
    store.getState().placeCalibrationPoint({ x: 100, y: 100 })

    store.getState().undo(viewport)

    expect(store.getState().calibrationDraft).toBeNull()
    expect(store.getState().furniture).toHaveLength(1)
    expect(store.getState().nextUndo?.label).toBe('add Sofa')
  })

  it('keeps the measuring tape and its measurement through undo and redo', () => {
    const store = withSofa()
    store.getState().moveFurniture(sofa(store).id, { x: 10, y: 20 })
    store.getState().startMeasuring()
    store.getState().startMeasurementAt({ x: 0, y: 0 })
    store.getState().finishMeasurementAt({ x: 100, y: 0 })
    const { tape } = store.getState()

    store.getState().undo(viewport)
    store.getState().redo(viewport)

    expect(sofa(store).position).toEqual({ x: 10, y: 20 })
    expect(store.getState().tape).toEqual(tape)
    expect(store.getState().selectedId).toBeNull()
  })

  it('closes the measuring tape when undo removes the scale', () => {
    const store = createPlanStore()
    store.getState().offerPlan(plan('flat.png'), viewport)
    store.getState().startCalibration()
    store.getState().placeCalibrationPoint({ x: 100, y: 100 })
    store.getState().placeCalibrationPoint({ x: 300, y: 100 })
    store.getState().finishCalibration(400)
    store.getState().startMeasuring()

    store.getState().undo(viewport)

    expect(store.getState().calibration).toBeNull()
    expect(store.getState().tape).toBeNull()
  })

  const replacePlan = (store: Store, next: Plan) => {
    store.getState().offerPlan(next, viewport)
    store.getState().confirmReplace(viewport)
  }

  it('undoes replacing the plan, bringing back its scale and furniture, fitted', () => {
    const store = withSofa()
    const old = store.getState().plan!
    const before = projectOf(store)
    replacePlan(store, plan('tall.png', 500, 2000))
    expect(store.getState().nextUndo?.label).toBe('replace plan')

    store.getState().undo(viewport)

    expect(projectOf(store)).toEqual(before)
    expect(closed(old)).toBe(false)
    expect(store.getState().selectedId).toBeNull()
    expect(store.getState().view).toEqual({ scale: 0.5, x: 0, y: 150 })

    store.getState().redo(viewport)

    expect(store.getState().plan?.name).toBe('tall.png')
    expect(store.getState().furniture).toEqual([])
    expect(store.getState().view).toEqual({ scale: 0.4, x: 400, y: 0 })
  })

  it('releases a replaced plan image once no step can bring it back', () => {
    const store = withSofa()
    const old = store.getState().plan!
    const replacement = plan('new.png')
    replacePlan(store, replacement)
    store.getState().undo(viewport)

    // A new edit drops the replacement from redo
    store.getState().moveFurniture(sofa(store).id, { x: 10, y: 20 })

    expect(closed(replacement)).toBe(true)
    expect(closed(old)).toBe(false)
  })

  it('releases the oldest plan image once its step drops out of the history', () => {
    const store = withSofa()
    const first = store.getState().plan!
    // Calibrating, adding the sofa and replacing the plan leave 3 steps that
    // can bring back the first plan; the history keeps 100
    for (let i = 0; i < 99; i++) replacePlan(store, plan(`plan-${i}.png`))
    expect(closed(first)).toBe(false)

    replacePlan(store, plan('last.png'))
    expect(closed(first)).toBe(false)
    replacePlan(store, plan('one-more.png'))
    expect(closed(first)).toBe(true)
  })

  it('starts a new project with no history, releasing every image in it', () => {
    const store = withSofa()
    const old = store.getState().plan!
    replacePlan(store, plan('new.png'))

    store.getState().newProject()

    expect(store.getState().nextUndo).toBeNull()
    expect(store.getState().nextRedo).toBeNull()
    expect(closed(old)).toBe(true)
  })

  it('starts a restored project with no history', () => {
    const store = withSofa()
    const old = store.getState().plan!
    replacePlan(store, plan('new.png'))
    store.getState().undo(viewport)

    store
      .getState()
      .restoreProject(
        { plan: plan('saved.png'), calibration: null, furniture: [] },
        viewport,
      )

    expect(store.getState().nextUndo).toBeNull()
    expect(store.getState().nextRedo).toBeNull()
    expect(closed(old)).toBe(true)
  })
})

describe('controls covering the foot of the canvas', () => {
  // The bottom 200 px of the 1000×800 viewport are covered: the plan fits
  // the 1000×600 above, at 0.5× with its top at y = 50
  const covered = () => {
    const store = createPlanStore()
    store.getState().setCanvasCover(() => 600)
    return store
  }

  it('fits an offered plan above them', () => {
    const store = covered()

    store.getState().offerPlan(plan('flat.png'), viewport)

    expect(store.getState().view).toEqual({ scale: 0.5, x: 0, y: 50 })
  })

  it('fits a replacing plan above them', () => {
    const store = covered()
    store.getState().offerPlan(plan('old.png', 100, 100), viewport)
    store.getState().offerPlan(plan('new.png'), viewport)

    store.getState().confirmReplace(viewport)

    expect(store.getState().view).toEqual({ scale: 0.5, x: 0, y: 50 })
  })

  it('fits a restored plan above them', () => {
    const store = covered()

    store
      .getState()
      .restoreProject(
        { plan: plan('saved.png'), calibration: null, furniture: [] },
        viewport,
      )

    expect(store.getState().view).toEqual({ scale: 0.5, x: 0, y: 50 })
  })

  it('fits the plan undo or redo brings back above them', () => {
    const store = covered()
    store.getState().offerPlan(plan('old.png'), viewport)
    store.getState().offerPlan(plan('new.png', 100, 100), viewport)
    store.getState().confirmReplace(viewport)

    store.getState().undo(viewport)
    expect(store.getState().view).toEqual({ scale: 0.5, x: 0, y: 50 })

    store.getState().redo(viewport)
    // 100×100 fits the 1000×600 at 6×, centred
    expect(store.getState().view).toEqual({ scale: 6, x: 200, y: 0 })
  })

  it('fits the plan to the screen above them', () => {
    const store = covered()
    store.getState().offerPlan(plan('flat.png'), viewport)
    store.getState().panBy({ x: 30, y: -20 })

    store.getState().fitToScreen(viewport)

    expect(store.getState().view).toEqual({ scale: 0.5, x: 0, y: 50 })
  })

  it('limits zoom relative to the scale fitting the plan above them', () => {
    const store = covered()
    // 2000×2000 fits the 1000×600 at 0.3× (the whole viewport at 0.4×)
    store.getState().offerPlan(plan('square.png', 2000, 2000), viewport)

    store.getState().zoomAt({ x: 0, y: 0 }, 1 / 100000, viewport)
    expect(store.getState().view.scale).toBeCloseTo(0.3 * MIN_ZOOM)

    store.getState().zoomAt({ x: 0, y: 0 }, 100000, viewport)
    expect(store.getState().view.scale).toBeCloseTo(0.3 * MAX_ZOOM)
  })

  it('fits to the whole viewport again once nothing covers it', () => {
    const store = covered()
    store.getState().setCanvasCover(() => undefined)

    store.getState().offerPlan(plan('flat.png'), viewport)

    expect(store.getState().view).toEqual({ scale: 0.5, x: 0, y: 150 })
  })

  it('adds an item centred in the part of the view above them', () => {
    const store = covered()
    store.getState().offerPlan(plan('flat.png'), viewport)
    store.getState().startCalibration()
    store.getState().placeCalibrationPoint({ x: 100, y: 100 })
    store.getState().placeCalibrationPoint({ x: 300, y: 100 })
    store.getState().finishCalibration(400)

    store
      .getState()
      .addFurniture({ name: 'Sofa', widthCm: 200, depthCm: 90 }, viewport)

    // The centre of the 1000×600 above, (500, 300), is plan (1000, 500);
    // the whole viewport's centre would be plan (1000, 700)
    expect(store.getState().furniture[0]!.position).toEqual({
      x: 1000,
      y: 500,
    })
  })

  it('adds an item centred in the part of the view left once it is selected', () => {
    const store = createPlanStore()
    // Selecting an item covers more: a sheet over the bottom 400 px
    store
      .getState()
      .setCanvasCover(() => (store.getState().selectedId ? 400 : 600))
    store.getState().offerPlan(plan('flat.png'), viewport)
    store.getState().startCalibration()
    store.getState().placeCalibrationPoint({ x: 100, y: 100 })
    store.getState().placeCalibrationPoint({ x: 300, y: 100 })
    store.getState().finishCalibration(400)

    store
      .getState()
      .addFurniture({ name: 'Sofa', widthCm: 200, depthCm: 90 }, viewport)

    // The centre of the 1000×400 left, (500, 200), is plan (1000, 300)
    expect(store.getState().furniture[0]!.position).toEqual({
      x: 1000,
      y: 300,
    })
    // Still one step: undo takes the item away
    store.getState().undo(viewport)
    expect(store.getState().furniture).toEqual([])
  })
})
