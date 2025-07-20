import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import Zemu, { DEFAULT_START_OPTIONS, IStartOptions } from '../src'

const DEMO_APP_PATH_S = resolve('bin/app_s.elf')

const ZEMU_OPTIONS_S: IStartOptions = {
  ...DEFAULT_START_OPTIONS,
  logging: false,
  startDelay: 3000,
  startText: 'Ready',
  X11: false,
  custom: '',
  model: 'nanos',
  containerPooling: false, // Disable pooling for this test
}

describe('Error Handling - Simple', () => {
  test('Test waitUntilScreenIs with timeout', async () => {
    // Disable pooling globally for this test
    process.env.ZEMU_CONTAINER_POOLING = 'false'

    const sim = new Zemu(DEMO_APP_PATH_S)

    try {
      await sim.start(ZEMU_OPTIONS_S)

      // Get a snapshot that will never match to force timeout
      const snapshot = await sim.snapshot()
      // Create a new Buffer with modified data so it won't match
      const modifiedData = Buffer.from(snapshot.data)
      modifiedData[0] = (modifiedData[0] + 1) % 256 // Change first byte
      const modifiedSnapshot = {
        ...snapshot,
        data: modifiedData,
      }

      const startTime = Date.now()
      try {
        // This should timeout after 2 seconds
        await sim.waitUntilScreenIs(modifiedSnapshot, 2000)
      } catch (error: any) {
        const elapsedTime = Date.now() - startTime

        // Verify it actually waited for the timeout
        expect(elapsedTime).toBeGreaterThan(1900)
        expect(elapsedTime).toBeLessThan(2500)
        expect(error.message).toContain('Timeout')
      }
    } finally {
      await sim.close()
    }
  }, 30000)
})
