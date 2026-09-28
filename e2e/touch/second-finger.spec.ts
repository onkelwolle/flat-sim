import { expect, test, type Page } from '@playwright/test'
import { expectFurnitureAt, pickFile, widePlan } from '../plan.ts'
import { fingers } from './fingers.ts'

// The wide plan (400×200 px) is fitted to the 1194×834 tablet at 2.985× with
// its top at y = 118.5: screen (298.5, 417) is plan (100, 100), screen
// (895.5, 417) is plan (300, 100) and the view's centre, (597, 417), is plan
// (200, 100)

const status = (page: Page) => page.getByRole('status')
const undoButton = (page: Page) =>
  page.getByRole('button', { name: 'Undo', exact: true })
const deleteButton = (page: Page) =>
  page.getByRole('button', { name: 'Delete item' })
const lengthDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'How long is this line?' })

const tap = (page: Page, x: number, y: number) => page.touchscreen.tap(x, y)

/** Calibrate at 50 plan px per metre: plan (100, 100) to (300, 100) is 4 m. */
const calibrate = async (page: Page) => {
  await page.getByRole('button', { name: 'Calibrate scale' }).click()
  await tap(page, 298.5, 417)
  await tap(page, 895.5, 417)
  await lengthDialog(page).getByLabel('Length').fill('4')
  await lengthDialog(page).getByRole('button', { name: 'Set scale' }).click()
  await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')
}

/** A 2 m × 1 m sofa in the view's centre: screen x 448–746, y 342–492. */
const addSofa = async (page: Page) => {
  await page.getByRole('button', { name: 'Add furniture' }).click()
  const form = page.getByRole('dialog', { name: 'Add furniture' })
  await form.getByLabel('Name').fill('Sofa')
  await form.getByLabel('Width (cm)').fill('200')
  await form.getByLabel('Depth (cm)').fill('100')
  await form.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(form).toBeHidden()
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await pickFile(page, widePlan)
  await calibrate(page)
})

test('a second finger during a drag snaps the item back, recording no step', async ({
  page,
}) => {
  await addSofa(page)
  const touch = await fingers(page)

  const a = await touch.down([597, 417])
  await touch.move({ [a]: [697, 417] })
  const b = await touch.down([300, 700])
  await touch.up(a)
  await touch.up(b)

  await expectFurnitureAt(page, 470, 417)
  await expectFurnitureAt(page, 780, 417, false)
  await expect(undoButton(page)).toHaveAttribute('title', 'Undo add Sofa')
  await expect(deleteButton(page)).toBeVisible()
})

test('one finger still drags an item, as one step', async ({ page }) => {
  await addSofa(page)
  const touch = await fingers(page)

  const a = await touch.down([597, 417])
  await touch.move({ [a]: [697, 417] })
  await touch.up(a)

  await expectFurnitureAt(page, 780, 417)
  await expect(undoButton(page)).toHaveAttribute('title', 'Undo move Sofa')
})

test.describe('turning', () => {
  // The rotate handle sits 60 px above the selected sofa's top edge; turned
  // a quarter, the sofa no longer reaches its old left end at x 470
  const handle: [number, number] = [597, 282]

  test('one finger on the rotate handle turns the item', async ({ page }) => {
    await addSofa(page)
    const touch = await fingers(page)

    const a = await touch.down(handle)
    await touch.move({ [a]: [747, 417] }, 10)
    await touch.up(a)

    await expectFurnitureAt(page, 470, 417, false)
    await expect(undoButton(page)).toHaveAttribute('title', 'Undo rotate Sofa')
  })

  test('a second finger during a turn snaps the item back, recording no step', async ({
    page,
  }) => {
    await addSofa(page)
    const touch = await fingers(page)

    const a = await touch.down(handle)
    await touch.move({ [a]: [747, 417] }, 10)
    const b = await touch.down([300, 700])
    await touch.up(a)
    await touch.up(b)

    await expectFurnitureAt(page, 470, 417)
    await expect(page.getByLabel('Rotation (°)')).toHaveValue('0')
    await expect(undoButton(page)).toHaveAttribute('title', 'Undo add Sofa')
  })
})

test('pinching keeps the selection, even with a finger on another item', async ({
  page,
}) => {
  await addSofa(page)
  await tap(page, 300, 700)
  await expect(deleteButton(page)).toBeHidden()
  await tap(page, 597, 417)
  await expect(deleteButton(page)).toBeVisible()
  await page.getByRole('button', { name: 'Add furniture' }).click()
  const form = page.getByRole('dialog', { name: 'Add furniture' })
  await form.getByLabel('Name').fill('Chair')
  await form.getByLabel('Width (cm)').fill('50')
  await form.getByLabel('Depth (cm)').fill('50')
  await form.getByRole('button', { name: 'Add', exact: true }).click()
  // The chair sits on top of the sofa's centre and is selected; select the
  // sofa again by its left end
  await tap(page, 470, 417)
  await expect(page.getByLabel('Name')).toHaveValue('Sofa')
  const touch = await fingers(page)

  const a = await touch.down([300, 700])
  const b = await touch.down([597, 417])
  await touch.move({ [a]: [250, 700], [b]: [647, 417] })
  await touch.up(a)
  await touch.up(b)

  await expect(page.getByLabel('Name')).toHaveValue('Sofa')
  await expect(undoButton(page)).toHaveAttribute('title', 'Undo add Chair')
})

test('tapping empty canvas selects none', async ({ page }) => {
  await addSofa(page)
  await expect(deleteButton(page)).toBeVisible()

  await tap(page, 300, 700)

  await expect(deleteButton(page)).toBeHidden()
})

test('a second finger drops a measurement being drawn', async ({ page }) => {
  await page.getByRole('button', { name: 'Measure' }).click()
  const touch = await fingers(page)

  const a = await touch.down([298.5, 417])
  await touch.move({ [a]: [597, 417] })
  await expect(status(page)).toHaveText(/^Distance: 2\.00 m\./)
  const b = await touch.down([895.5, 600])
  await touch.move({ [a]: [560, 417], [b]: [895.5, 600] })
  await touch.up(a)
  await touch.up(b)

  await expect(status(page)).toHaveText(
    /^Tap or click two points, or drag between them/,
  )
  await expect(page.getByRole('button', { name: 'Measure' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
