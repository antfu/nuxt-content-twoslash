import type { ConfigOptions } from '@nuxt/test-utils/playwright'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig<ConfigOptions>({
  testDir: './tests/browser',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'content-v3',
      use: {
        ...devices['Desktop Chrome'],
        nuxt: {
          rootDir: fileURLToPath(new URL('./test/fixtures/content-v3', import.meta.url)),
        },
      },
    },
  ],
})
