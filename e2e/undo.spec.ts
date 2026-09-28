import { expect, test, type Page } from '@playwright/test'
import {
  expectFurnitureAt,
  expectTallPlanFitted,
  expectWidePlanFitted,
  pickFile,
  tallPlan,
  widePlan,
} from './plan.ts'

test.use({ viewport: { width: 1280, height: 720 } })

// The wide plan (400×200 px) is fitted at 3.2× with its top at y = 40, so the
// view's centre, screen (640, 360), is plan (200, 100)

const status = (page: Page) => page.getByRole('status')
const undoButton = (page: Page) =>
  page.getByRole('button', { name: 'Undo', exact: true })
const redoButton = (page: Page) =>
  page.getByRole('button', { name: 'Redo', exact: true })
const panel = (page: Page) =>
  page.getByRole('complementary', { name: 'Selected item' })

/** Calibrate so plan (100, 100) to (300, 100) is 4 m long. */
const calibrate = async (page: Page) => {
  await page.getByRole('button', { name: 'Calibrate scale' }).click()
  await page.mouse.click(320, 360)
  await page.mouse.click(960, 360)
  const dialog = page.getByRole('dialog', { name: 'How long is this line?' })
  await dialog.getByLabel('Length').fill('4')
  await dialog.getByRole('button', { name: 'Set scale' }).click()
  await expect(dialog).toBeHidden()
}

/** Add a 200 × 100 cm sofa: 320 × 160 screen px around (640, 360). */
const addSofa = async (page: Page) => {
  await page.getByRole('button', { name: 'Add furniture' }).click()
  const form = page.getByRole('dialog', { name: 'Add furniture' })
  await form.getByLabel('Name').fill('Sofa')
  await form.getByLabel('Width (cm)').fill('200')
  await form.getByLabel('Depth (cm)').fill('100')
  await form.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(form).toBeHidden()
}

/** Drag the sofa 100 px right and down. */
const dragSofa = async (page: Page) => {
  await page.mouse.move(600, 380)
  await page.mouse.down()
  await page.mouse.move(700, 480, { steps: 5 })
  await page.mouse.up()
}

const expectSofaAtStart = async (page: Page) => {
  await expectFurnitureAt(page, 485, 285)
  await expectFurnitureAt(page, 795, 435)
  await expectFurnitureAt(page, 805, 445, false)
}

const expectSofaMoved = async (page: Page) => {
  await expectFurnitureAt(page, 585, 385)
  await expectFurnitureAt(page, 895, 535)
  await expectFurnitureAt(page, 575, 385, false)
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await pickFile(page, widePlan)
  await expectWidePlanFitted(page)
})

test('the buttons are disabled with nothing to undo or redo', async ({
  page,
}) => {
  await expect(undoButton(page)).toBeDisabled()
  await expect(redoButton(page)).toBeDisabled()

  await calibrate(page)

  await expect(undoButton(page)).toBeEnabled()
  await expect(undoButton(page)).toHaveAttribute(
    'title',
    'Undo calibrate scale',
  )
  await expect(redoButton(page)).toBeDisabled()
})

test.describe('with a sofa', () => {
  test.beforeEach(async ({ page }) => {
    await calibrate(page)
    await addSofa(page)
  })

  test('Ctrl+Z undoes a drag, selecting the item; Ctrl+Shift+Z and Ctrl+Y redo it', async ({
    page,
  }) => {
    await dragSofa(page)
    await expectSofaMoved(page)
    await page.mouse.click(200, 600)
    await expect(undoButton(page)).toHaveAttribute('title', 'Undo move Sofa')

    await page.keyboard.press('Control+z')
    await expectSofaAtStart(page)
    await expect(status(page)).toHaveText(/^Sofa selected\./)
    await expect(redoButton(page)).toHaveAttribute('title', 'Redo move Sofa')

    await page.keyboard.press('Control+Shift+z')
    await expectSofaMoved(page)

    await page.keyboard.press('Control+z')
    await expectSofaAtStart(page)
    await page.keyboard.press('Control+y')
    await expectSofaMoved(page)
  })

  test('the buttons undo and redo deleting an item', async ({ page }) => {
    await page.keyboard.press('Delete')
    await expectFurnitureAt(page, 640, 360, false)

    await undoButton(page).click()
    await expectSofaAtStart(page)
    await expect(status(page)).toHaveText(/^Sofa selected\./)

    await redoButton(page).click()
    await expectFurnitureAt(page, 640, 360, false)
    await expect(redoButton(page)).toBeDisabled()
  })

  test('undoing a plan replacement brings back the plan and its furniture', async ({
    page,
  }) => {
    await pickFile(page, tallPlan)
    const dialog = page.getByRole('dialog', {
      name: 'Replace the current plan?',
    })
    await dialog.getByRole('button', { name: 'Replace' }).click()
    await expectTallPlanFitted(page)

    await undoButton(page).click()
    await expectWidePlanFitted(page)
    await expectSofaAtStart(page)

    await redoButton(page).click()
    await expectTallPlanFitted(page)
    await expectFurnitureAt(page, 640, 360, false)

    await undoButton(page).click()
    await expectWidePlanFitted(page)
  })

  test('shortcuts leave a text field and an open dialog alone', async ({
    page,
  }) => {
    await dragSofa(page)

    const name = panel(page).getByLabel('Name')
    await name.fill('Couch')
    await name.press('Control+z')
    await expectSofaMoved(page)

    await name.press('Escape')
    await page.getByRole('button', { name: 'Add furniture' }).click()
    const form = page.getByRole('dialog', { name: 'Add furniture' })
    await page.keyboard.press('Control+z')
    await form.getByRole('button', { name: 'Cancel' }).click()
    await expectSofaMoved(page)
  })

  test('shortcuts are ignored in the middle of a drag', async ({ page }) => {
    await page.mouse.move(600, 380)
    await page.mouse.down()
    await page.mouse.move(650, 430, { steps: 5 })
    await page.keyboard.press('Control+z')
    await page.mouse.move(700, 480, { steps: 5 })
    await page.mouse.up()

    await expectSofaMoved(page)
    await expect(undoButton(page)).toHaveAttribute('title', 'Undo move Sofa')
  })

  test('with calibration points placed, Ctrl+Z only leaves the calibrate tool', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Recalibrate' }).click()
    await page.mouse.click(320, 360)

    await page.keyboard.press('Control+z')

    await expect(
      page.getByRole('button', { name: 'Recalibrate' }),
    ).toHaveAttribute('aria-pressed', 'false')
    await expectSofaAtStart(page)
    await expect(undoButton(page)).toHaveAttribute('title', 'Undo add Sofa')
  })

  test('undo keeps the measuring tape and its measurement', async ({
    page,
  }) => {
    await dragSofa(page)
    const measure = page.getByRole('button', { name: 'Measure' })
    await measure.click()
    await page.mouse.click(100, 650)
    await page.mouse.click(260, 650)
    await expect(status(page)).toHaveText(/^Distance: 1\.00 m\./)

    await page.keyboard.press('Control+z')

    await expectSofaAtStart(page)
    await expect(measure).toHaveAttribute('aria-pressed', 'true')
    await expect(status(page)).toHaveText(/^Distance: 1\.00 m\./)
  })
})
