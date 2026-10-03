import { expect, test, type Page } from '@playwright/test'
import {
  canvasDrawn,
  type DimensionLabel,
  expectDimensionLabelAt,
  expectFurnitureAt,
  expectNoDimensionLabel,
  expectPlanColour,
  expectWidePlanFitted,
  pickFile,
  tallPlan,
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
  // Drawn, so a press on it finds it
  await canvasDrawn(page)
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

  test('the form stays open, values and all, across the phone breakpoint', async ({
    page,
  }) => {
    await addButton(page).click()
    const form = formDialog(page)
    await form.getByLabel('Name').fill('Desk')
    await form.getByLabel('Width (cm)').fill('120')
    await form.getByLabel('Depth (cm)').fill('60')

    const expectFormAsTyped = async () => {
      await expect(form).toBeVisible()
      await expect(form.getByLabel('Name')).toHaveValue('Desk')
      await expect(form.getByLabel('Width (cm)')).toHaveValue('120')
      await expect(form.getByLabel('Depth (cm)')).toHaveValue('60')
    }

    // Narrowed to a phone, then widened again, each time once the tools have
    // moved
    await page.setViewportSize({ width: 390, height: 720 })
    await expect(page.locator('.bottom-bar')).toBeAttached()
    await expectFormAsTyped()
    await page.setViewportSize({ width: 1280, height: 720 })
    await expect(page.locator('.toolbar')).toBeAttached()
    await expectFormAsTyped()

    // And it still adds the item, centred in the view
    await form.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(form).toBeHidden()
    await canvasDrawn(page)
    await expectFurnitureAt(page, 640, 360, true)
  })

  test('the form opens with the last values added, selected for typing over', async ({
    page,
  }) => {
    await addButton(page).click()
    const form = formDialog(page)
    await expect(form.getByLabel('Name')).toHaveValue('')
    await form.getByRole('button', { name: 'Cancel' }).click()

    await addFurniture(page, 'Chair', '45', '50')

    await addButton(page).click()
    await expect(form.getByLabel('Name')).toHaveValue('Chair')
    await expect(form.getByLabel('Width (cm)')).toHaveValue('45')
    await expect(form.getByLabel('Depth (cm)')).toHaveValue('50')

    // The first field is focused with its text selected, as is each field
    // tabbed to or clicked, so typing replaces the old value
    await expect(form.getByLabel('Name')).toBeFocused()
    await page.keyboard.type('Stool')
    await page.keyboard.press('Tab')
    await page.keyboard.type('40')
    await page.keyboard.press('Tab')
    await page.keyboard.type('40')
    await form.getByLabel('Width (cm)').click()
    await page.keyboard.type('60')
    await expect(form.getByLabel('Name')).toHaveValue('Stool')
    await expect(form.getByLabel('Width (cm)')).toHaveValue('60')
    await expect(form.getByLabel('Depth (cm)')).toHaveValue('40')

    // Cancelling keeps the values last added
    await form.getByRole('button', { name: 'Cancel' }).click()
    await addButton(page).click()
    await expect(form.getByLabel('Name')).toHaveValue('Chair')
    await form.getByRole('button', { name: 'Cancel' }).click()

    // A reload starts empty again
    await page.reload()
    await pickFile(page, widePlan)
    await expectWidePlanFitted(page)
    await calibrate(page, '4')
    await addButton(page).click()
    await expect(form.getByLabel('Name')).toHaveValue('')
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

  test('Esc deselects the selected item', async ({ page }) => {
    await addFurniture(page, 'Sofa', '200', '100')

    await page.keyboard.press('Escape')

    await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')
    await expect(deleteButton(page)).toBeHidden()
    await expectFurnitureAt(page, 485, 285)
  })

  test('the Delete key deletes the selected item', async ({ page }) => {
    await addFurniture(page, 'Sofa', '200', '100')

    await expect(status(page)).toHaveText(
      'Sofa selected. Press Delete to remove it.',
    )
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

test.describe('moving and rotating', () => {
  test.beforeEach(async ({ page }) => {
    // 50 plan px per metre; a 200 × 100 cm sofa is 320 × 160 screen px
    // around (640, 360)
    await calibrate(page, '4')
    await addFurniture(page, 'Sofa', '200', '100')
  })

  test('dragging an item moves it, not the view', async ({ page }) => {
    await page.mouse.click(200, 600)

    await page.mouse.move(600, 380)
    await page.mouse.down()
    await page.mouse.move(700, 480, { steps: 5 })
    await page.mouse.up()

    // Moved 100 px right and down; the plan stayed where it was
    await expectFurnitureAt(page, 585, 385)
    await expectFurnitureAt(page, 895, 535)
    await expectFurnitureAt(page, 575, 385, false)
    await expectFurnitureAt(page, 905, 535, false)
    await expectWidePlanFitted(page)
    await expect(status(page)).toHaveText(/^Sofa selected\./)
  })

  test('dragging an item with space held pans the view instead', async ({
    page,
  }) => {
    await page.keyboard.down('Space')
    await page.mouse.move(600, 380)
    await page.mouse.down()
    await page.mouse.move(700, 480, { steps: 5 })
    await page.mouse.up()
    await page.keyboard.up('Space')

    // The plan moved with the sofa: its red half now reaches x = 740
    await expectPlanColour(page, 730, 450, 'red')
    await expectFurnitureAt(page, 585, 385)
    await expectFurnitureAt(page, 895, 535)
    await expectFurnitureAt(page, 575, 385, false)
  })

  test('shows a move cursor over an item', async ({ page }) => {
    const stage = page.locator('div:has(> .konvajs-content)')

    await page.mouse.move(600, 380, { steps: 5 })
    await expect(stage).toHaveCSS('cursor', 'move')

    await page.mouse.move(200, 600)
    await expect(stage).not.toHaveCSS('cursor', 'move')
  })

  // The rotate handle sits 50 px above the selected item's top edge
  const rotateHandle = { x: 640, y: 230 }

  /** Drag the rotate handle to `deg` clockwise from straight up. */
  const dragHandleTo = async (page: Page, deg: number) => {
    const rad = (deg * Math.PI) / 180
    await page.mouse.move(rotateHandle.x, rotateHandle.y)
    await page.mouse.down()
    await page.mouse.move(
      640 + 150 * Math.sin(rad),
      360 - 150 * Math.cos(rad),
      {
        steps: 10,
      },
    )
    await page.mouse.up()
  }

  // Turned a quarter, the sofa is 160 × 320 px: (718, 203) is just inside
  // its top-right corner; at 85° that corner has swung away from it
  const corner = { x: 718, y: 203 }

  test('the rotate handle turns an item in 15° steps', async ({ page }) => {
    await dragHandleTo(page, 85)

    await expectFurnitureAt(page, corner.x, corner.y)
    await expectFurnitureAt(page, 500, 360, false)
  })

  test('holding Shift rotates an item freely', async ({ page }) => {
    await page.keyboard.down('Shift')
    await dragHandleTo(page, 85)
    await page.keyboard.up('Shift')

    await expectFurnitureAt(page, corner.x, corner.y, false)
    await expectFurnitureAt(page, 500, 360, false)
  })

  test('arrow keys nudge the selected item by 1 cm, with Shift by 10 cm', async ({
    page,
  }) => {
    // 10 cm is 5 plan px, 16 screen px; 1 cm is 1.6 screen px
    await page.keyboard.press('Shift+ArrowRight')
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowDown')

    // The left edge moved from 480 to 496, the top from 280 to 296
    await expectFurnitureAt(page, 490, 360, false)
    await expectFurnitureAt(page, 500, 360)
    await expectFurnitureAt(page, 600, 290, false)
    await expectFurnitureAt(page, 600, 300)
    await expectWidePlanFitted(page)
  })

  test('keys pressed while a dialog is open only affect the dialog', async ({
    page,
  }) => {
    await pickFile(page, tallPlan)
    const dialog = page.getByRole('dialog', {
      name: 'Replace the current plan?',
    })
    await expect(dialog).toBeVisible()
    // Not typed into the dialog's buttons, so only the open dialog protects
    await page.evaluate(() => (document.activeElement as HTMLElement).blur())

    await page.keyboard.press('Shift+ArrowRight')
    await page.keyboard.press('Delete')
    await page.keyboard.press('Escape')

    await expect(dialog).toBeHidden()
    await expect(status(page)).toHaveText(/^Sofa selected\./)
    await expectFurnitureAt(page, 485, 360)
    await expectFurnitureAt(page, 475, 360, false)
    await expectWidePlanFitted(page)
  })

  test('arrow keys typed into a field do not nudge the item', async ({
    page,
  }) => {
    await addButton(page).click()
    const name = formDialog(page).getByLabel('Name')
    await name.fill('Desk')
    await name.press('Shift+ArrowLeft')
    await name.press('Shift+ArrowUp')
    await formDialog(page).getByRole('button', { name: 'Cancel' }).click()

    await expectFurnitureAt(page, 485, 285)
  })
})

test.describe('dimension labels', () => {
  // A 200 × 100 cm sofa is 320 × 160 screen px around (640, 360): its edges
  // at x = 480 and 800, y = 280 and 440. The rotate handle is above it.
  const below = { left: 400, top: 444, right: 880, bottom: 720 }
  const right = { left: 804, top: 200, right: 1280, bottom: 520 }

  test.beforeEach(async ({ page }) => {
    await calibrate(page, '4')
    await addFurniture(page, 'Sofa', '200', '100')
  })

  test('label the selected item’s width below it and its depth to its right', async ({
    page,
  }) => {
    const width = await expectDimensionLabelAt(page, below, 640, 456)
    const depth = await expectDimensionLabelAt(page, right, 816, 360)
    // Each runs along its edge
    expect(width.width).toBeGreaterThan(width.height)
    expect(depth.height).toBeGreaterThan(depth.width)

    await page.mouse.click(200, 600)
    await expectNoDimensionLabel(page, below)
    await expectNoDimensionLabel(page, right)
  })

  test('labels read from the bottom or the right however the item is turned', async ({
    page,
  }) => {
    const rotation = page
      .getByRole('complementary', { name: 'Selected item' })
      .getByLabel('Rotation (°)')
    const above = { left: 400, top: 236, right: 880, bottom: 276 }
    const left = { left: 0, top: 200, right: 476, bottom: 520 }

    // Text drawn upside down would have its ink on the other side of centre
    const inkOffset = (label: DimensionLabel) => ({
      x: label.ink.x - label.x,
      y: label.ink.y - label.y,
    })
    const unturned = {
      width: await expectDimensionLabelAt(page, below, 640, 456),
      depth: await expectDimensionLabelAt(page, right, 816, 360),
    }

    // Half a turn: the width is above it, the depth to its left, drawn the
    // same way up
    await rotation.fill('180')
    await rotation.press('Enter')
    const width = await expectDimensionLabelAt(page, above, 640, 264)
    const depth = await expectDimensionLabelAt(page, left, 464, 360)
    expect(width.width).toBeGreaterThan(width.height)
    expect(depth.height).toBeGreaterThan(depth.width)
    for (const [turned, label] of [
      [width, unturned.width],
      [depth, unturned.depth],
    ] as const) {
      expect(Math.abs(inkOffset(turned).x - inkOffset(label).x)).toBeLessThan(1)
      expect(Math.abs(inkOffset(turned).y - inkOffset(label).y)).toBeLessThan(1)
    }
  })

  test('labels keep their size and distance from the edge at any zoom', async ({
    page,
  }) => {
    const size = await expectDimensionLabelAt(page, below, 640, 456)

    // Zooming in around the bottom edge's middle keeps that edge put
    await page.mouse.move(640, 440)
    await page.mouse.wheel(0, -100)
    await expectFurnitureAt(page, 640, 270)
    const zoomed = await expectDimensionLabelAt(page, below, 640, 456)
    expect(Math.abs(zoomed.width - size.width)).toBeLessThan(1)
    expect(Math.abs(zoomed.height - size.height)).toBeLessThan(1)
  })

  test('labels follow the item as it is dragged and resized', async ({
    page,
  }) => {
    // Mid-drag, 100 px right and 40 px down
    await page.mouse.move(700, 360)
    await page.mouse.down()
    await page.mouse.move(800, 400, { steps: 5 })
    await expectDimensionLabelAt(page, below, 740, 496)
    await expectDimensionLabelAt(page, { ...right, left: 904 }, 916, 400)
    await page.mouse.up()

    // Back, then resized to 300 × 50 cm: 480 × 80 screen px
    await page.keyboard.press('Control+z')
    const panel = page.getByRole('complementary', { name: 'Selected item' })
    await panel.getByLabel('Width (cm)').fill('300')
    await panel.getByLabel('Width (cm)').press('Enter')
    await expectDimensionLabelAt(page, { ...right, left: 884 }, 896, 360)
    await panel.getByLabel('Depth (cm)').fill('50')
    await panel.getByLabel('Depth (cm)').press('Enter')
    await expectDimensionLabelAt(page, { ...below, top: 404 }, 640, 416)
  })
})

test.describe('the item panel', () => {
  const panel = (page: Page) =>
    page.getByRole('complementary', { name: 'Selected item' })

  test.beforeEach(async ({ page }) => {
    await calibrate(page, '4')
    await addFurniture(page, 'Sofa', '200', '100')
  })

  test('shows the selected item, and hides with nothing selected', async ({
    page,
  }) => {
    await expect(panel(page).getByRole('heading')).toHaveText('Sofa')
    await expect(panel(page).getByLabel('Width (cm)')).toHaveValue('200')
    await expect(panel(page).getByLabel('Depth (cm)')).toHaveValue('100')

    await page.mouse.click(200, 600)
    await expect(panel(page)).toBeHidden()
  })

  test('shows the rotation as the handle turns the item', async ({ page }) => {
    const rotation = panel(page).getByLabel('Rotation (°)')
    await expect(rotation).toHaveValue('0')

    // Drag the handle, 50 px above the top edge, to about 40° clockwise
    await page.mouse.move(640, 230)
    await page.mouse.down()
    await page.mouse.move(
      640 + 150 * Math.sin(0.7),
      360 - 150 * Math.cos(0.7),
      {
        steps: 10,
      },
    )
    await page.mouse.up()

    await expect(rotation).toHaveValue('45')
  })

  test('editing the name renames the item', async ({ page }) => {
    const name = panel(page).getByLabel('Name')
    await expect(name).toHaveValue('Sofa')
    await name.fill(' Couch ')
    await name.press('Enter')

    await expect(name).toHaveValue('Couch')
    await expect(panel(page).getByRole('heading')).toHaveText('Couch')
    await expect(status(page)).toHaveText(/^Couch selected\./)
  })

  test('rejects an empty name', async ({ page }) => {
    const name = panel(page).getByLabel('Name')
    await name.fill('  ')
    // Moving on to another field applies it too
    await panel(page).getByLabel('Width (cm)').focus()

    await expect(panel(page).getByRole('alert')).toHaveText('Enter a name.')
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(panel(page).getByRole('heading')).toHaveText('Sofa')

    await name.fill('Couch')
    await name.press('Enter')
    await expect(panel(page).getByRole('alert')).toBeHidden()
    await expect(name).toHaveAttribute('aria-invalid', 'false')
  })

  test('editing the rotation turns the item about its centre', async ({
    page,
  }) => {
    const rotation = panel(page).getByLabel('Rotation (°)')
    await rotation.fill('90')
    await rotation.press('Enter')

    // 200 × 100 cm on end: 160 × 320 screen px around (640, 360)
    await expectFurnitureAt(page, 640, 210)
    await expectFurnitureAt(page, 640, 190, false)
    await expectFurnitureAt(page, 485, 285, false)
  })

  test('keeps a typed rotation within 0–360°', async ({ page }) => {
    const rotation = panel(page).getByLabel('Rotation (°)')
    await rotation.fill('370')
    await rotation.press('Enter')
    await expect(rotation).toHaveValue('10')

    await rotation.fill('-90')
    await rotation.press('Enter')
    await expect(rotation).toHaveValue('270')
  })

  test('rejects a rotation that is not a number', async ({ page }) => {
    const rotation = panel(page).getByLabel('Rotation (°)')
    await rotation.fill('left')
    await rotation.press('Enter')

    await expect(panel(page).getByRole('alert')).toHaveText(/rotation/)
    await expect(rotation).toHaveAttribute('aria-invalid', 'true')
    await expectFurnitureAt(page, 485, 285)
  })

  test('R turns the selected item 15° clockwise, Shift+R counter-clockwise', async ({
    page,
  }) => {
    const rotation = panel(page).getByLabel('Rotation (°)')
    await page.keyboard.press('r')
    await page.keyboard.press('r')
    await expect(rotation).toHaveValue('30')

    await page.keyboard.press('Shift+R')
    await page.keyboard.press('Shift+R')
    await page.keyboard.press('Shift+R')
    await expect(rotation).toHaveValue('345')

    // Each press is its own step
    await page.keyboard.press('Control+z')
    await expect(rotation).toHaveValue('0')
    await page.keyboard.press('Control+z')
    await expect(rotation).toHaveValue('15')
  })

  test('R turns an item off the 15° grid onto the next step', async ({
    page,
  }) => {
    const rotation = panel(page).getByLabel('Rotation (°)')
    await rotation.fill('7')
    await rotation.press('Enter')
    await rotation.blur()

    await page.keyboard.press('r')
    await expect(rotation).toHaveValue('15')

    await rotation.fill('7')
    await rotation.press('Enter')
    await rotation.blur()

    await page.keyboard.press('Shift+R')
    await expect(rotation).toHaveValue('0')
  })

  test('R with Ctrl, Cmd or Alt, typed into a field or under a dialog does not turn the item', async ({
    page,
  }) => {
    const rotation = panel(page).getByLabel('Rotation (°)')
    for (const key of ['Alt+r', 'Control+Shift+R', 'Meta+r']) {
      await page.keyboard.press(key)
      await expect(rotation).toHaveValue('0')
    }
    await panel(page).getByLabel('Name').press('r')
    await expect(rotation).toHaveValue('0')

    await pickFile(page, tallPlan)
    const dialog = page.getByRole('dialog', {
      name: 'Replace the current plan?',
    })
    await expect(dialog).toBeVisible()
    // Not typed into the dialog's buttons, so only the open dialog protects
    await page.evaluate(() => (document.activeElement as HTMLElement).blur())
    await page.keyboard.press('r')
    await page.keyboard.press('Escape')

    await expect(dialog).toBeHidden()
    await expect(rotation).toHaveValue('0')
  })

  test('editing the width and depth resizes the item around its centre', async ({
    page,
  }) => {
    const width = panel(page).getByLabel('Width (cm)')
    await width.fill('300')
    await width.press('Enter')
    const depth = panel(page).getByLabel('Depth (cm)')
    await depth.fill('50,5')
    // Moving on to another field applies it too
    await width.focus()

    // 300 × 50.5 cm = 480 × 80.8 screen px around (640, 360)
    await expectFurnitureAt(page, 405, 360)
    await expectFurnitureAt(page, 395, 360, false)
    await expectFurnitureAt(page, 600, 325)
    await expectFurnitureAt(page, 600, 315, false)
  })

  test('rejects a size that is not greater than zero', async ({ page }) => {
    const width = panel(page).getByLabel('Width (cm)')
    await width.fill('0')
    await width.press('Enter')

    await expect(panel(page).getByRole('alert')).toHaveText(/greater than zero/)
    await expect(width).toHaveAttribute('aria-invalid', 'true')
    await expectFurnitureAt(page, 485, 285)

    await width.fill('250')
    await width.press('Enter')
    await expect(panel(page).getByRole('alert')).toBeHidden()
  })

  for (const label of ['Name', 'Width (cm)', 'Rotation (°)']) {
    test(`keys typed into ${label} do not nudge, delete or deselect the item`, async ({
      page,
    }) => {
      const field = panel(page).getByLabel(label)
      await field.press('Shift+ArrowLeft')
      await field.press('ArrowUp')
      await field.press('Backspace')
      await field.press('Delete')
      await field.press('Escape')

      await expectFurnitureAt(page, 485, 285)
      await expect(status(page)).toHaveText(/^Sofa selected\./)
    })
  }
})
