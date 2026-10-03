import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  canvasDrawn,
  expectFurnitureAt,
  expectPlanColour,
  pickFile,
  tallPlan,
  widePlan,
} from '../plan.ts'
import { fingers } from './fingers.ts'

// A phone in portrait. The wide plan (400×200 px) is fitted at 0.975× into
// the 784 px above the 60 px bottom bar, its top at y = 294.5: screen
// (97.5, 392) is plan (100, 100) and screen (292.5, 392) is plan (300, 100)
test.use({ viewport: { width: 390, height: 844 } })

const bottomBar = (page: Page) => page.locator('.bottom-bar')
const lengthDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'How long is this line?' })
const addDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Add furniture' })

const box = async (locator: Locator) => (await locator.boundingBox())!

/**
 * Calibrate at 50 plan px per metre: plan (100, 100) to (300, 100), at
 * screen y = `y`, is 4 m.
 */
const calibrate = async (page: Page, y = 392) => {
  await bottomBar(page).getByRole('button', { name: 'Calibrate' }).click()
  await page.touchscreen.tap(97.5, y)
  await page.touchscreen.tap(292.5, y)
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

/**
 * A 2 m × 1 m sofa, selected, mid-view above its expanded sheet (top at
 * y ≈ 500): screen (195, 250).
 */
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

test('a selected item’s status says Delete item is in the ⋯ menu', async ({
  page,
}) => {
  await pickFile(page, widePlan)
  await calibrate(page)
  await addSofa(page)

  await expect(page.getByRole('status')).toHaveText(
    'Sofa selected. Tap ⋯ › Delete item to remove it.',
  )
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

/** Whether a project is saved in the browser. */
const projectSaved = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<boolean>((resolve, reject) => {
        const open = indexedDB.open('flat-sim')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          if (!db.objectStoreNames.contains('projects')) {
            db.close()
            return resolve(false)
          }
          const get = db
            .transaction('projects')
            .objectStore('projects')
            .getKey('current')
          get.onsuccess = () => {
            db.close()
            resolve(get.result !== undefined)
          }
          get.onerror = () => reject(get.error)
        }
      }),
  )

/** Fit the plan to the screen from the ⋯ menu. */
const fitToScreen = async (page: Page) => {
  await more(page).click()
  await menu(page).getByRole('menuitem', { name: 'Fit to screen' }).click()
  await expect(menu(page)).toBeHidden()
}

/**
 * That the plan, solid green and centred, ends just above `bottom`: drawn
 * there and at the top of the screen, but not below it.
 */
const expectPlanEndsAt = async (page: Page, bottom: number) => {
  await expectPlanColour(page, 195, 2, 'green')
  await expectPlanColour(page, 195, bottom - 2, 'green')
  await expectPlanColour(page, 195, bottom + 2, 'none')
}

const barTop = async (page: Page) => (await box(bottomBar(page))).y

test('an opened plan fits above the bar, and so does Fit to screen', async ({
  page,
}) => {
  // Tall enough that fitting it to the whole screen would put its foot under
  // the bar
  await pickFile(page, tallPlan)

  await expectPlanEndsAt(page, await barTop(page))

  // Dragged away, Fit to screen brings it back
  const touch = await fingers(page)
  const finger = await touch.down([195, 300])
  await touch.move({ [finger]: [195, 100] })
  await touch.up(finger)
  await expectPlanColour(page, 195, (await barTop(page)) - 2, 'none')
  await fitToScreen(page)

  await expectPlanEndsAt(page, await barTop(page))
})

test('a replacing plan, and one undo or redo brings back, fit above the bar', async ({
  page,
}) => {
  await pickFile(page, widePlan)
  await pickFile(page, tallPlan)
  await page
    .getByRole('dialog', { name: 'Replace the current plan?' })
    .getByRole('button', { name: 'Replace' })
    .click()

  await expectPlanEndsAt(page, await barTop(page))

  await bottomBar(page).getByRole('button', { name: 'Undo' }).click()
  await expectPlanColour(page, 195, 2, 'none')
  await more(page).click()
  await menu(page).getByRole('menuitem', { name: 'Redo' }).click()

  await expectPlanEndsAt(page, await barTop(page))
})

test('a restored plan fits above the bar', async ({ page }) => {
  await pickFile(page, tallPlan)
  await expectPlanEndsAt(page, await barTop(page))
  // Saved once changes pause
  await expect.poll(() => projectSaved(page)).toBe(true)

  await page.reload()

  await expectPlanEndsAt(page, await barTop(page))
})

test('Fit to screen leaves the expanded sheet clear of the plan', async ({
  page,
}) => {
  await pickFile(page, tallPlan)
  await calibrate(page)
  await addSofa(page)

  await fitToScreen(page)

  await expectPlanEndsAt(page, (await box(itemPanel(page))).y)

  // Collapsed, the sheet is out of the way: only the bar counts
  await itemPanel(page).getByRole('button', { name: 'Sofa' }).tap()
  await fitToScreen(page)

  await expectPlanEndsAt(page, await barTop(page))
})

test.describe('on a short phone', () => {
  // The wide plan is fitted at 0.975× into the 540 px above the bar, its top
  // at y = 172.5: plan (100, 100) and (300, 100) are at screen y = 270
  test.use({ viewport: { width: 390, height: 600 } })

  test('a new item lands in the middle of the screen above the expanded sheet', async ({
    page,
  }) => {
    await pickFile(page, widePlan)
    await calibrate(page, 270)

    await addSofa(page)

    await expect(
      itemPanel(page).getByRole('button', { name: 'Sofa' }),
    ).toHaveAttribute('aria-expanded', 'true')
    const sheetTop = (await box(itemPanel(page))).y
    // Deselected, so only the item itself is drawn
    await page.touchscreen.tap(40, 30)
    await expect(itemPanel(page)).toBeHidden()
    // 2 m × 1 m at 50 px per metre and 0.975×: 48.75 px deep, centred in
    // the part of the screen above the sheet (not above the bar, y = 270)
    const middle = sheetTop / 2
    await expectFurnitureAt(page, 195, middle - 22)
    await expectFurnitureAt(page, 195, middle + 22)
    await expectFurnitureAt(page, 195, middle - 28, false)
    await expectFurnitureAt(page, 195, middle + 28, false)
  })
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

/** Expect `dialog` to fill the screen, its buttons finger-sized and on it. */
const expectFullScreen = async (
  dialog: Locator,
  buttons: string[],
  height = 844,
) => {
  expect(await box(dialog)).toEqual({ x: 0, y: 0, width: 390, height })
  for (const name of buttons) {
    const button = await box(dialog.getByRole('button', { name, exact: true }))
    expect(button.height).toBeGreaterThanOrEqual(44)
    expect(button.x).toBeGreaterThanOrEqual(0)
    expect(button.x + button.width).toBeLessThanOrEqual(390)
    expect(button.y + button.height).toBeLessThanOrEqual(height)
  }
}

test('the length, add furniture and confirm dialogs fill the screen', async ({
  page,
}) => {
  await pickFile(page, widePlan)
  await bottomBar(page).getByRole('button', { name: 'Calibrate' }).click()
  await page.touchscreen.tap(97.5, 392)
  await page.touchscreen.tap(292.5, 392)
  await expectFullScreen(lengthDialog(page), ['Cancel', 'Set scale'])
  await lengthDialog(page).getByLabel('Length').fill('4')
  await lengthDialog(page).getByRole('button', { name: 'Set scale' }).click()

  await bottomBar(page).getByRole('button', { name: 'Add item' }).click()
  await expectFullScreen(addDialog(page), ['Cancel', 'Add'])
  // Its buttons look like the other dialogs', not like the bar's
  const fontSize = (name: string) =>
    addDialog(page)
      .getByRole('button', { name, exact: true })
      .evaluate((b) => getComputedStyle(b).fontSize)
  expect(await fontSize('Add')).toBe('16px')
  await addDialog(page).getByRole('button', { name: 'Cancel' }).click()

  await more(page).click()
  await menu(page).getByRole('menuitem', { name: 'New project' }).click()
  await expectFullScreen(
    page.getByRole('dialog', { name: 'Start a new project?' }),
    ['Cancel', 'Start new project'],
  )
})

test('presets are picked, saved and deleted by finger in the full-screen form', async ({
  page,
}) => {
  await pickFile(page, widePlan)
  await calibrate(page)
  await bottomBar(page).getByRole('button', { name: 'Add item' }).click()
  const form = addDialog(page)
  const preset = form.getByLabel('Preset')

  await preset.selectOption('Desk (140 × 70 cm)')
  await expect(form.getByLabel('Width (cm)')).toHaveValue('140')
  await form.getByLabel('Name').fill('Standing desk')
  await form.getByRole('button', { name: 'Save as preset' }).tap()
  await expect(preset.locator('option:checked')).toHaveText(
    'Standing desk (140 × 70 cm)',
  )

  // Every control fits the screen and a finger
  for (const control of [
    preset,
    form.getByRole('button', { name: 'Delete preset' }),
    form.getByRole('button', { name: 'Save as preset' }),
  ]) {
    const { x, width, height } = await box(control)
    expect(height).toBeGreaterThanOrEqual(44)
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x + width).toBeLessThanOrEqual(390)
  }

  await form.getByRole('button', { name: 'Delete preset' }).tap()
  await expect(
    preset.getByRole('option', { name: /^Standing desk/ }),
  ).toHaveCount(0)
  await form.getByRole('button', { name: 'Add', exact: true }).tap()
  await expect(form).toBeHidden()
  await expect(page.getByRole('status')).toHaveText(/^Standing desk selected/)
})

test('from 600 px wide dialogs stay a card in the middle', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 844 })
  await pickFile(page, widePlan)
  await page
    .locator('.toolbar')
    .getByRole('button', { name: 'New project' })
    .click()

  const dialog = await box(
    page.getByRole('dialog', { name: 'Start a new project?' }),
  )
  expect(dialog.width).toBeLessThan(600 - 32)
  expect(dialog.height).toBeLessThan(844 / 2)
  expect(dialog.x + dialog.width / 2).toBeCloseTo(300, 0)
  expect(dialog.y + dialog.height / 2).toBeCloseTo(422, 0)
})

