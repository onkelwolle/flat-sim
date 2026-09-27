// Shared helpers for e2e specs that load plans and inspect the canvas.
import { readFileSync } from 'node:fs'
import { expect, type Page } from '@playwright/test'

// Fixtures: wide-plan.png is 400×200, left half red, right half blue;
// tall-plan.jpg is 100×400 solid green.
export const fixture = (name: string) =>
  new URL(`fixtures/${name}`, import.meta.url)
export const widePlan = fixture('wide-plan.png')
export const tallPlan = fixture('tall-plan.jpg')

type Rgba = [number, number, number, number]
type Colour = 'red' | 'green' | 'blue' | 'none'

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

const looksLike = (pixel: Rgba, colour: Colour) => {
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

export const expectPlanColour = async (
  page: Page,
  x: number,
  y: number,
  colour: Colour,
) =>
  expect
    .poll(async () => looksLike(await planPixel(page, x, y), colour), {
      message: `pixel at (${x}, ${y}) should be ${colour}`,
    })
    .toBe(true)

/** Drag a file over the page and drop it; `whileDragging` runs mid-drag. */
export const dropFile = async (
  page: Page,
  file: URL,
  type: string,
  whileDragging = async () => {},
) => {
  const name = file.pathname.split('/').pop()!
  const dataTransfer = await page.evaluateHandle(
    ({ bytes, name, type }) => {
      const dt = new DataTransfer()
      dt.items.add(new File([new Uint8Array(bytes)], name, { type }))
      return dt
    },
    { bytes: [...readFileSync(file)], name, type },
  )
  await page.dispatchEvent('body', 'dragenter', { dataTransfer })
  await whileDragging()
  await page.dispatchEvent('body', 'dragover', { dataTransfer })
  await page.dispatchEvent('body', 'drop', { dataTransfer })
}

export const pickFile = (page: Page, file: URL) =>
  page.locator('input[type=file]').setInputFiles(file.pathname)

// Wide plan fitted to 1280×720: scale 3.2 → 1280×640 at y = 40
export const expectWidePlanFitted = async (page: Page) => {
  await expectPlanColour(page, 320, 360, 'red')
  await expectPlanColour(page, 960, 360, 'blue')
  await expectPlanColour(page, 640, 20, 'none')
  await expectPlanColour(page, 640, 700, 'none')
}

// Tall plan fitted to 1280×720: scale 1.8 → 180×720 at x = 550
export const expectTallPlanFitted = async (page: Page) => {
  await expectPlanColour(page, 640, 360, 'green')
  await expectPlanColour(page, 540, 360, 'none')
  await expectPlanColour(page, 740, 360, 'none')
}
