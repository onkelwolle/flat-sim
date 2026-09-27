import { describe, expect, it } from 'vitest'
import { createPlanStore, type Plan } from './planStore'

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
