import { expect, test, type Page } from '@playwright/test'
import { pickFile, widePlan } from '../plan.ts'
import { fingers } from './fingers.ts'

// The wide plan (400×200 px, red left of x 200, blue right) is fitted to the
// 1194×834 tablet at 2.985× with its top at y = 118.5: plan (x, y) is screen
// (298.5 + (x - 100) × 2.985, 417 + (y - 100) × 2.985)
const screen = (x: number, y: number): [number, number] => [
  298.5 + (x - 100) * 2.985,
  417 + (y - 100) * 2.985,
]

const status = (page: Page) => page.getByRole('status')
const loupe = (page: Page) => page.getByTestId('loupe')
const lengthDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'How long is this line?' })

/** Whether the loupe shows red or blue plan at a point of its own. */
const loupeColour = (page: Page, x: number, y: number) =>
  page.evaluate(
    ([x, y]) => {
      const canvas = document.querySelector('[data-testid="loupe"] canvas')
      if (!(canvas instanceof HTMLCanvasElement)) return null
      const ratio = canvas.width / canvas.clientWidth
      const [r, , b] = canvas
        .getContext('2d')!
        .getImageData(x * ratio, y * ratio, 1, 1).data
      return r! > 200 && b! < 50 ? 'red' : b! > 200 && r! < 50 ? 'blue' : null
    },
    [x, y],
  )

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await pickFile(page, widePlan)
  // 50 plan px per metre: plan (100, 100) to (300, 100) is 4 m
  await page.getByRole('button', { name: 'Calibrate scale' }).click()
  await page.touchscreen.tap(...screen(100, 100))
  await page.touchscreen.tap(...screen(300, 100))
  await lengthDialog(page).getByLabel('Length').fill('4')
  await lengthDialog(page).getByRole('button', { name: 'Set scale' }).click()
  await page.getByRole('button', { name: 'Measure' }).click()
})

test('a finger drawing a line within 5° of vertical snaps it, and the loupe shows the snapped end', async ({
  page,
}) => {
  const touch = await fingers(page)

  // Plan (197, 50) to (205, 150), 4.6° off vertical: snaps to (197, 150), 2 m
  // (unsnapped it would be 100.3 plan px, 2.01 m)
  const a = await touch.down(screen(197, 50))
  await touch.move({ [a]: screen(205, 150) })
  await expect(status(page)).toHaveText(/^Distance: 2\.00 m\./)
  // The loupe (120 px, plan at 5.97× zoom) centres on the snapped end, 3 plan
  // px left of the red/blue edge: 10 px right of its centre is still red
  await expect.poll(() => loupeColour(page, 70, 60)).toBe('red')
  await touch.up(a)

  await expect(status(page)).toHaveText(
    /^Distance: 2\.00 m\. Tap or click to measure again/,
  )
})
