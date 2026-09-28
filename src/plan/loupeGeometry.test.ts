import { describe, expect, it } from 'vitest'
import { loupeCentre, loupeView } from './loupeGeometry'

describe('loupeCentre', () => {
  it('sits 100 px above-left of the finger', () => {
    expect(loupeCentre({ x: 500, y: 400 })).toEqual({ x: 400, y: 300 })
  })

  it('flips below the finger when it would stick out past the top edge', () => {
    expect(loupeCentre({ x: 500, y: 150 })).toEqual({ x: 400, y: 250 })
  })

  it('stays above while it just fits', () => {
    expect(loupeCentre({ x: 500, y: 160 })).toEqual({ x: 400, y: 60 })
  })

  it('flips right of the finger when it would stick out past the left edge', () => {
    expect(loupeCentre({ x: 150, y: 400 })).toEqual({ x: 250, y: 300 })
  })
})

describe('loupeView', () => {
  it('shows the plan point in the loupe centre at twice the zoom', () => {
    // At 3× plan (100, 50) is 300, 150 from the plan's corner; the 120 px
    // loupe's centre is (60, 60)
    expect(loupeView({ x: 100, y: 50 }, 1.5)).toEqual({
      scale: 3,
      x: -240,
      y: -90,
    })
  })
})
