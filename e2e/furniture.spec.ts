import { expect, test, type Page } from '@playwright/test'
import {
  expectFurnitureAt,
  expectWidePlanFitted,
  pickFile,
  widePlan,
} from './plan.ts'

test.use({ viewport: { width: 1280, height: 720 } })

// The wide plan (400×200 px) is fitted at 3.2× with its top at y = 40, so the
// view's centre, screen (640, 360), is plan (200, 100)

const status = (page: Page) => page.getByRole('status')
const addButton = (page: Page) =>
  page.getByRole('button', { name: 'Add furniture' })
const deleteButton = (page: Page) =>
  page.getByRole('button', { name: 'Delete item' })
const formDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Add furniture' })

/** Calibrate so plan (100, 100) to (300, 100) is `metres` long. */
const calibrate = async (page: Page, metres: string) => {
  await page
    .getByRole('button', { name: /^(Calibrate scale|Recalibrate)$/ })
    .click()
  await page.mouse.click(320, 360)
  await page.mouse.click(960, 360)
  const dialog = page.getByRole('dialog', { name: 'How long is this line?' })
  await dialog.getByLabel('Length').fill(metres)
  await dialog.getByRole('button', { name: 'Set scale' }).click()
  await expect(dialog).toBeHidden()
}

const addFurniture = async (
  page: Page,
  name: string,
  widthCm: string,
  depthCm: string,
) => {
  await addButton(page).click()
  const form = formDialog(page)
  await form.getByLabel('Name').fill(name)
  await form.getByLabel('Width (cm)').fill(widthCm)
  await form.getByLabel('Depth (cm)').fill(depthCm)
  await form.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(form).toBeHidden()
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await pickFile(page, widePlan)
  await expectWidePlanFitted(page)
})

test('cannot add furniture until the scale is set', async ({ page }) => {
  await expect(addButton(page)).toBeDisabled()
  await expect(addButton(page)).toHaveAttribute(
    'title',
    'Calibrate the scale first',
  )

  await calibrate(page, '4')

  await expect(addButton(page)).toBeEnabled()
})

test.describe('once calibrated', () => {
  test.beforeEach(async ({ page }) => {
    // 50 plan px per metre
    await calibrate(page, '4')
  })

  test('adds an item centred in the view, drawn to scale and selected', async ({
    page,
  }) => {
    await addFurniture(page, 'Sofa', '200', '100')

    // 200 × 100 cm = 100 × 50 plan px = 320 × 160 screen px around (640, 360)
    await expectFurnitureAt(page, 485, 285)
    await expectFurnitureAt(page, 795, 435)
    await expectFurnitureAt(page, 475, 285, false)
    await expectFurnitureAt(page, 485, 275, false)
    await expectFurnitureAt(page, 805, 435, false)
    await expectFurnitureAt(page, 795, 445, false)
    await expect(status(page)).toHaveText(/^Sofa selected\./)
  })

  test('keeps its real size when the scale is recalibrated', async ({
    page,
  }) => {
    await addFurniture(page, 'Sofa', '200', '100')

    // The same line is now 2 m: 100 plan px per metre, so the item is
    // 200 × 100 plan px = 640 × 320 screen px around (640, 360)
    await calibrate(page, '2')

    await expectFurnitureAt(page, 325, 205)
    await expectFurnitureAt(page, 955, 515)
    await expectFurnitureAt(page, 315, 205, false)
    await expectFurnitureAt(page, 955, 525, false)
  })

  test('rejects a form without a name or a positive size', async ({ page }) => {
    await addButton(page).click()
    const form = formDialog(page)
    await form.getByLabel('Width (cm)').fill('200')
    await form.getByLabel('Depth (cm)').fill('0')
    await form.getByRole('button', { name: 'Add', exact: true }).click()

    await expect(form.getByRole('alert')).toHaveText(/name/)
    await form.getByLabel('Name').fill('Desk')
    await form.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(form.getByRole('alert')).toHaveText(/greater than zero/)

    await form.getByRole('button', { name: 'Cancel' }).click()
    await expect(form).toBeHidden()
    await expectFurnitureAt(page, 640, 360, false)
  })

  test('clicking selects an item; clicking empty canvas deselects it', async ({
    page,
  }) => {
    await addFurniture(page, 'Sofa', '200', '100')

    await page.mouse.click(200, 600)
    await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')
    await expect(deleteButton(page)).toBeHidden()

    await page.mouse.click(500, 300)
    await expect(status(page)).toHaveText(/^Sofa selected\./)
    await expect(deleteButton(page)).toBeVisible()
  })

  test('panning the view keeps the selection', async ({ page }) => {
    await addFurniture(page, 'Sofa', '200', '100')

    await page.mouse.move(200, 600)
    await page.mouse.down()
    await page.mouse.move(260, 600, { steps: 5 })
    await page.mouse.up()

    await expect(status(page)).toHaveText(/^Sofa selected\./)
    // Everything moved 60 px right
    await expectFurnitureAt(page, 545, 285)
  })

  test('the Delete key deletes the selected item', async ({ page }) => {
    await addFurniture(page, 'Sofa', '200', '100')

    await page.keyboard.press('Delete')

    await expectFurnitureAt(page, 485, 285, false)
    await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')
  })

  test('the Delete item button deletes the selected item', async ({ page }) => {
    await addFurniture(page, 'Sofa', '200', '100')
    await addFurniture(page, 'Chair', '50', '50')

    await deleteButton(page).click()

    // The chair is gone, the sofa underneath it stays
    await expectFurnitureAt(page, 485, 285)
    await expect(deleteButton(page)).toBeHidden()
    await page.mouse.click(640, 360)
    await expect(status(page)).toHaveText(/^Sofa selected\./)
  })

  test('typing in the form does not delete the selected item', async ({
    page,
  }) => {
    await addFurniture(page, 'Sofa', '200', '100')

    await addButton(page).click()
    const name = formDialog(page).getByLabel('Name')
    await name.fill('Desk')
    await name.press('Delete')
    await name.press('Backspace')
    await formDialog(page).getByRole('button', { name: 'Cancel' }).click()

    await expectFurnitureAt(page, 485, 285)
    await expect(status(page)).toHaveText(/^Sofa selected\./)
  })

  test('starting a tool clears the selection', async ({ page }) => {
    await addFurniture(page, 'Sofa', '200', '100')

    await page.getByRole('button', { name: 'Measure' }).click()

    await page.keyboard.press('Escape')
    await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')
    await expect(deleteButton(page)).toBeHidden()
  })
})
