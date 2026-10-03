import { expect, test } from '@playwright/test'
import { pickFile, widePlan } from '../plan.ts'

// The wide plan is fitted to the 1194×834 tablet: screen (298.5, 417) is plan
// (100, 100) and screen (895.5, 417) is plan (300, 100)

test('after the two calibration taps the Length field has focus', async ({
  page,
}) => {
  await page.goto('./')
  await pickFile(page, widePlan)
  await page.getByRole('button', { name: 'Calibrate scale' }).click()
  await page.touchscreen.tap(298.5, 417)
  await page.touchscreen.tap(895.5, 417)

  const dialog = page.getByRole('dialog', { name: 'How long is this line?' })
  await expect(dialog.getByLabel('Length')).toBeFocused()
  // Typing goes straight into it: 4 m across 200 plan px
  await page.keyboard.type('4')
  await dialog.getByRole('button', { name: 'Set scale' }).click()
  await expect(page.getByRole('status')).toHaveText('Scale: 1 m = 50 plan px')
})
