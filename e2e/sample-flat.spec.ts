import { expect, test, type Page } from '@playwright/test'
import { pickFile, sampleFlat } from './plan.ts'
import { DIMENSIONS, ROOMS, toPx } from './sampleFlat.ts'

// The sample flat is 1280×720, so in this viewport it fits at 1× and screen
// coordinates are plan pixels
test.use({ viewport: { width: 1280, height: 720 } })

const status = (page: Page) => page.getByRole('status')

test('calibrates on the sample flat and measures a room', async ({ page }) => {
  await page.goto('./')
  await pickFile(page, sampleFlat)

  await page.getByRole('button', { name: 'Calibrate scale' }).click()
  await page.mouse.click(...DIMENSIONS.width.from)
  await page.mouse.click(...DIMENSIONS.width.to)
  const dialog = page.getByRole('dialog', { name: 'How long is this line?' })
  await dialog.getByLabel('Length').fill('10')
  await dialog.getByRole('button', { name: 'Set scale' }).click()
  await expect(status(page)).toHaveText('Scale: 1 m = 100 plan px')

  const { living } = ROOMS
  const middle = living.y + living.depth / 2
  await page.getByRole('button', { name: 'Measure' }).click()
  await page.mouse.click(...toPx(living.x, middle))
  await page.mouse.click(...toPx(living.x + living.width, middle))
  await expect(status(page)).toHaveText(/^Distance: 5\.50 m\./)
})
