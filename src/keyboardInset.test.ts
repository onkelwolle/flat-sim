import { describe, expect, it } from 'vitest'
import { keyboardInset } from './keyboardInset'

// A phone 844 px tall (the layout viewport), whose keyboard covers 344 px
describe('keyboardInset', () => {
  it('is 0 without an on-screen keyboard', () => {
    expect(keyboardInset(844, { height: 844, offsetTop: 0, scale: 1 })).toBe(0)
  })

  it('is the height the keyboard covers at the bottom', () => {
    expect(keyboardInset(844, { height: 500, offsetTop: 0, scale: 1 })).toBe(
      344,
    )
  })

  it('measures from the visible bottom when the browser scrolled a field into view', () => {
    expect(keyboardInset(844, { height: 500, offsetTop: 100, scale: 1 })).toBe(
      244,
    )
  })

  it('ignores less than a pixel of rounding', () => {
    expect(keyboardInset(844, { height: 843.6, offsetTop: 0, scale: 1 })).toBe(
      0,
    )
  })

  it('is 0 while the page is pinch-zoomed, which is no keyboard', () => {
    expect(keyboardInset(844, { height: 422, offsetTop: 0, scale: 2 })).toBe(0)
  })
})
