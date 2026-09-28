// Renders the sample flat (e2e/sampleFlat.ts) to sample-flat.png with
// Playwright's Chromium. Run: node e2e/fixtures/render-sample-flat.ts
import { chromium } from '@playwright/test'
import { HEIGHT, WIDTH, svg } from '../sampleFlat.ts'

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
})
await page.setContent(`<body style="margin:0">${svg()}</body>`)
await page.screenshot({
  path: new URL('sample-flat.png', import.meta.url).pathname,
})
await browser.close()
