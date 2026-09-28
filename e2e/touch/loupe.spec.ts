import { expect, test, type Page } from '@playwright/test'
import { pickFile, widePlan } from '../plan.ts'
import { fingers } from './fingers.ts'

// The wide plan (400×200 px, red left of x 200, blue right) is fitted to the
// 1194×834 tablet at 2.985× with its top at y = 118.5: screen (298.5, 417) is
// plan (100, 100) and screen (895.5, 417) is plan (300, 100)

const status = (page: Page) => page.getByRole('status')
const loupe = (page: Page) => page.getByTestId('loupe')
const lengthDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'How long is this line?' })

/** Whether the loupe shows red or blue plan at a point of its own. */
const loupeColour = (page: Page, x: number, y: number) =>
  page.evaluate(
    ([x, y]) => {
      const canvas = document.querySelector('[data-testid="loupe"] canvas')
      if (!(canvas instanceof HTMLCanvasElement)) return null
      const ratio = canvas.width / canvas.clientWidth
      const [r, , b] = canvas
        .getContext('2d')!
        .getImageData(x * ratio, y * ratio, 1, 1).data
      return r! > 200 && b! < 50 ? 'red' : b! > 200 && r! < 50 ? 'blue' : null
    },
    [x, y],
  )

/** Screen centre of the loupe. */
const loupeCentre = async (page: Page) => {
  const box = (await loupe(page).boundingBox())!
  return [box.x + box.width / 2, box.y + box.height / 2]
}

/** Set the scale by touch at 50 plan px per metre: 4 m across plan x 100–300. */
const setLength = async (page: Page, metres: string) => {
  await lengthDialog(page).getByLabel('Length').fill(metres)
  await lengthDialog(page).getByRole('button', { name: 'Set scale' }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await pickFile(page, widePlan)
})

test.describe('calibrate tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole('button', { name: 'Calibrate scale' }).click()
  })

  test('a finger down shows the plan under it at twice the zoom, above-left of it', async ({
    page,
  }) => {
    const touch = await fingers(page)

    // Plan x 197.65, 7 px left of the red/blue edge on screen; 14 in the loupe
    const a = await touch.down([590, 417])

    await expect(loupe(page)).toBeVisible()
    await expect.poll(() => loupeCentre(page)).toEqual([490, 317])
    await expect.poll(() => loupeColour(page, 70, 60)).toBe('red')
    await expect.poll(() => loupeColour(page, 80, 60)).toBe('blue')
    await touch.up(a)
    await expect(loupe(page)).toBeHidden()
  })

  test('the loupe flips below a finger near the top edge', async ({ page }) => {
    const touch = await fingers(page)

    const a = await touch.down([590, 130])

    await expect.poll(() => loupeCentre(page)).toEqual([490, 230])
    await touch.up(a)
  })

  test('each point goes where the finger lifts', async ({ page }) => {
    const touch = await fingers(page)

    const a = await touch.down([250, 417])
    await expect(status(page)).toHaveText(/one end of a wall/)
    await touch.move({ [a]: [298.5, 417] })
    await touch.up(a)
    await expect(status(page)).toHaveText(/the other end of the wall/)
    const b = await touch.down([850, 500])
    await touch.move({ [b]: [895.5, 417] })
    await expect(lengthDialog(page)).toBeHidden()
    await touch.up(b)
    await setLength(page, '4')

    await expect(status(page)).toHaveText('Scale: 1 m = 50 plan px')
  })

  test('lifting off the plan places nothing', async ({ page }) => {
    const touch = await fingers(page)

    // Above the plan, whose top is at y = 118.5
    const a = await touch.down([298.5, 417])
    await touch.move({ [a]: [298.5, 60] })
    await touch.up(a)

    await expect(loupe(page)).toBeHidden()
    await expect(status(page)).toHaveText(/one end of a wall/)
  })

  test('a second finger cancels the point being placed; points already placed stay', async ({
    page,
  }) => {
    await page.touchscreen.tap(298.5, 417)
    const touch = await fingers(page)

    const a = await touch.down([597, 417])
    await expect(loupe(page)).toBeVisible()
    const b = await touch.down([800, 600])
    await expect(loupe(page)).toBeHidden()
    await touch.move({ [a]: [547, 417], [b]: [850, 600] })
    await touch.up(a)
    await touch.up(b)
    await expect(lengthDialog(page)).toBeHidden()
    await expect(status(page)).toHaveText(/the other end of the wall/)

    await page.touchscreen.tap(895.5, 600)

    await expect(lengthDialog(page)).toBeVisible()
  })
})

test.describe('measuring tape', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole('button', { name: 'Calibrate scale' }).click()
    await page.touchscreen.tap(298.5, 417)
    await page.touchscreen.tap(895.5, 417)
    await setLength(page, '4')
    await page.getByRole('button', { name: 'Measure' }).click()
  })

  test('press, drag and release measures, the loupe following the moving end', async ({
    page,
  }) => {
    const touch = await fingers(page)

    const a = await touch.down([298.5, 417])
    await expect(loupe(page)).toBeVisible()
    await touch.move({ [a]: [597, 417] })
    await expect.poll(() => loupeCentre(page)).toEqual([497, 317])
    await touch.up(a)

    await expect(loupe(page)).toBeHidden()
    await expect(status(page)).toHaveText(
      /^Distance: 2\.00 m\. Tap or click to measure again/,
    )
  })

  test('tap, tap measures; the second end goes where the finger lifts', async ({
    page,
  }) => {
    await page.touchscreen.tap(298.5, 417)
    const touch = await fingers(page)

    const a = await touch.down([850, 500])
    await expect(loupe(page)).toBeVisible()
    await touch.move({ [a]: [895.5, 417] })
    await touch.up(a)

    await expect(loupe(page)).toBeHidden()
    await expect(status(page)).toHaveText(
      /^Distance: 4\.00 m\. Tap or click to measure again/,
    )
  })

  test('dragging off the plan measures nothing', async ({ page }) => {
    const touch = await fingers(page)

    const a = await touch.down([298.5, 417])
    await touch.move({ [a]: [298.5, 60] })
    await touch.up(a)

    await expect(status(page)).toHaveText(
      /^Tap or click two points, or drag between them/,
    )
  })

  test('lifting the second end off the plan keeps the first', async ({
    page,
  }) => {
    await page.touchscreen.tap(298.5, 417)
    const touch = await fingers(page)

    const a = await touch.down([597, 417])
    await touch.move({ [a]: [597, 60] })
    await touch.up(a)
    await expect(status(page)).toHaveText(
      /^Distance: 0 cm\. Tap or click the other end/,
    )
    await page.touchscreen.tap(895.5, 417)

    await expect(status(page)).toHaveText(/^Distance: 4\.00 m\./)
  })

  test('a second finger drops the measurement being dragged out and the loupe', async ({
    page,
  }) => {
    const touch = await fingers(page)

    const a = await touch.down([298.5, 417])
    await touch.move({ [a]: [597, 417] })
    const b = await touch.down([895.5, 600])
    await expect(loupe(page)).toBeHidden()
    await touch.up(a)
    await touch.up(b)

    await expect(status(page)).toHaveText(
      /^Tap or click two points, or drag between them/,
    )
  })
})
