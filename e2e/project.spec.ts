import { expect, test, type Page } from '@playwright/test'
import {
  expectFurnitureAt,
  expectPlanColour,
  expectTallPlanFitted,
  expectWidePlanFitted,
  pickFile,
  tallPlan,
  widePlan,
} from './plan.ts'

test.use({ viewport: { width: 1280, height: 720 } })

// The wide plan (400×200 px) is fitted at 3.2× with its top at y = 40, so
// screen (320, 360) is plan (100, 100) and screen (960, 360) is plan (300, 100)

const status = (page: Page) => page.getByRole('status')
const emptyHint = (page: Page) => page.getByText(/^Drop a floor plan image/)
const newProjectButton = (page: Page) =>
  page.getByRole('button', { name: 'New project' })
const newProjectDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Start a new project?' })
const notice = (page: Page) => page.locator('.notice')

/** Calibrate at 50 plan px per metre: plan (100, 100) to (300, 100) is 4 m. */
const calibrate = async (page: Page) => {
  await page.getByRole('button', { name: 'Calibrate scale' }).click()
  await page.mouse.click(320, 360)
  await page.mouse.click(960, 360)
  const dialog = page.getByRole('dialog', { name: 'How long is this line?' })
  await dialog.getByLabel('Length').fill('4')
  await dialog.getByRole('button', { name: 'Set scale' }).click()
  await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')
}

/** Add a 200 × 100 cm sofa in the middle of the view. */
const addSofa = async (page: Page) => {
  await page.getByRole('button', { name: 'Add furniture' }).click()
  const form = page.getByRole('dialog', { name: 'Add furniture' })
  await form.getByLabel('Name').fill('Sofa')
  await form.getByLabel('Width (cm)').fill('200')
  await form.getByLabel('Depth (cm)').fill('100')
  await form.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(form).toBeHidden()
}

/** Number of items in the saved project, or null when none is saved. */
const savedItems = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number | null>((resolve, reject) => {
        const open = indexedDB.open('flat-sim')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          if (!db.objectStoreNames.contains('projects')) {
            db.close()
            return resolve(null)
          }
          const get = db
            .transaction('projects')
            .objectStore('projects')
            .get('current')
          get.onsuccess = () => {
            db.close()
            const record = get.result as
              { project: { furniture: unknown[] } } | undefined
            resolve(record ? record.project.furniture.length : null)
          }
          get.onerror = () => reject(get.error)
        }
      }),
  )

/** Wait until autosave has stored `count` items (null: nothing saved). */
const expectSaved = (page: Page, count: number | null) =>
  expect.poll(() => savedItems(page)).toBe(count)

test.describe('with storage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./')
    await pickFile(page, widePlan)
    await expectWidePlanFitted(page)
    await calibrate(page)
    await addSofa(page)
    await expectSaved(page, 1)
  })

  test('restores the plan, its scale and the furniture on reload', async ({
    page,
  }) => {
    await page.reload()

    await expectWidePlanFitted(page)
    await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')
    // 200 × 100 cm = 100 × 50 plan px = 320 × 160 screen px around (640, 360)
    await expectFurnitureAt(page, 485, 285)
    await expectFurnitureAt(page, 795, 435)
    await expectFurnitureAt(page, 475, 285, false)
    await expect(emptyHint(page)).toBeHidden()
  })

  test('keeps later changes, such as a deleted item, on reload', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Delete item' }).click()
    await expectSaved(page, 0)

    await page.reload()

    await expectWidePlanFitted(page)
    await expectFurnitureAt(page, 640, 360, false)
  })

  test('a new project clears everything once confirmed, also after reload', async ({
    page,
  }) => {
    await newProjectButton(page).click()
    await newProjectDialog(page)
      .getByRole('button', { name: 'Start new project' })
      .click()

    await expect(newProjectDialog(page)).toBeHidden()
    await expect(emptyHint(page)).toBeVisible()
    await expectPlanColour(page, 320, 360, 'none')
    await expectSaved(page, null)

    await page.reload()
    await expect(emptyHint(page)).toBeVisible()
    await expectPlanColour(page, 320, 360, 'none')

    // A fresh plan starts uncalibrated
    await pickFile(page, tallPlan)
    await expectTallPlanFitted(page)
    await expect(status(page)).toHaveText(/^Scale not set/)
  })

  test('cancelling a new project keeps everything', async ({ page }) => {
    await newProjectButton(page).click()
    await newProjectDialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(newProjectDialog(page)).toBeHidden()

    await newProjectButton(page).click()
    await page.keyboard.press('Escape')
    await expect(newProjectDialog(page)).toBeHidden()

    await expectWidePlanFitted(page)
    await expectFurnitureAt(page, 640, 360)
    await page.reload()
    await expectWidePlanFitted(page)
    await expectFurnitureAt(page, 640, 360)
  })
})

test('keeps working in memory, with a notice, when storage is unavailable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException('IndexedDB is disabled', 'InvalidStateError')
    }
  })
  await page.goto('./')

  await expect(notice(page)).toHaveText(/won’t be saved/)
  await pickFile(page, widePlan)
  await expectWidePlanFitted(page)
  await calibrate(page)
  await addSofa(page)
  await expectFurnitureAt(page, 640, 360)

  await notice(page).getByRole('button', { name: 'Dismiss' }).click()
  await expect(notice(page)).toBeHidden()
})
