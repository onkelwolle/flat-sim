import { describe, expect, it } from 'vitest'
import { createPlanStore, MAX_ZOOM, MIN_ZOOM, type Plan } from './planStore'
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
