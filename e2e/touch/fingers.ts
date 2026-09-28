// Multi-touch for touch specs: Playwright's touchscreen only taps, so fingers
// go down, move and lift through CDP's Input.dispatchTouchEvent.
import type { CDPSession, Page } from '@playwright/test'

type At = [number, number]

export type Fingers = {
  /** Put a finger down; it stays down until lifted. Returns its id. */
  down: (at: At) => Promise<number>
  /** Move fingers (by id) to new points in `steps` even steps. */
  move: (to: Record<number, At>, steps?: number) => Promise<void>
  /** Lift a finger. */
  up: (id: number) => Promise<void>
}

export async function fingers(page: Page): Promise<Fingers> {
  const cdp: CDPSession = await page.context().newCDPSession(page)
  const touching = new Map<number, At>()
  let nextId = 0

  const points = () =>
    [...touching].map(([id, [x, y]]) => ({ id, x, y, radiusX: 5, radiusY: 5 }))

  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd') =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points() })

  return {
    async down(at) {
      const id = nextId++
      touching.set(id, at)
      await send('touchStart')
      return id
    },
    async move(to, steps = 5) {
      const from = new Map(touching)
      for (let step = 1; step <= steps; step++) {
        for (const [id, [x, y]] of Object.entries(to)) {
          const [fx, fy] = from.get(Number(id))!
          touching.set(Number(id), [
            fx + ((x - fx) * step) / steps,
            fy + ((y - fy) * step) / steps,
          ])
        }
        await send('touchMove')
      }
    },
    async up(id) {
      touching.delete(id)
      await send('touchEnd')
    },
  }
}
