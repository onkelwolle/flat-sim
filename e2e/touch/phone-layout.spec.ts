import { expect, test, type Locator, type Page } from '@playwright/test'
import { canvasDrawn, pickFile, widePlan } from '../plan.ts'

// A phone in portrait. The wide plan (400×200 px) is fitted at 0.975× with
// its top at y = 324.5: screen (97.5, 422) is plan (100, 100) and screen
// (292.5, 422) is plan (300, 100)
test.use({ viewport: { width: 390, height: 844 } })

const bottomBar = (page: Page) => page.locator('.bottom-bar')
const lengthDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'How long is this line?' })
const addDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Add furniture' })

const box = async (locator: Locator) => (await locator.boundingBox())!

/** Calibrate at 50 plan px per metre: plan (100, 100) to (300, 100) is 4 m. */
const calibrate = async (page: Page) => {
  await bottomBar(page).getByRole('button', { name: 'Calibrate' }).click()
  await page.touchscreen.tap(97.5, 422)
  await page.touchscreen.tap(292.5, 422)
  await lengthDialog(page).getByLabel('Length').fill('4')
  await lengthDialog(page).getByRole('button', { name: 'Set scale' }).click()
  await expect(lengthDialog(page)).toBeHidden()
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
})

test('a bottom bar with the main tools replaces the toolbar', async ({
  page,
}) => {
  await pickFile(page, widePlan)
  await calibrate(page)

  await expect(page.locator('.toolbar')).toHaveCount(0)
  const buttons = bottomBar(page).getByRole('button')
  await expect(buttons).toHaveText([
    'Recalibrate',
    'Measure',
    'Add item',
    'Undo',
    '⋯',
  ])
  const bar = await box(bottomBar(page))
  expect(bar.y + bar.height).toBe(844)
  for (const button of await buttons.all()) {
    const { x, y, width, height } = await box(button)
    // Big enough for a finger, all on one row inside the screen
    expect(width).toBeGreaterThanOrEqual(44)
    expect(height).toBe(44)
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x + width).toBeLessThanOrEqual(390)
    expect(y).toBeGreaterThan(bar.y)
  }
})

const more = (page: Page) => page.getByRole('button', { name: 'More' })
const menu = (page: Page) => page.getByRole('menu', { name: 'More' })
const itemPanel = (page: Page) =>
  page.getByRole('complementary', { name: 'Selected item' })

/** A 2 m × 1 m sofa in the view's centre, selected: screen (195, 422). */
const addSofa = async (page: Page) => {
  await bottomBar(page).getByRole('button', { name: 'Add item' }).click()
  await addDialog(page).getByLabel('Name').fill('Sofa')
  await addDialog(page).getByLabel('Width (cm)').fill('200')
  await addDialog(page).getByLabel('Depth (cm)').fill('100')
  await addDialog(page)
    .getByRole('button', { name: 'Add', exact: true })
    .click()
  await expect(addDialog(page)).toBeHidden()
  await canvasDrawn(page)
}

test('the ⋯ menu holds the other commands; Delete needs a selection', async ({
  page,
}) => {
  await pickFile(page, widePlan)
  await calibrate(page)

  await more(page).click()
  await expect(more(page)).toHaveAttribute('aria-expanded', 'true')
  const items = menu(page).getByRole('menuitem')
  await expect(items).toHaveText([
    'Open plan…',
    'New project',
    'Redo',
    'Fit to screen',
    'Delete item',
  ])
  await expect(items.filter({ hasText: 'Redo' })).toBeDisabled()
  await expect(items.filter({ hasText: 'Delete item' })).toBeDisabled()
  // Touch-sized, and above the bar
  const bar = await box(bottomBar(page))
  for (const item of await items.all()) {
    const { x, y, width, height } = await box(item)
    expect(height).toBeGreaterThanOrEqual(44)
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x + width).toBeLessThanOrEqual(390)
    expect(y + height).toBeLessThanOrEqual(bar.y)
  }

  // Tapping ⋯ again closes it
  const { x, y, width, height } = await box(more(page))
  await page.touchscreen.tap(x + width / 2, y + height / 2)
  await expect(menu(page)).toBeHidden()
  await addSofa(page)
  await more(page).click()
  await menu(page).getByRole('menuitem', { name: 'Delete item' }).click()

  // Chosen, the command runs and the menu closes
  await expect(menu(page)).toBeHidden()
  await expect(itemPanel(page)).toBeHidden()

  // Undo the delete, then the add; Redo adds the sofa again
  await bottomBar(page).getByRole('button', { name: 'Undo' }).click()
  await expect(itemPanel(page)).toBeVisible()
  await bottomBar(page).getByRole('button', { name: 'Undo' }).click()
  await expect(itemPanel(page)).toBeHidden()
  await more(page).click()
  await menu(page).getByRole('menuitem', { name: 'Redo' }).click()
  await expect(itemPanel(page)).toBeVisible()
})

