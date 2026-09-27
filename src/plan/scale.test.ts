import { describe, expect, it } from 'vitest'
import {
  cmToPx,
  formatLength,
  parseLength,
  pxToCm,
  scaleFromLine,
} from './scale'

describe('scaleFromLine', () => {
  it('derives plan pixels per metre from a line of known length', () => {
    // 3-4-5 triangle: the line is 500 px long and stands for 2.5 m
    const scale = scaleFromLine({ x: 10, y: 20 }, { x: 310, y: 420 }, 250)
    expect(scale).toEqual({ pixelsPerMetre: 200 })
  })
})

describe('pixel ↔ centimetre conversion', () => {
  const scale = { pixelsPerMetre: 50 }

  it('converts plan pixels to centimetres', () => {
    expect(pxToCm(200, scale)).toBe(400)
    expect(pxToCm(1, scale)).toBe(2)
  })

  it('converts centimetres to plan pixels', () => {
    expect(cmToPx(400, scale)).toBe(200)
    expect(cmToPx(85, scale)).toBe(42.5)
  })
})

describe('parseLength', () => {
  it('reads centimetres as entered', () => {
    expect(parseLength('420', 'cm')).toBe(420)
  })

  it('converts metres to centimetres', () => {
    expect(parseLength('4.2', 'm')).toBe(420)
  })

  it('accepts a decimal comma and surrounding spaces', () => {
    expect(parseLength(' 3,75 ', 'm')).toBe(375)
  })

  it('rejects anything that is not a positive length', () => {
    for (const text of ['', ' ', 'abc', '0', '-2', '4m', '1.2.3', 'Infinity']) {
      expect(parseLength(text, 'm'), text).toBeNull()
    }
  })
})

describe('formatLength', () => {
  it('shows a metre or more in metres, to the centimetre', () => {
    expect(formatLength(420)).toBe('4.20 m')
    expect(formatLength(100)).toBe('1.00 m')
    expect(formatLength(1234.567)).toBe('12.35 m')
  })

  it('shows less than a metre in whole centimetres', () => {
    expect(formatLength(85)).toBe('85 cm')
    expect(formatLength(12.4)).toBe('12 cm')
  })

  it('does not show a length that rounds to a metre as 100 cm', () => {
    expect(formatLength(99.7)).toBe('1.00 m')
  })
})
