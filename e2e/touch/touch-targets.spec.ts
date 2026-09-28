import { expect, test, type Locator, type Page } from '@playwright/test'
import { canvasDrawn, expectFurnitureAt, pickFile, widePlan } from '../plan.ts'
import { fingers } from './fingers.ts'

// A tablet in portrait. The wide plan (400×200 px) is fitted at 1.92× with
// its top at y = 320: screen (192, 512) is plan (100, 100), screen (576, 512)
// is plan (300, 100) and the view's centre, (384, 512), is plan (200, 100)
test.use({ viewport: { width: 768, height: 1024 } })

const toolbarButtons = (page: Page) =>
  page.locator('.toolbar').getByRole('button')
const lengthDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'How long is this line?' })
const addDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Add furniture' })

const box = async (locator: Locator) => (await locator.boundingBox())!

/** Every control in `scope` is at least 44 px tall and wide. */
const expectTouchSized = async (controls: Locator) => {
  const all = await controls.all()
  expect(all.length).toBeGreaterThan(0)
  for (const control of all) {
    const { width, height } = await box(control)
    const name = await control.textContent()
    expect(width, `${name} is wide enough`).toBeGreaterThanOrEqual(44)
    expect(height, `${name} is tall enough`).toBeGreaterThanOrEqual(44)
  }
}

/** Calibrate at 50 plan px per metre: plan (100, 100) to (300, 100) is 4 m. */
const calibrate = async (page: Page) => {
  await page.getByRole('button', { name: 'Calibrate scale' }).click()
  await page.touchscreen.tap(192, 512)
  await page.touchscreen.tap(576, 512)
  await lengthDialog(page).getByLabel('Length').fill('4')
  await lengthDialog(page).getByRole('button', { name: 'Set scale' }).click()
  await expect(lengthDialog(page)).toBeHidden()
}

/** A 2 m × 1 m sofa in the view's centre: screen x 288–480, y 464–560. */
const addSofa = async (page: Page) => {
  await page.getByRole('button', { name: 'Add furniture' }).click()
  await addDialog(page).getByLabel('Name').fill('Sofa')
  await addDialog(page).getByLabel('Width (cm)').fill('200')
  await addDialog(page).getByLabel('Depth (cm)').fill('100')
  await addDialog(page)
    .getByRole('button', { name: 'Add', exact: true })
    .click()
  await expect(addDialog(page)).toBeHidden()
  // Drawn, so a finger on it finds it
  await canvasDrawn(page)
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await pickFile(page, widePlan)
  await calibrate(page)
})

test('toolbar buttons are big enough for a finger', async ({ page }) => {
  await addSofa(page)

  await expectTouchSized(toolbarButtons(page))
})

test('dialog controls are big enough for a finger', async ({ page }) => {
  await page.getByRole('button', { name: 'Recalibrate' }).click()
  await page.touchscreen.tap(192, 512)
  await page.touchscreen.tap(576, 512)

  await expectTouchSized(lengthDialog(page).locator('input, select, button'))

  await lengthDialog(page).getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: 'Add furniture' }).click()

  await expectTouchSized(addDialog(page).locator('input, button'))
})

test('a finger turns an item by the rotate handle, even slightly off it', async ({
  page,
}) => {
  await addSofa(page)
  const touch = await fingers(page)

  // The handle sits 60 px above the sofa's top edge; a finger 20 px beside
  // its centre still takes it. Turned a quarter, the sofa no longer reaches
  // its old left end at x 300
  const a = await touch.down([404, 404])
  await touch.move({ [a]: [534, 512] }, 10)
  await touch.up(a)

  await expectFurnitureAt(page, 300, 512, false)
  await expect(page.getByLabel('Rotation (°)')).toHaveValue('90')
})

test('the toolbar wraps onto a second row rather than overflow', async ({
  page,
}) => {
  await addSofa(page)

  const boxes = await Promise.all(
    (await toolbarButtons(page).all()).map((button) => box(button)),
  )
  for (const { x, width, height } of boxes) {
    expect(x).toBeGreaterThanOrEqual(12)
    expect(x + width).toBeLessThanOrEqual(768 - 12)
    // One line of text each, none squeezed onto two
    expect(height).toBe(44)
  }
  expect(new Set(boxes.map(({ y }) => y)).size).toBe(2)
})

test('the item panel fits beside the canvas, below the toolbar', async ({
  page,
}) => {
  await addSofa(page)
  const panel = page.getByRole('complementary', { name: 'Selected item' })

  await expectTouchSized(panel.getByRole('textbox'))
  const { x, y, width, height } = await box(panel)
  // On the right, leaving most of the plan in view
  expect(x).toBeGreaterThanOrEqual(768 / 2)
  expect(x + width).toBeLessThanOrEqual(768 - 12)
  expect(y + height).toBeLessThanOrEqual(1024 - 12)
  const buttonBottoms = await Promise.all(
    (await toolbarButtons(page).all()).map(async (button) => {
      const { y, height } = await box(button)
      return y + height
    }),
  )
  expect(y).toBeGreaterThan(Math.max(...buttonBottoms))
})
