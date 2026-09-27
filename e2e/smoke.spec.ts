import { expect, test } from '@playwright/test'

test('renders the plan canvas filling the window', async ({ page }) => {
  await page.goto('./')

  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()

  const box = await canvas.boundingBox()
  const viewport = page.viewportSize()
  expect(box?.width).toBe(viewport?.width)
  expect(box?.height).toBe(viewport?.height)
})
