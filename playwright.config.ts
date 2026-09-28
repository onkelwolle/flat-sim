import { createServer } from 'node:net'
import { defineConfig, devices } from '@playwright/test'

/** A port nothing is listening on right now. */
const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, () => {
      const { port } = server.address() as { port: number }
      server.close(() => resolve(port))
    })
  })

// Each run serves its own build on its own port, so parallel runs (e.g. from
// two worktrees) never test each other's build. Workers load this config too:
// they inherit the port through the environment instead of picking another.
process.env.E2E_PORT ??= String(await freePort())
const port = Number(process.env.E2E_PORT)
const baseURL = `http://localhost:${port}/flat-sim/`

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: 'touch/**',
    },
    // Touch specs only, on a touch-emulated tablet (iPad-sized) in Chromium,
    // which can drive several fingers through CDP
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro 11 landscape'],
        defaultBrowserType: 'chromium',
      },
      testMatch: 'touch/**/*.spec.ts',
    },
  ],
  webServer: {
    command: `vite build && vite preview --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
})
