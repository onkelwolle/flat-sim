import { describe, expect, it } from 'vitest'
import {
  distance,
  labelFlipped,
  nudgeOffset,
  snapRotation,
  snapToAngle,
} from './geometry'

describe('distance', () => {
  it('is the straight-line distance between two points', () => {
    // 3-4-5 triangle
    expect(distance({ x: 10, y: 20 }, { x: 40, y: 60 })).toBe(50)
  })
})

describe('snapToAngle', () => {
  const from = { x: 100, y: 100 }

  it('snaps a nearly horizontal line to horizontal, keeping how far along it reaches', () => {
    expect(snapToAngle(from, { x: 300, y: 110 })).toEqual({ x: 300, y: 100 })
    expect(snapToAngle(from, { x: 20, y: 95 })).toEqual({ x: 20, y: 100 })
  })

  it('snaps a nearly vertical line to vertical', () => {
    expect(snapToAngle(from, { x: 95, y: 20 })).toEqual({ x: 100, y: 20 })
    expect(snapToAngle(from, { x: 130, y: 400 })).toEqual({ x: 100, y: 400 })
  })

  it('snaps a nearly diagonal line to 45°, projecting the end onto it', () => {
    // (100, 90) off the start projects to 95 along each axis
    expect(snapToAngle(from, { x: 200, y: 190 })).toEqual({ x: 195, y: 195 })
    // Up and to the left: (-100, -95) projects to -97.5 along each axis
    expect(snapToAngle(from, { x: 0, y: 5 })).toEqual({ x: 2.5, y: 2.5 })
    expect(snapToAngle(from, { x: 180, y: 20 })).toEqual({ x: 180, y: 20 })
  })

  it('leaves an end on top of the start where it is', () => {
    expect(snapToAngle(from, from)).toEqual(from)
  })
})

describe('snapRotation', () => {
  it('snaps to the nearest 15° step', () => {
    expect(snapRotation(0)).toBe(0)
    expect(snapRotation(7)).toBe(0)
    expect(snapRotation(8)).toBe(15)
    expect(snapRotation(40)).toBe(45)
    expect(snapRotation(97.4)).toBe(90)
  })

  it('keeps the angle within 0–360°, clockwise', () => {
    expect(snapRotation(-10)).toBe(345)
    expect(snapRotation(-90)).toBe(270)
    expect(snapRotation(358)).toBe(0)
    expect(snapRotation(725)).toBe(0)
  })

  it('without snapping, only brings the angle within 0–360°', () => {
    expect(snapRotation(40.5, null)).toBe(40.5)
    expect(snapRotation(-10, null)).toBe(350)
    expect(snapRotation(360, null)).toBe(0)
  })
})

describe('nudgeOffset', () => {
  // 50 plan px per metre: 1 cm is half a plan pixel
  const scale = { pixelsPerMetre: 50 }

  it('moves a real distance, converted to plan pixels, in the arrow direction', () => {
    expect(nudgeOffset('right', 1, scale)).toEqual({ x: 0.5, y: 0 })
    expect(nudgeOffset('left', 10, scale)).toEqual({ x: -5, y: 0 })
    expect(nudgeOffset('down', 10, scale)).toEqual({ x: 0, y: 5 })
    expect(nudgeOffset('up', 1, scale)).toEqual({ x: 0, y: -0.5 })
  })
})

describe('labelFlipped', () => {
  it('flips the label of an item turned past a quarter turn, so it never reads upside down', () => {
    expect(labelFlipped(0)).toBe(false)
    expect(labelFlipped(90)).toBe(false)
    expect(labelFlipped(135)).toBe(true)
    expect(labelFlipped(270)).toBe(true)
    expect(labelFlipped(300)).toBe(false)
  })
})
