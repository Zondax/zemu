import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Touch devices take a while to boot inside the emulator
    testTimeout: 180000,
    hookTimeout: 60000,
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    globals: true,
    globalSetup: ['tests/globalsetup.ts'],
  },
})
