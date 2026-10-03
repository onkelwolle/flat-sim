import { expect, test, type Page } from '@playwright/test'
import {
  CALIBRATION_LAYER,
  expectLabelCentredAt,
  expectWidePlanFitted,
  pickFile,
  tallPlan,
  widePlan,
} from './plan.ts'

test.use({ viewport: { width: 1280, height: 720 } })

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await pickFile(page, widePlan)
  await expectWidePlanFitted(page)
})

const status = (page: Page) => page.getByRole('status')
const lengthDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'How long is this line?' })

/** Draw the calibration line between two screen points and enter its length. */
const calibrate = async (
  page: Page,
  from: [number, number],
  to: [number, number],
  length: string,
  unit: 'cm' | 'm',
) => {
  await page.getByRole('button', { name: /calibrate/i }).click()
  await expect(status(page)).toHaveText(/^Tap or click one end of a wall/)
  await page.mouse.click(...from)
  await expect(status(page)).toHaveText(/^Tap or click the other end/)
  await page.mouse.click(...to)
  const dialog = lengthDialog(page)
  await dialog.getByLabel('Length').fill(length)
  await dialog.getByLabel('Unit').selectOption(unit)
  await dialog.getByRole('button', { name: 'Set scale' }).click()
  await expect(dialog).toBeHidden()
}

// The wide plan (400×200 px) is fitted at 3.2× with its top at y = 40, so
// screen (320, 360) is plan (100, 100) and screen (960, 360) is plan (300, 100)

test('prompts for a scale until the plan is calibrated', async ({ page }) => {
  await expect(status(page)).toHaveText(/Scale not set/)
  await expect(
    page.getByRole('button', { name: 'Calibrate scale' }),
  ).toBeVisible()
})

test('sets the scale from a line along a wall of known length', async ({
  page,
}) => {
  // 200 plan px = 4 m
  await calibrate(page, [320, 360], [960, 360], '4', 'm')

  await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')
  await expect(page.getByRole('button', { name: 'Recalibrate' })).toBeVisible()
})

test('measures the scale in plan pixels, whatever the zoom and pan', async ({
  page,
}) => {
  // One wheel notch zooms e^0.15× around plan (100, 100), which stays put
  await page.mouse.move(320, 360)
  await page.mouse.wheel(0, -100)
  const zoomedScale = 3.2 * Math.exp(0.15)
  // Pan by (100, 50)
  await page.mouse.down()
  await page.mouse.move(420, 410, { steps: 5 })
  await page.mouse.up()

  // Plan (100, 100) to (300, 100), as on screen now
  await calibrate(page, [420, 410], [420 + 200 * zoomedScale, 410], '400', 'cm')

  await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')
})

test('the length label is centred on the line, the same size at any zoom', async ({
  page,
}) => {
  // Plan (200, 50) to (200, 150), vertical, with its midpoint at (640, 360)
  await calibrate(page, [640, 200], [640, 520], '2', 'm')
  const size = await expectLabelCentredAt(page, CALIBRATION_LAYER, 640, 360)

  // Zooming around the midpoint keeps it put
  await page.mouse.move(640, 360)
  await page.mouse.wheel(0, -100)
  const zoomed = await expectLabelCentredAt(page, CALIBRATION_LAYER, 640, 360)
  expect(zoomed.width).toBeCloseTo(size.width, 0)
  expect(zoomed.height).toBeCloseTo(size.height, 0)
})

test('re-calibrating replaces the scale', async ({ page }) => {
  await calibrate(page, [320, 360], [960, 360], '4', 'm')

  // Plan (100, 50) to (100, 150): 100 plan px = 50 cm
  await calibrate(page, [320, 200], [320, 520], '50', 'cm')

  await expect(status(page)).toHaveText('Scale: 1 m = 200 plan px')
})

test('cancelling keeps the current scale', async ({ page }) => {
  await calibrate(page, [320, 360], [960, 360], '4', 'm')

  await page.getByRole('button', { name: 'Recalibrate' }).click()
  await page.mouse.click(320, 200)
  await page.mouse.click(320, 520)
  await lengthDialog(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')

  await page.getByRole('button', { name: 'Recalibrate' }).click()
  await page.mouse.click(320, 200)
  await page.keyboard.press('Escape')
  await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')
})

test('asks again for a length that is not a positive number', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Calibrate scale' }).click()
  await page.mouse.click(320, 360)
  await page.mouse.click(960, 360)
  const dialog = lengthDialog(page)

  await dialog.getByLabel('Length').fill('0')
  await dialog.getByRole('button', { name: 'Set scale' }).click()

  await expect(dialog.getByRole('alert')).toHaveText(
    'Enter a length greater than zero.',
  )
  await dialog.getByLabel('Length').fill('4,5')
  await dialog.getByRole('button', { name: 'Set scale' }).click()
  await expect(dialog).toBeHidden()
  // Default unit is metres: 200 plan px = 4.5 m
  await expect(status(page)).toHaveText('Scale: 1 m = 44.4 plan px')
})

test('the length dialog keeps what is typed across the phone breakpoint', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Calibrate scale' }).click()
  await page.mouse.click(320, 360)
  await page.mouse.click(960, 360)
  const dialog = lengthDialog(page)
  await dialog.getByLabel('Length').fill('0')
  await dialog.getByLabel('Unit').selectOption('cm')
  await dialog.getByRole('button', { name: 'Set scale' }).click()

  const expectDialogAsTyped = async () => {
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Length')).toHaveValue('0')
    await expect(dialog.getByLabel('Unit')).toHaveValue('cm')
    await expect(dialog.getByRole('alert')).toHaveText(
      'Enter a length greater than zero.',
    )
  }

  // Narrowed to a phone, then widened again, each time once the tools have
  // moved
  await page.setViewportSize({ width: 390, height: 720 })
  await expect(page.locator('.bottom-bar')).toBeAttached()
  await expectDialogAsTyped()
  await page.setViewportSize({ width: 1280, height: 720 })
  await expect(page.locator('.toolbar')).toBeAttached()
  await expectDialogAsTyped()

  // And it still sets the scale: 200 plan px = 400 cm
  await dialog.getByLabel('Length').fill('400')
  await dialog.getByRole('button', { name: 'Set scale' }).click()
  await expect(dialog).toBeHidden()
  await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')
})

test('a new plan starts without a scale', async ({ page }) => {
  await calibrate(page, [320, 360], [960, 360], '4', 'm')

  await pickFile(page, tallPlan)
  await page.getByRole('button', { name: 'Replace' }).click()

  await expect(status(page)).toHaveText(/Scale not set/)
})

test('Esc in a dialog closes only the dialog, keeping the calibrate tool', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Calibrate scale' }).click()
  await page.mouse.click(320, 360)
  await expect(status(page)).toHaveText(/^Tap or click the other end/)

  await pickFile(page, tallPlan)
  const dialog = page.getByRole('dialog', { name: 'Replace the current plan?' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(dialog).toBeHidden()
  await expect(status(page)).toHaveText(/^Tap or click the other end/)
})

test('a mouse press places its point at once, with no loupe', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Calibrate scale' }).click()
  await page.mouse.move(320, 360)

  await page.mouse.down()

  await expect(status(page)).toHaveText(/^Tap or click the other end/)
  await expect(page.getByTestId('loupe')).toBeHidden()
  await page.mouse.up()
})
