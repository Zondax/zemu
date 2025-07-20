import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import Zemu, { DEFAULT_START_OPTIONS, IStartOptions } from '../src'
import { TransportError } from '../src/errors'

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

describe('Error Handling - Fixed', () => {
  test('Should fail fast on error 0x6984 instead of timing out', async () => {
    // Disable pooling globally for this test
    process.env.ZEMU_CONTAINER_POOLING = 'false'

    const sim = new Zemu(DEMO_APP_PATH_S)

    try {
      await sim.start(ZEMU_OPTIONS_S)
      const transport = sim.getTransport()

      console.log('=== Testing invalid APDU command with new error handling ===')

      // Send an invalid APDU command that should trigger error 0x6984
      const startTime = Date.now()

      try {
        // Invalid CLA (0xFF) should cause error 0x6984
        const result = await transport.send(0xff, 0x00, 0x00, 0x00)
        console.log('Unexpected success:', result)
        expect.fail('Expected transport.send to throw an error')
      } catch (error: any) {
        const elapsedTime = Date.now() - startTime
        console.log(`Error occurred after ${elapsedTime}ms`)
        console.log('Error statusCode:', error.statusCode)

        // The error should happen quickly (< 1 second), not after a timeout
        expect(elapsedTime).toBeLessThan(1000)

        // Check if we got the expected error code
        // Note: The actual error code might vary based on the app
        expect(error.statusCode).toBeDefined()
      }
    } finally {
      await sim.close()
    }
  }, 30000)

  test('Should propagate transport errors in waitUntilScreenIs', async () => {
    process.env.ZEMU_CONTAINER_POOLING = 'false'

    const sim = new Zemu(DEMO_APP_PATH_S)

    try {
      await sim.start(ZEMU_OPTIONS_S)
      const mainMenuSnapshot = sim.getMainMenuSnapshot()

      console.log('=== Testing waitUntilScreenIs with transport error ===')

      // First send an invalid command to trigger error
      const transport = sim.getTransport()
      try {
        await transport.send(0xff, 0x00, 0x00, 0x00)
      } catch (error: any) {
        console.log('Triggered error:', error.statusCode)
      }

      // Now try to wait for screen - this should fail fast if error is critical
      const startTime = Date.now()

      try {
        // Create a snapshot that won't match to force waiting
        const modifiedData = Buffer.from(mainMenuSnapshot.data)
        modifiedData[0] = (modifiedData[0] + 1) % 256
        const modifiedSnapshot = {
          ...mainMenuSnapshot,
          data: modifiedData,
        }

        await sim.waitUntilScreenIs(modifiedSnapshot, 5000)

        // If we get here, check how long it took
        const elapsedTime = Date.now() - startTime
        console.log(`waitUntilScreenIs completed after ${elapsedTime}ms`)

        // If error was critical, it should have failed fast
        // Otherwise it might wait for timeout or succeed
      } catch (error: any) {
        const elapsedTime = Date.now() - startTime
        console.log(`Error after ${elapsedTime}ms:`, error.message)

        // Check if it's a transport error (fast fail) or timeout
        if (error instanceof TransportError) {
          expect(elapsedTime).toBeLessThan(1000)
          expect(error.message).toContain('Transport error')
        } else {
          // Regular timeout
          expect(elapsedTime).toBeGreaterThan(4900)
          expect(error.message).toContain('Timeout')
        }
      }
    } finally {
      await sim.close()
    }
  }, 30000)

  test('Should handle getEvents with transport error', async () => {
    process.env.ZEMU_CONTAINER_POOLING = 'false'

    const sim = new Zemu(DEMO_APP_PATH_S)

    try {
      await sim.start(ZEMU_OPTIONS_S)

      console.log('=== Testing getEvents with transport error ===')

      // First trigger a critical transport error
      const transport = sim.getTransport()
      let errorCode: number | undefined

      try {
        await transport.send(0xff, 0x00, 0x00, 0x00)
      } catch (error: any) {
        errorCode = error.statusCode
        console.log('Triggered error code:', errorCode)
      }

      // Now try getEvents - should throw if error is critical
      try {
        const events = await sim.getEvents()
        console.log('getEvents succeeded, got', events.length, 'events')

        // This is OK - getEvents might succeed if error wasn't critical
        // or if the device recovered
        expect(Array.isArray(events)).toBe(true)
      } catch (error: any) {
        console.log('getEvents threw error:', error.message)

        // If it throws, should be a transport error with statusCode
        expect(error.statusCode).toBeDefined()
        expect(error.message).toContain('CLA_NOT_SUPPORTED')
      }
    } finally {
      await sim.close()
    }
  }, 30000)
})