test('a tap outside the ⋯ menu or Esc closes it, and does nothing else', async ({
  page,
}) => {
  await pickFile(page, widePlan)
  await calibrate(page)
  await addSofa(page)

  // Empty canvas left of the item panel, above the plan: a tap there would
  // otherwise select nothing
  await more(page).click()
  await page.touchscreen.tap(40, 250)
  await expect(menu(page)).toBeHidden()
  await expect(more(page)).toHaveAttribute('aria-expanded', 'false')
  await expect(itemPanel(page)).toBeVisible()

  // Esc would otherwise select nothing too
  await more(page).click()
  await page.keyboard.press('Escape')
  await expect(menu(page)).toBeHidden()
  await expect(itemPanel(page)).toBeVisible()
})

test('the ⋯ menu works by keyboard', async ({ page }) => {
  await pickFile(page, widePlan)
  await calibrate(page)
  const item = (name: string) =>
    menu(page).getByRole('menuitem', { name, exact: true })

  await more(page).focus()
  await page.keyboard.press('Enter')

  // Opens on its first command; the arrows skip commands not available now
  await expect(item('Open plan…')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(item('New project')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(item('Fit to screen')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(item('Open plan…')).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(item('Fit to screen')).toBeFocused()
  await page.keyboard.press('Home')
  await expect(item('Open plan…')).toBeFocused()
  await page.keyboard.press('End')
  await expect(item('Fit to screen')).toBeFocused()

  // Esc hands focus back to the button
  await page.keyboard.press('Escape')
  await expect(menu(page)).toBeHidden()
  await expect(more(page)).toBeFocused()

  // A command runs from the keyboard too
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(menu(page)).toBeHidden()
  await expect(
    page.getByRole('dialog', { name: 'Start a new project?' }),
  ).toBeVisible()
})

test('the status sits above the bar, wrapping rather than overflowing', async ({
  page,
}) => {
  await pickFile(page, widePlan)
  await calibrate(page)
  await bottomBar(page).getByRole('button', { name: 'Measure' }).click()

  const status = page.getByRole('status')
  await expect(status).toHaveText(/drag between them, to measure\.$/)
  const { x, y, width, height } = await box(status)
  const bar = await box(bottomBar(page))
  expect(x).toBeGreaterThanOrEqual(12)
  expect(x + width).toBeLessThanOrEqual(390 - 12)
  expect(y + height).toBeLessThanOrEqual(bar.y)
  // Too long for one line at this width: taller than a line and its padding
  const fontSize = await status.evaluate((p) =>
    parseFloat(getComputedStyle(p).fontSize),
  )
  expect(height).toBeGreaterThan(2.5 * fontSize)
})

test('before there is a plan, the bar offers to open one', async ({ page }) => {
  await expect(bottomBar(page).getByRole('button')).toHaveText(['Open plan…'])
})

test('from 600 px wide the toolbar stays at the top', async ({ page }) => {
  await pickFile(page, widePlan)
  await calibrate(page)

  await page.setViewportSize({ width: 600, height: 844 })

  await expect(bottomBar(page)).toHaveCount(0)
  await expect(
    page.locator('.toolbar').getByRole('button', { name: 'Fit to screen' }),
  ).toBeVisible()
})