test('the selected item’s panel is a sheet on the bar, under the status', async ({
  page,
}) => {
  await pickFile(page, widePlan)
  await calibrate(page)
  await addSofa(page)

  const sheet = await box(itemPanel(page))
  const bar = await box(bottomBar(page))
  const status = await box(page.getByRole('status'))
  // Full width, sitting on the bar, with the status clear above it
  expect(sheet.x).toBe(0)
  expect(sheet.width).toBe(390)
  expect(sheet.y + sheet.height).toBeLessThanOrEqual(bar.y)
  expect(sheet.y + sheet.height).toBeGreaterThan(bar.y - 12)
  expect(status.y + status.height).toBeLessThanOrEqual(sheet.y)
  // Opens expanded, its fields finger-sized
  for (const label of ['Name', 'Width (cm)', 'Depth (cm)', 'Rotation (°)']) {
    const field = await box(itemPanel(page).getByLabel(label))
    expect(field.height).toBeGreaterThanOrEqual(44)
    expect(field.y).toBeGreaterThanOrEqual(sheet.y)
    expect(field.y + field.height).toBeLessThanOrEqual(sheet.y + sheet.height)
  }
})

test('the sheet collapses to its title row and expands again', async ({
  page,
}) => {
  await pickFile(page, widePlan)
  await calibrate(page)
  await addSofa(page)
  const title = itemPanel(page).getByRole('button', { name: 'Sofa' })
  await expect(title).toHaveAttribute('aria-expanded', 'true')

  await title.tap()

  await expect(title).toHaveAttribute('aria-expanded', 'false')
  await expect(itemPanel(page).getByLabel('Width (cm)')).toBeHidden()
  // Just the title row, a finger's height, still on the bar
  const row = await box(title)
  const sheet = await box(itemPanel(page))
  const bar = await box(bottomBar(page))
  expect(row.height).toBeGreaterThanOrEqual(44)
  expect(sheet.height).toBeLessThan(row.height + 40)
  expect(sheet.y + sheet.height).toBeGreaterThan(bar.y - 12)
  expect(sheet.y + sheet.height).toBeLessThanOrEqual(bar.y)

  await title.tap()

  await expect(title).toHaveAttribute('aria-expanded', 'true')
  await expect(itemPanel(page).getByLabel('Width (cm)')).toHaveValue('200')

  // Another selection opens expanded again
  await title.tap()
  await page.touchscreen.tap(40, 250)
  await expect(itemPanel(page)).toBeHidden()
  await page.touchscreen.tap(195, 250)
  await expect(title).toHaveAttribute('aria-expanded', 'true')
})

