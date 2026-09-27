import { describe, expect, it } from 'vitest'
import { fitToViewport } from './fitToViewport'

describe('fitToViewport', () => {
  it('scales a wide plan down to the viewport width and centres it vertically', () => {
    const view = fitToViewport(
      { width: 2000, height: 1000 },
      { width: 1000, height: 800 },
    )
    expect(view).toEqual({ scale: 0.5, x: 0, y: 150 })
  })

  it('scales a tall plan to the viewport height and centres it horizontally', () => {
    const view = fitToViewport(
      { width: 500, height: 2000 },
      { width: 1000, height: 800 },
    )
    expect(view).toEqual({ scale: 0.4, x: 400, y: 0 })
  })

  it('enlarges a plan smaller than the viewport', () => {
    const view = fitToViewport(
      { width: 250, height: 100 },
      { width: 1000, height: 800 },
    )
    expect(view).toEqual({ scale: 4, x: 0, y: 200 })
  })
})
