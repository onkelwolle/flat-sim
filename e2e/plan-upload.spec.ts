import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// Fixtures: wide-plan.png is 400×200, left half red, right half blue;
// tall-plan.jpg is 100×400 solid green.
const fixture = (name: string) => new URL(`fixtures/${name}`, import.meta.url)
const widePlan = fixture('wide-plan.png')
const tallPlan = fixture('tall-plan.jpg')

test.use({ viewport: { width: 1280, height: 720 } })

type Rgba = [number, number, number, number]

/** Colour drawn by the bottom (plan) layer at a viewport point. */
const planPixel = (page: Page, x: number, y: number) =>
  page.evaluate(
    ([x, y]) => {
      const canvas = document.querySelector('canvas')!
      const ratio = canvas.width / canvas.clientWidth
      const data = canvas
        .getContext('2d')!
        .getImageData(x * ratio, y * ratio, 1, 1).data
      return [...data] as Rgba
    },
    [x, y],
  )

const looksLike = (pixel: Rgba, colour: 'red' | 'green' | 'blue' | 'none') => {
  const [r, g, b, a] = pixel
  if (colour === 'none') return a === 0
  const [cr, cg, cb] = {
    red: [255, 0, 0],
    green: [0, 255, 0],
    blue: [0, 0, 255],
  }[colour]
  return (
    a === 255 &&
    Math.abs(r - cr) < 40 &&
    Math.abs(g - cg) < 40 &&
    Math.abs(b - cb) < 40
  )
}

const expectPlanColour = async (
  page: Page,
  x: number,
  y: number,
  colour: 'red' | 'green' | 'blue' | 'none',
) =>
  expect
    .poll(async () => looksLike(await planPixel(page, x, y), colour), {
      message: `pixel at (${x}, ${y}) should be ${colour}`,
    })
    .toBe(true)

const pickFile = (page: Page, file: URL) =>
  page.locator('input[type=file]').setInputFiles(file.pathname)

// Wide plan fitted to 1280×720: scale 3.2 → 1280×640 at y = 40
const expectWidePlanFitted = async (page: Page) => {
  await expectPlanColour(page, 320, 360, 'red')
  await expectPlanColour(page, 960, 360, 'blue')
  await expectPlanColour(page, 640, 20, 'none')
  await expectPlanColour(page, 640, 700, 'none')
}

// Tall plan fitted to 1280×720: scale 1.8 → 180×720 at x = 550
const expectTallPlanFitted = async (page: Page) => {
  await expectPlanColour(page, 640, 360, 'green')
  await expectPlanColour(page, 540, 360, 'none')
  await expectPlanColour(page, 740, 360, 'none')
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
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
  const bytes = [...readFileSync(widePlan)]
  const dataTransfer = await page.evaluateHandle((bytes) => {
    const dt = new DataTransfer()
    dt.items.add(
      new File([new Uint8Array(bytes)], 'wide-plan.png', { type: 'image/png' }),
    )
    return dt
  }, bytes)

  await page.dispatchEvent('body', 'dragenter', { dataTransfer })
  await expect(page.getByText('Drop to open the plan')).toBeVisible()
  await page.dispatchEvent('body', 'dragover', { dataTransfer })
  await page.dispatchEvent('body', 'drop', { dataTransfer })

  await expect(page.getByText('Drop to open the plan')).toBeHidden()
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

test('rejects files that are not PNG or JPG images', async ({ page }) => {
  await pickFile(page, fixture('notes.txt'))

  await expect(page.getByRole('alert')).toHaveText(
    'notes.txt is not a PNG or JPG image.',
  )
})
