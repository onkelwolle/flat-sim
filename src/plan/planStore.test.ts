import { describe, expect, it } from 'vitest'
import { createPlanStore, MAX_ZOOM, MIN_ZOOM, type Plan } from './planStore'

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
