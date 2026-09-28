import { describe, expect, it } from 'vitest'
import { pinchStep } from './pinch'

describe('pinchStep', () => {
  it('zooms by how much the fingers spread, around their midpoint', () => {
    // Fingers 100 px apart around (200, 100) move to 300 px apart
    const step = pinchStep(
      [
        { x: 150, y: 100 },
        { x: 250, y: 100 },
      ],
      [
        { x: 50, y: 100 },
        { x: 350, y: 100 },
      ],
    )

    expect(step).toEqual({
      at: { x: 200, y: 100 },
      factor: 3,
      pan: { x: 0, y: 0 },
    })
  })

  it('pans by how far the midpoint moved', () => {
    const step = pinchStep(
      [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ],
      [
        { x: 130, y: 60 },
        { x: 230, y: 160 },
      ],
    )

    expect(step).toEqual({
      at: { x: 180, y: 110 },
      factor: 1,
      pan: { x: 30, y: -40 },
    })
  })

  it('zooms out as the fingers close, whichever way round they are', () => {
    const step = pinchStep(
      [
        { x: 0, y: 0 },
        { x: 0, y: 200 },
      ],
      [
        { x: 0, y: 150 },
        { x: 0, y: 50 },
      ],
    )

    expect(step.factor).toBe(0.5)
    expect(step.at).toEqual({ x: 0, y: 100 })
  })

  it('does not zoom while the fingers were on the same spot', () => {
    const step = pinchStep(
      [
        { x: 10, y: 10 },
        { x: 10, y: 10 },
      ],
      [
        { x: 0, y: 10 },
        { x: 20, y: 10 },
      ],
    )

    expect(step.factor).toBe(1)
  })
})
