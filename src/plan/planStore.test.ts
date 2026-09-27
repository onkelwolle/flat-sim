import { describe, expect, it } from 'vitest'
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
  return { name, image, width, height }
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

  it('releases the image of whichever plan is discarded', () => {
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
    expect(closed(first)).toBe(true)
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
