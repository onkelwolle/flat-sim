// Shared helpers for e2e specs that load plans and inspect the canvas.
import { readFileSync } from 'node:fs'
import { expect, type Page } from '@playwright/test'

// Fixtures: wide-plan.png is 400×200, left half red, right half blue;
// tall-plan.jpg is 100×400 solid green; sample-flat.png is a 1280×720 floor
// plan at 100 px per metre (see sampleFlat.ts).
export const fixture = (name: string) =>
  new URL(`fixtures/${name}`, import.meta.url)
export const widePlan = fixture('wide-plan.png')
export const tallPlan = fixture('tall-plan.jpg')
export const sampleFlat = fixture('sample-flat.png')

type Rgba = [number, number, number, number]
type Colour = 'red' | 'green' | 'blue' | 'none'

/** Colour drawn by a canvas layer (0 is the plan) at a viewport point. */
const layerPixel = (page: Page, layer: number, x: number, y: number) =>
  page.evaluate(
    ([layer, x, y]) => {
      const canvas = document.querySelectorAll('canvas')[layer]!
      const ratio = canvas.width / canvas.clientWidth
      const data = canvas
        .getContext('2d')!
        .getImageData(x * ratio, y * ratio, 1, 1).data
      return [...data] as Rgba
    },
    [layer, x, y],
  )

const planPixel = (page: Page, x: number, y: number) =>
  layerPixel(page, 0, x, y)

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

/**
 * Wait until the canvas has drawn what the app last rendered. Konva draws on
 * the next animation frame, and a press on the canvas finds the item under it
 * in what was last drawn: pressing an item before it is drawn misses it (the
 * press lands on the empty canvas and pans or deselects instead). Frames come
 * late when the machine is busy, so wait for one before pressing an item that
 * just appeared.
 */
export const canvasDrawn = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  )

/** The furniture layer sits right above the plan. */
const FURNITURE_LAYER = 1

/** Whether furniture is (or is not) drawn at a viewport point. */
export const expectFurnitureAt = async (
  page: Page,
  x: number,
  y: number,
  drawn = true,
) =>
  expect
    .poll(async () => (await layerPixel(page, FURNITURE_LAYER, x, y))[3] > 0, {
      message: `furniture should ${drawn ? '' : 'not '}be drawn at (${x}, ${y})`,
    })
    .toBe(drawn)

/** Layers above the plan and furniture, while each has something to draw. */
export const CALIBRATION_LAYER = 2
export const MEASURING_TAPE_LAYER = 3

type Box = { left: number; top: number; right: number; bottom: number }

/**
 * Where a layer draws a line's length label, in viewport pixels: the bounds
 * of its rows drawn wider than the line and its end handles, so the line
 * must not run along a row (draw it steeply, e.g. vertically).
 */
const labelBox = (page: Page, layer: number) =>
  page.evaluate((layer) => {
    const canvas = document.querySelectorAll('canvas')[layer]
    if (!canvas) return null
    const ratio = canvas.width / canvas.clientWidth
    const { width, height, data } = canvas
      .getContext('2d')!
      .getImageData(0, 0, canvas.width, canvas.height)
    let box: Box | null = null
    for (let y = 0; y < height; y++) {
      let left = -1
      let right = -1
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] === 0) continue
        if (left < 0) left = x
        right = x + 1
      }
      // Handles are about 10 CSS px across; labels are wider
      if (left < 0 || right - left < 20 * ratio) continue
      box ??= { left, top: y, right, bottom: y + 1 }
      box.left = Math.min(box.left, left)
      box.right = Math.max(box.right, right)
      box.bottom = y + 1
    }
    return (
      box && {
        left: box.left / ratio,
        top: box.top / ratio,
        right: box.right / ratio,
        bottom: box.bottom / ratio,
      }
    )
  }, layer)

/**
 * That a layer's length label is centred on a viewport point (within a
 * pixel); resolves to its size, to compare across zoom levels.
 */
export const expectLabelCentredAt = async (
  page: Page,
  layer: number,
  x: number,
  y: number,
) => {
  let size = { width: 0, height: 0 }
  await expect
    .poll(
      async () => {
        const box = await labelBox(page, layer)
        if (!box) return null
        size = { width: box.right - box.left, height: box.bottom - box.top }
        const centre = {
          x: (box.left + box.right) / 2,
          y: (box.top + box.bottom) / 2,
        }
        // Report the target itself when close enough, else where it is
        const near = Math.hypot(centre.x - x, centre.y - y) <= 1
        return near ? { x, y } : centre
      },
      { message: `label should be centred at (${x}, ${y})` },
    )
    .toEqual({ x, y })
  return size
}

/**
 * A dimension label's text as drawn, on screen: its centre and size, and the
 * centre of its ink, which lies towards where it ends (the unit's wide "m").
 */
export type DimensionLabel = {
  x: number
  y: number
  width: number
  height: number
  ink: { x: number; y: number }
}

/**
 * Where the furniture layer draws white within `region` (viewport pixels):
 * the text of a dimension label there, the only white it draws away from the
 * rotate handle. Null if none.
 */
const whiteTextIn = (page: Page, region: Box) =>
  page.evaluate(
    ([layer, region]) => {
      const canvas = document.querySelectorAll('canvas')[layer]!
      const ratio = canvas.width / canvas.clientWidth
      const width = Math.round((region.right - region.left) * ratio)
      const height = Math.round((region.bottom - region.top) * ratio)
      const { data } = canvas
        .getContext('2d')!
        .getImageData(
          Math.round(region.left * ratio),
          Math.round(region.top * ratio),
          width,
          height,
        )
      let box: Box | null = null
      const ink = { x: 0, y: 0, n: 0 }
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4
          if (data[i + 3]! < 250) continue
          if (Math.min(data[i]!, data[i + 1]!, data[i + 2]!) < 240) continue
          ink.x += x + 0.5
          ink.y += y + 0.5
          ink.n++
          box ??= { left: x, top: y, right: x + 1, bottom: y + 1 }
          box.left = Math.min(box.left, x)
          box.right = Math.max(box.right, x + 1)
          box.top = Math.min(box.top, y)
          box.bottom = Math.max(box.bottom, y + 1)
        }
      }
      return (
        box && {
          x: region.left + (box.left + box.right) / 2 / ratio,
          y: region.top + (box.top + box.bottom) / 2 / ratio,
          width: (box.right - box.left) / ratio,
          height: (box.bottom - box.top) / ratio,
          ink: {
            x: region.left + ink.x / ink.n / ratio,
            y: region.top + ink.y / ink.n / ratio,
          },
        }
      )
    },
    [FURNITURE_LAYER, region] as const,
  )

/**
 * That the furniture layer draws a dimension label's text within `region`,
 * centred within 3 px of (`x`, `y`); resolves to the label as drawn.
 */
export const expectDimensionLabelAt = async (
  page: Page,
  region: Box,
  x: number,
  y: number,
) => {
  let label: DimensionLabel | null = null
  await expect
    .poll(
      async () => {
        label = await whiteTextIn(page, region)
        if (!label) return null
        // Report the target itself when close enough, else where it is
        const near = Math.hypot(label.x - x, label.y - y) <= 3
        return near ? { x, y } : { x: label.x, y: label.y }
      },
      { message: `dimension label should be centred at (${x}, ${y})` },
    )
    .toEqual({ x, y })
  return label!
}

/** That the furniture layer draws no dimension label within `region`. */
export const expectNoDimensionLabel = (page: Page, region: Box) =>
  expect
    .poll(() => whiteTextIn(page, region), {
      message: 'no dimension label should be drawn there',
    })
    .toBeNull()
