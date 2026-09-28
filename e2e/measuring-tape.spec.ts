import { expect, test, type Page } from '@playwright/test'
import { expectWidePlanFitted, pickFile, tallPlan, widePlan } from './plan.ts'

test.use({ viewport: { width: 1280, height: 720 } })

// The wide plan (400×200 px) is fitted at 3.2× with its top at y = 40, so
// screen (320, 360) is plan (100, 100) and screen (960, 360) is plan (300, 100)

const status = (page: Page) => page.getByRole('status')
const measureButton = (page: Page) =>
  page.getByRole('button', { name: 'Measure' })

/** Calibrate at 50 plan px per metre: plan (100, 100) to (300, 100) is 4 m. */
const calibrate = async (page: Page) => {
  await page.getByRole('button', { name: 'Calibrate scale' }).click()
  await page.mouse.click(320, 360)
  await page.mouse.click(960, 360)
  const dialog = page.getByRole('dialog', { name: 'How long is this line?' })
  await dialog.getByLabel('Length').fill('4')
  await dialog.getByRole('button', { name: 'Set scale' }).click()
  await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await pickFile(page, widePlan)
  await expectWidePlanFitted(page)
})

test('cannot measure until the scale is set', async ({ page }) => {
  await expect(measureButton(page)).toBeDisabled()

  await calibrate(page)

  await expect(measureButton(page)).toBeEnabled()
})

test.describe('once calibrated', () => {
  test.beforeEach(async ({ page }) => {
    await calibrate(page)
    await measureButton(page).click()
    await expect(measureButton(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(status(page)).toHaveText(
      /^Tap or click two points, or drag between them/,
    )
  })

  test('click, click: shows the distance live, then keeps it', async ({
    page,
  }) => {
    await page.mouse.click(320, 360)
    // Plan (100, 100) to (200, 100): 100 plan px = 2 m
    await page.mouse.move(640, 360, { steps: 3 })
    await expect(status(page)).toHaveText(/^Distance: 2\.00 m\./)

    // Plan (100, 100) to (100, 125): 25 plan px = 50 cm
    await page.mouse.move(320, 440, { steps: 3 })
    await expect(status(page)).toHaveText(/^Distance: 50 cm\./)

    await page.mouse.click(960, 360)
    await page.mouse.move(640, 600, { steps: 3 })
    await expect(status(page)).toHaveText(
      /^Distance: 4\.00 m\. Tap or click to/,
    )
  })

  test('click-drag: measures between the press and the release', async ({
    page,
  }) => {
    await page.mouse.move(320, 360)
    await page.mouse.down()
    await page.mouse.move(640, 360, { steps: 5 })
    await expect(status(page)).toHaveText(/^Distance: 2\.00 m\./)
    await page.mouse.move(960, 360, { steps: 5 })
    await page.mouse.up()

    await page.mouse.move(640, 600, { steps: 3 })
    await expect(status(page)).toHaveText(
      /^Distance: 4\.00 m\. Tap or click to/,
    )
  })

  test('space+drag pans without moving the end being stretched', async ({
    page,
  }) => {
    await page.mouse.click(320, 360)
    // Plan (100, 100) to (200, 100): 2 m
    await page.mouse.move(640, 360, { steps: 3 })
    await expect(status(page)).toHaveText(/^Distance: 2\.00 m\./)

    // Pan by (100, 50): plan (300, 100) is now at screen (1060, 410)
    await page.keyboard.down('Space')
    await page.mouse.down()
    await page.mouse.move(740, 410, { steps: 5 })
    await expect(status(page)).toHaveText(/^Distance: 2\.00 m\./)
    await page.mouse.move(640, 600, { steps: 5 })
    await expect(status(page)).toHaveText(/^Distance: 2\.00 m\./)
    await page.mouse.move(740, 410, { steps: 5 })
    await page.mouse.up()
    await page.keyboard.up('Space')
    await expect(status(page)).toHaveText(/^Distance: 2\.00 m\./)

    // The end follows the pointer again, still stretching
    await page.mouse.move(1060, 410, { steps: 3 })
    await expect(status(page)).toHaveText(
      /^Distance: 4\.00 m\. Tap or click the/,
    )
  })

  test('holding Shift snaps to horizontal, vertical or 45°', async ({
    page,
  }) => {
    await page.mouse.click(320, 360)
    // Plan (100, 100) to (300, 137.5): 203.5 plan px = 4.07 m
    await page.mouse.move(960, 480, { steps: 3 })
    await expect(status(page)).toHaveText(/^Distance: 4\.07 m\./)

    // Snapped to horizontal: plan (300, 100), 4 m
    await page.keyboard.down('Shift')
    await page.mouse.move(960, 481, { steps: 3 })
    await expect(status(page)).toHaveText(/^Distance: 4\.00 m\./)

    // Plan (200, 206.25) snaps to 45°: (203.125, 203.125), 145.8 plan px
    await page.mouse.move(640, 700, { steps: 3 })
    await expect(status(page)).toHaveText(/^Distance: 2\.92 m\./)

    await page.mouse.click(640, 700)
    await page.keyboard.up('Shift')
    await page.mouse.move(100, 100, { steps: 3 })
    await expect(status(page)).toHaveText(
      /^Distance: 2\.92 m\. Tap or click to/,
    )
  })

  test('without Shift a mouse never snaps, even close to horizontal', async ({
    page,
  }) => {
    await page.mouse.click(320, 360)
    // Plan (100, 100) to (300, 116), 4.6° off horizontal: 200.6 plan px
    await page.mouse.move(960, 411.2, { steps: 3 })
    await page.mouse.click(960, 411.2)

    await expect(status(page)).toHaveText(
      /^Distance: 4\.01 m\. Tap or click to/,
    )
  })

  test('the measurement disappears when the tape is left', async ({ page }) => {
    await page.mouse.click(320, 360)
    await page.mouse.click(960, 360)
    await expect(status(page)).toHaveText(/^Distance: 4\.00 m\./)

    await page.keyboard.press('Escape')
    await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')
    await expect(measureButton(page)).toHaveAttribute('aria-pressed', 'false')

    await measureButton(page).click()
    await expect(status(page)).toHaveText(
      /^Tap or click two points, or drag between them/,
    )
    await measureButton(page).click()
    await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')
  })

  test('Esc in a dialog closes only the dialog, keeping the tape and its measurement', async ({
    page,
  }) => {
    await page.mouse.click(320, 360)
    await page.mouse.click(960, 360)
    await expect(status(page)).toHaveText(/^Distance: 4\.00 m\./)

    await pickFile(page, tallPlan)
    const dialog = page.getByRole('dialog', {
      name: 'Replace the current plan?',
    })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')

    await expect(dialog).toBeHidden()
    await expect(measureButton(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(status(page)).toHaveText(/^Distance: 4\.00 m\./)
  })

  test('recalibrating leaves the tape', async ({ page }) => {
    await page.getByRole('button', { name: 'Recalibrate' }).click()

    await expect(measureButton(page)).toHaveAttribute('aria-pressed', 'false')
    await expect(status(page)).toHaveText(/^Tap or click one end of a wall/)
  })
})
