import { expect, test, type Page } from '@playwright/test'
import {
  expectPlanColour,
  expectWidePlanFitted,
  pickFile,
  widePlan,
} from './plan.ts'

test.use({ viewport: { width: 1280, height: 720 } })

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await pickFile(page, widePlan)
  await expectWidePlanFitted(page)
})

const drag = async (
  page: Page,
  from: [number, number],
  by: [number, number],
) => {
  await page.mouse.move(...from)
  await page.mouse.down()
  await page.mouse.move(from[0] + by[0], from[1] + by[1], { steps: 5 })
  await page.mouse.up()
}

/** Turn the mouse wheel `times` notches at a point; negative `deltaY` zooms in. */
const wheel = async (
  page: Page,
  at: [number, number],
  deltaY: number,
  times = 1,
) => {
  await page.mouse.move(...at)
  for (let i = 0; i < times; i++) await page.mouse.wheel(0, deltaY)
}

// Wide plan panned by (100, 50) from its fitted position: 1280×640 at (100, 90)
const expectWidePlanPanned = async (page: Page) => {
  await expectPlanColour(page, 50, 360, 'none')
  await expectPlanColour(page, 150, 360, 'red')
  await expectPlanColour(page, 700, 360, 'red')
  await expectPlanColour(page, 780, 360, 'blue')
  await expectPlanColour(page, 640, 60, 'none')
}

test('zooms in around the cursor with the mouse wheel', async ({ page }) => {
  await wheel(page, [320, 360], -100, 3)

  // ~1.57× around (320, 360): the red/blue edge moves from x 640 to ~822
  // and the plan grows past the top of the screen
  await expectPlanColour(page, 320, 360, 'red')
  await expectPlanColour(page, 780, 360, 'red')
  await expectPlanColour(page, 640, 20, 'red')
  await expectPlanColour(page, 900, 360, 'blue')
})

test('zooms with a trackpad pinch (ctrl+wheel) without zooming the page', async ({
  page,
}) => {
  await page.keyboard.down('Control')
  await wheel(page, [320, 360], -10, 5)
  await page.keyboard.up('Control')

  // ~1.65× around (320, 360): the red/blue edge moves to ~848
  await expectPlanColour(page, 800, 360, 'red')
  await expectPlanColour(page, 640, 20, 'red')
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1)
})

test('zooms by a single step per ctrl+mouse wheel notch', async ({ page }) => {
  await page.keyboard.down('Control')
  await wheel(page, [320, 360], -100)
  await page.keyboard.up('Control')

  // Capped at 1.25× around (320, 360): the red/blue edge moves to 720
  await expectPlanColour(page, 700, 360, 'red')
  await expectPlanColour(page, 740, 360, 'blue')
})

test('stops zooming out at a quarter of the fitted size', async ({ page }) => {
  await wheel(page, [640, 360], 100, 30)

  // Clamped to 0.8× plan px around (640, 360): 320×160 at (480, 280)
  await expectPlanColour(page, 470, 360, 'none')
  await expectPlanColour(page, 490, 360, 'red')
  await expectPlanColour(page, 790, 360, 'blue')
  await expectPlanColour(page, 810, 360, 'none')
  await expectPlanColour(page, 560, 270, 'none')
  await expectPlanColour(page, 560, 290, 'red')
})

test('pans by dragging the canvas', async ({ page }) => {
  await drag(page, [320, 360], [100, 50])

  await expectWidePlanPanned(page)
})

test('pans by dragging with space held', async ({ page }) => {
  // The Konva container div carries the Stage's style
  const stage = page.locator('div:has(> .konvajs-content)')
  await page.keyboard.down('Space')
  await expect(stage).toHaveCSS('cursor', 'grab')

  await drag(page, [320, 360], [100, 50])
  await page.keyboard.up('Space')

  await expectWidePlanPanned(page)
  await expect(stage).not.toHaveCSS('cursor', 'grab')
})

test('holding space arms panning even after clicking a toolbar button', async ({
  page,
}) => {
  const stage = page.locator('div:has(> .konvajs-content)')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open plan…' }).click()
  await (await chooser).setFiles([]) // dismiss it without picking a file

  await page.keyboard.down('Space')
  await expect(stage).toHaveCSS('cursor', 'grab')
  const reopened = page.waitForEvent('filechooser', { timeout: 500 })
  await page.keyboard.up('Space')

  // Releasing space must not press the button again
  await expect(reopened).rejects.toThrow()
})

test('fits the plan to the screen again', async ({ page }) => {
  await wheel(page, [320, 360], -100, 3)
  await drag(page, [320, 360], [100, 50])

  await page.getByRole('button', { name: 'Fit to screen' }).click()

  await expectWidePlanFitted(page)
})

test('offers "Fit to screen" only once a plan is open', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Fit to screen' })).toHaveCount(
    0,
  )
})
