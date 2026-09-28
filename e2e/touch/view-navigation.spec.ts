import { expect, test, type Page } from '@playwright/test'
import { expectPlanColour, pickFile, widePlan } from '../plan.ts'
import { fingers } from './fingers.ts'

// Wide plan fitted to the 1194×834 tablet: scale 2.985 → 1194×597 at
// y = 118.5, red left of x 597, blue right of it
const expectWidePlanFitted = async (page: Page) => {
  await expectPlanColour(page, 500, 417, 'red')
  await expectPlanColour(page, 700, 417, 'blue')
  await expectPlanColour(page, 500, 60, 'none')
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await pickFile(page, widePlan)
  await expectWidePlanFitted(page)
})

test('pinching zooms the plan around the fingers, not the page', async ({
  page,
}) => {
  const touch = await fingers(page)
  const a = await touch.down([400, 417])
  const b = await touch.down([600, 417])
  await touch.move({ [a]: [300, 417], [b]: [700, 417] })
  await touch.up(a)
  await touch.up(b)

  // 2× around (500, 417): the red/blue edge moves from x 597 to 694 and the
  // plan grows past the top of the screen
  await expectPlanColour(page, 650, 417, 'red')
  await expectPlanColour(page, 740, 417, 'blue')
  await expectPlanColour(page, 500, 60, 'red')
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1)
})

test("Safari's gesture events for the same pinch don't zoom a second time", async ({
  page,
}) => {
  /** Fire one of Safari's gesture events at the window. */
  const gesture = (type: string, scale: number) =>
    page.evaluate(
      ([type, scale]) => {
        const e = new Event(type as string, { cancelable: true })
        Object.assign(e, { scale, clientX: 500, clientY: 417 })
        window.dispatchEvent(e)
      },
      [type, scale] as const,
    )
  const touch = await fingers(page)

  const a = await touch.down([400, 417])
  const b = await touch.down([600, 417])
  await gesture('gesturestart', 1)
  await touch.move({ [a]: [300, 417], [b]: [700, 417] })
  await gesture('gesturechange', 2)
  await gesture('gestureend', 2)
  await touch.up(a)
  await touch.up(b)

  // 2× only: the red/blue edge is at x 694, not 888
  await expectPlanColour(page, 650, 417, 'red')
  await expectPlanColour(page, 740, 417, 'blue')
  await expectPlanColour(page, 850, 417, 'blue')
})

test('two fingers moving together pan the plan', async ({ page }) => {
  const touch = await fingers(page)
  const a = await touch.down([400, 400])
  const b = await touch.down([600, 400])
  await touch.move({ [a]: [300, 450], [b]: [500, 450] })
  await touch.up(a)
  await touch.up(b)

  // Panned by (-100, 50): the edge moves to x 497, the top to y 168.5
  await expectPlanColour(page, 470, 417, 'red')
  await expectPlanColour(page, 530, 417, 'blue')
  await expectPlanColour(page, 500, 150, 'none')
})

test('double-tapping does not zoom the plan or the page', async ({ page }) => {
  await page.touchscreen.tap(500, 417)
  await page.touchscreen.tap(500, 417)

  await expectWidePlanFitted(page)
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1)
})

test('one finger dragging empty canvas pans the plan', async ({ page }) => {
  const touch = await fingers(page)
  const a = await touch.down([500, 400])
  await touch.move({ [a]: [400, 450] })
  await touch.up(a)

  await expectPlanColour(page, 470, 417, 'red')
  await expectPlanColour(page, 530, 417, 'blue')
  await expectPlanColour(page, 500, 150, 'none')
})
