import { describe, expect, it } from 'vitest'
import { distance, snapToAngle } from './geometry'

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
