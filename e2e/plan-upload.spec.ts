import { expect, test } from '@playwright/test'
import {
  dropFile,
  expectTallPlanFitted,
  expectWidePlanFitted,
  fixture,
  pickFile,
  tallPlan,
  widePlan,
} from './plan.ts'

test.use({ viewport: { width: 1280, height: 720 } })

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  // The controls appear once the saved project (here: none) has been restored
  await expect(page.getByRole('button', { name: 'Open plan…' })).toBeVisible()
})

test('opens a plan from the file picker, fitted to the viewport', async ({
  page,
}) => {
  await expect(page.getByText(/Drop a floor plan image/)).toBeVisible()

  await pickFile(page, widePlan)

  await expectWidePlanFitted(page)
  await expect(page.getByText(/Drop a floor plan image/)).toBeHidden()
})

test('opens a plan dropped onto the page', async ({ page }) => {
  await dropFile(page, widePlan, 'image/png', async () => {
    await expect(page.getByText('Drop to open the plan')).toBeVisible()
  })

  await expect(page.getByText('Drop to open the plan')).toBeHidden()
  await expectWidePlanFitted(page)
})

test('opens the file picker from the keyboard', async ({ page }) => {
  // Listen early: Playwright intercepts file choosers only once it has had
  // time to set that up, and a picker opened before then goes unseen
  const chooser = page.waitForEvent('filechooser')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Open plan…' })).toBeFocused()

  await page.keyboard.press('Enter')
  await (await chooser).setFiles(widePlan.pathname)

  await expectWidePlanFitted(page)
})

test('asks in-page before replacing the plan', async ({ page }) => {
  page.on('dialog', () => {
    throw new Error('native dialogs must not be used')
  })
  await pickFile(page, widePlan)
  await expectWidePlanFitted(page)

  await pickFile(page, tallPlan)
  const dialog = page.getByRole('dialog', { name: 'Replace the current plan?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  await expectWidePlanFitted(page)

  await pickFile(page, tallPlan)
  await dialog.getByRole('button', { name: 'Replace' }).click()
  await expect(dialog).toBeHidden()
  await expectTallPlanFitted(page)
})

test('ignores drops while the replace prompt is open', async ({ page }) => {
  await pickFile(page, widePlan)
  await expectWidePlanFitted(page)
  await pickFile(page, tallPlan)
  const dialog = page.getByRole('dialog', { name: 'Replace the current plan?' })
  await expect(dialog).toContainText('tall-plan.jpg')

  await dropFile(page, widePlan, 'image/png', async () => {
    await expect(page.getByText('Drop to open the plan')).toBeHidden()
  })

  await expect(dialog).toContainText('tall-plan.jpg')
  await dialog.getByRole('button', { name: 'Replace' }).click()
  await expectTallPlanFitted(page)
})

test('rejects files that are not PNG or JPG images', async ({ page }) => {
  await pickFile(page, fixture('notes.txt'))

  await expect(page.getByRole('alert')).toHaveText(
    'notes.txt is not a PNG or JPG image.',
  )
})
