import { expect, test, type Page } from '@playwright/test'
import { canvasDrawn, pickFile, widePlan } from '../plan.ts'
import { fingers } from './fingers.ts'

// The wide plan is fitted to the 1194×834 tablet: screen (298.5, 417) is plan
// (100, 100), screen (597, 417) is plan (200, 100) and screen (895.5, 417) is
// plan (300, 100)

const status = (page: Page) => page.getByRole('status')
const lengthDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'How long is this line?' })
const undoButton = (page: Page) =>
  page.getByRole('button', { name: 'Undo', exact: true })

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await pickFile(page, widePlan)
})

test('after the two calibration taps the Length field has focus', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Calibrate scale' }).click()
  await page.touchscreen.tap(298.5, 417)
  await page.touchscreen.tap(895.5, 417)

  const dialog = lengthDialog(page)
  await expect(dialog.getByLabel('Length')).toBeFocused()
  // Typing goes straight into it: 4 m across 200 plan px
  await page.keyboard.type('4')
  await dialog.getByRole('button', { name: 'Set scale' }).click()
  await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')
})

test.describe('adjusting the calibration line', () => {
  test.beforeEach(async ({ page }) => {
    // Plan (100, 100) to (300, 100), 4 m: 50 plan px per metre
    await page.getByRole('button', { name: 'Calibrate scale' }).click()
    await page.touchscreen.tap(298.5, 417)
    await page.touchscreen.tap(895.5, 417)
    await lengthDialog(page).getByLabel('Length').fill('4')
    await lengthDialog(page).getByRole('button', { name: 'Set scale' }).click()
    await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')
    // Drawn, so a finger on an end finds it
    await canvasDrawn(page)
  })

  test('a finger drags an end, grabbing it from beside it', async ({
    page,
  }) => {
    const touch = await fingers(page)

    // From 18 px below the end, which goes to plan (200, 100): 100 plan px
    // are now the 4 m
    const a = await touch.down([895.5, 435])
    await touch.move({ [a]: [597, 435] })
    await touch.up(a)

    await expect(status(page)).toHaveText('Scale: 1 m = 25 plan px')
    await expect(undoButton(page)).toHaveAttribute(
      'title',
      'Undo adjust calibration',
    )
  })

  test('a second finger during the drag snaps the end back, recording no step', async ({
    page,
  }) => {
    const touch = await fingers(page)

    const a = await touch.down([895.5, 417])
    await touch.move({ [a]: [597, 417] })
    const b = await touch.down([300, 700])
    await touch.up(a)
    await touch.up(b)

    await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')
    await expect(undoButton(page)).toHaveAttribute(
      'title',
      'Undo calibrate scale',
    )
    // The end is back where it was, and a finger drags it from there
    const c = await touch.down([895.5, 417])
    await touch.move({ [c]: [597, 417] })
    await touch.up(c)
    await expect(status(page)).toHaveText('Scale: 1 m = 25 plan px')
  })
})