test.describe('with the on-screen keyboard', () => {
  // Chromium opens no on-screen keyboard, so stand in for the visual viewport:
  // opening a keyboard shrinks it and leaves the page (the layout viewport) as
  // it is, as `interactive-widget=resizes-visual` asks of a phone browser
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const visual = Object.assign(new EventTarget(), {
        offsetTop: 0,
        offsetLeft: 0,
        scale: 1,
        get width() {
          return window.innerWidth
        },
        height: window.innerHeight,
      })
      Object.defineProperty(window, 'visualViewport', { value: visual })
      Object.assign(window, {
        showKeyboard: (height: number) => {
          visual.height = window.innerHeight - height
          visual.dispatchEvent(new Event('resize'))
        },
      })
    })
    await page.reload()
  })

  const showKeyboard = (page: Page, height: number) =>
    page.evaluate(
      (height) =>
        (
          window as unknown as { showKeyboard: (height: number) => void }
        ).showKeyboard(height),
      height,
    )

  test('the sheet rises above it, and the canvas keeps its size', async ({
    page,
  }) => {
    await pickFile(page, widePlan)
    await calibrate(page)
    await addSofa(page)
    const width = itemPanel(page).getByLabel('Width (cm)')
    await width.tap()

    await showKeyboard(page, 300)

    // The sheet sits on the keyboard, the field being typed in in view; the
    // bar is out of the way beneath the keyboard
    await expect
      .poll(async () => {
        const sheet = await box(itemPanel(page))
        return sheet.y + sheet.height
      })
      .toBe(844 - 300)
    const field = await box(width)
    expect(field.y + field.height).toBeLessThanOrEqual(844 - 300)
    expect((await box(bottomBar(page))).y).toBeGreaterThanOrEqual(844 - 300)
    await expect(width).toBeFocused()
    // The canvas neither shrinks nor moves: the view stays where it was
    const canvas = await box(page.locator('canvas').first())
    expect(canvas).toEqual({ x: 0, y: 0, width: 390, height: 844 })
    await expectPlanColour(page, 97.5, 392, 'red')

    // Closing it puts the sheet back on the bar
    await showKeyboard(page, 0)
    await expect
      .poll(async () => (await box(bottomBar(page))).y)
      .toBeLessThan(844 - 44)
    const sheet = await box(itemPanel(page))
    const bar = await box(bottomBar(page))
    expect(sheet.y + sheet.height).toBeLessThanOrEqual(bar.y)
    expect(sheet.y + sheet.height).toBeGreaterThan(bar.y - 12)
  })

  test('a full-screen dialog ends at it, its buttons above it', async ({
    page,
  }) => {
    await pickFile(page, widePlan)
    await bottomBar(page).getByRole('button', { name: 'Calibrate' }).click()
    await page.touchscreen.tap(97.5, 392)
    await page.touchscreen.tap(292.5, 392)
    const length = lengthDialog(page).getByLabel('Length')
    await length.tap()

    await showKeyboard(page, 300)

    await expect
      .poll(async () => (await box(lengthDialog(page))).height)
      .toBe(844 - 300)
    await expectFullScreen(lengthDialog(page), ['Cancel', 'Set scale'], 544)
    await expect(length).toBeFocused()
    const field = await box(length)
    expect(field.y + field.height).toBeLessThanOrEqual(544)
    await length.fill('4')
    await lengthDialog(page).getByRole('button', { name: 'Set scale' }).tap()
    await expect(lengthDialog(page)).toBeHidden()

    // The add furniture form too, though it opens from inside the bar
    await showKeyboard(page, 0)
    await bottomBar(page).getByRole('button', { name: 'Add item' }).click()
    await showKeyboard(page, 300)
    await expect
      .poll(async () => (await box(addDialog(page))).height)
      .toBe(844 - 300)
    await expectFullScreen(addDialog(page), ['Cancel', 'Add'], 544)

    // Closing the keyboard gives the dialog the whole screen again
    await showKeyboard(page, 0)
    await expect.poll(async () => (await box(addDialog(page))).height).toBe(844)
  })
})
