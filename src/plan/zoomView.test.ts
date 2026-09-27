import { describe, expect, it } from 'vitest'
import { zoomView } from './zoomView'

const limits = { min: 0.25, max: 8 }

describe('zoomView', () => {
  it('scales the view by the factor', () => {
    const view = zoomView({ scale: 1, x: 0, y: 0 }, { x: 0, y: 0 }, 2, limits)
    expect(view).toEqual({ scale: 2, x: 0, y: 0 })
  })

  it('keeps the plan point under the cursor in place', () => {
    const before = { scale: 0.5, x: 100, y: 50 }
    const cursor = { x: 300, y: 250 }
    // Plan point under the cursor: ((300-100)/0.5, (250-50)/0.5) = (400, 400)

    const after = zoomView(before, cursor, 3, limits)

    expect(after.scale).toBe(1.5)
    expect(400 * after.scale + after.x).toBeCloseTo(cursor.x)
    expect(400 * after.scale + after.y).toBeCloseTo(cursor.y)
  })

  it('stops zooming in at the maximum scale', () => {
    const view = zoomView(
      { scale: 4, x: 0, y: 0 },
      { x: 100, y: 100 },
      10,
      limits,
    )
    expect(view).toEqual({ scale: 8, x: -100, y: -100 })
  })

  it('stops zooming out at the minimum scale', () => {
    const view = zoomView(
      { scale: 1, x: 0, y: 0 },
      { x: 100, y: 100 },
      0.1,
      limits,
    )
    expect(view).toEqual({ scale: 0.25, x: 75, y: 75 })
  })

  it('leaves the view unchanged when already at the limit', () => {
    const before = { scale: 8, x: -20, y: 30 }
    expect(zoomView(before, { x: 500, y: 400 }, 2, limits)).toEqual(before)
  })

  // e.g. after the viewport shrank and the limits moved past the current scale
  it('never zooms against the factor when already outside the limits', () => {
    const above = { scale: 10, x: 0, y: 0 }
    expect(zoomView(above, { x: 0, y: 0 }, 1.1, limits).scale).toBe(10)
    expect(zoomView(above, { x: 0, y: 0 }, 0.5, limits).scale).toBe(5)

    const below = { scale: 0.1, x: 0, y: 0 }
    expect(zoomView(below, { x: 0, y: 0 }, 0.9, limits).scale).toBe(0.1)
    expect(zoomView(below, { x: 0, y: 0 }, 2, limits).scale).toBe(0.2)
  })
})
