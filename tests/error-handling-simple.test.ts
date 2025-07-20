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
  test.skip('First understand current timeout behavior', async () => {
    const sim = new Zemu(DEMO_APP_PATH_S)

    try {
      await sim.start(ZEMU_OPTIONS_S)
      const transport = sim.getTransport()

      console.log('=== Testing invalid APDU command ===')

      // Send an invalid APDU command that should trigger error 0x6984
      const startTime = Date.now()

      try {
        // Invalid CLA (0xFF) should cause error
        const result = await transport.send(0xff, 0x00, 0x00, 0x00)
        console.log('Result:', result)
      } catch (error: any) {
        const elapsedTime = Date.now() - startTime
        console.log(`Error occurred after ${elapsedTime}ms`)
        console.log('Error:', error)
        console.log('Error statusCode:', error.statusCode)
        console.log('Error name:', error.name)
        console.log('Error message:', error.message)
      }
    } finally {
      await sim.close()
    }
  }, 30000)

  test('Test waitUntilScreenIs with timeout', async () => {
    // Disable pooling globally for this test
    process.env.ZEMU_CONTAINER_POOLING = 'false'

    const sim = new Zemu(DEMO_APP_PATH_S)

    try {
      await sim.start(ZEMU_OPTIONS_S)
      console.log('=== Testing waitUntilScreenIs behavior ===')

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
        console.log(`Timeout occurred after ${elapsedTime}ms`)
        console.log('Error message:', error.message)

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
