// Furnishes the sample flat and, with UPDATE_SCREENSHOT=1, saves the README
// screenshot: `pnpm screenshot`. Without it, this runs as an ordinary spec.
import { expect, test, type Page } from '@playwright/test'
import { pickFile, sampleFlat } from './plan.ts'
import { DIMENSIONS, toPx } from './sampleFlat.ts'

// The sample flat fits this viewport at 1×: screen coordinates are plan pixels
test.use({ viewport: { width: 1280, height: 720 } })

const SCREENSHOT = new URL('../docs/screenshot.png', import.meta.url).pathname

type Piece = {
  name: string
  widthCm: number
  depthCm: number
  /** Centre, in metres from the flat's top-left corner. */
  at: [number, number]
  rotationDeg?: number
}

const FURNITURE: Piece[] = [
  { name: 'Sofa', widthCm: 220, depthCm: 95, at: [2.1, 2.87] },
  { name: 'Coffee table', widthCm: 110, depthCm: 60, at: [2.1, 1.7] },
  { name: 'Sideboard', widthCm: 180, depthCm: 45, at: [2.1, 0.33] },
  { name: 'Armchair', widthCm: 85, depthCm: 85, at: [0.65, 1.7] },
  { name: 'Counter', widthCm: 300, depthCm: 60, at: [8.3, 0.42] },
  { name: 'Dining table', widthCm: 160, depthCm: 90, at: [7.8, 2.5] },
  { name: 'Bed', widthCm: 160, depthCm: 200, at: [1.12, 4.6], rotationDeg: 90 },
  {
    name: 'Wardrobe',
    widthCm: 100,
    depthCm: 60,
    at: [3.64, 5.18],
    rotationDeg: 90,
  },
  { name: 'Bathtub', widthCm: 75, depthCm: 170, at: [9.52, 4.6] },
]

const status = (page: Page) => page.getByRole('status')

const calibrate = async (page: Page) => {
  await page.getByRole('button', { name: 'Calibrate scale' }).click()
  await page.mouse.click(...DIMENSIONS.width.from)
  await page.mouse.click(...DIMENSIONS.width.to)
  const dialog = page.getByRole('dialog', { name: 'How long is this line?' })
  await dialog.getByLabel('Length').fill('10')
  await dialog.getByRole('button', { name: 'Set scale' }).click()
  await expect(status(page)).toHaveText('Scale: 1 m = 100 plan px')
}

/** Add a piece (it appears selected, centred in the view) and move it. */
const place = async (page: Page, piece: Piece) => {
  await page.getByRole('button', { name: 'Add furniture' }).click()
  const form = page.getByRole('dialog', { name: 'Add furniture' })
  await form.getByLabel('Name').fill(piece.name)
  await form.getByLabel('Width (cm)').fill(String(piece.widthCm))
  await form.getByLabel('Depth (cm)').fill(String(piece.depthCm))
  await form.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(form).toBeHidden()

  if (piece.rotationDeg) {
    const rotation = page.getByLabel('Rotation (°)')
    await rotation.fill(String(piece.rotationDeg))
    await rotation.press('Enter')
  }

  await page.mouse.move(640, 360)
  await page.mouse.down()
  await page.mouse.move(...toPx(...piece.at), { steps: 5 })
  await page.mouse.up()
}

test('furnishes the sample flat', async ({ page }) => {
  await page.goto('./')
  await pickFile(page, sampleFlat)
  await calibrate(page)

  for (const piece of FURNITURE) await place(page, piece)
  await page.keyboard.press('Escape')

  // Measure the gap between sofa and coffee table
  await page.getByRole('button', { name: 'Measure' }).click()
  await page.mouse.click(...toPx(2.1, 2.0))
  await page.mouse.click(...toPx(2.1, 2.4))
  await expect(status(page)).toHaveText(/^Distance: 40 cm\./)
  await page.mouse.move(1000, 700)

  if (process.env.UPDATE_SCREENSHOT) await page.screenshot({ path: SCREENSHOT })
})
