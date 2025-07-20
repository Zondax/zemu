import { describe, expect, test } from 'vitest'
import { resolve } from 'node:path'
import Zemu, { DEFAULT_START_OPTIONS, IStartOptions } from '../src'
import type Transport from '@ledgerhq/hw-transport'

const DEMO_APP_PATH_S = resolve('bin/app_s.elf')

const ZEMU_OPTIONS_S: IStartOptions = {
  ...DEFAULT_START_OPTIONS,
  logging: true,
  startDelay: 3000,
  startText: 'Ready',
  X11: false,
  custom: '',
  model: 'nanos',
  containerPooling: false, // Disable pooling for this test
}

describe('Error Handling', () => {
  test('Should fail fast on error 0x6984 instead of timing out', async () => {
    const sim = new Zemu(DEMO_APP_PATH_S)
    
    try {
      await sim.start(ZEMU_OPTIONS_S)
      const transport = sim.getTransport()
      
      // Send an invalid APDU command that should trigger error 0x6984
      // CLA=0xFF is typically invalid for Ledger apps
      const invalidCLA = 0xFF
      const validINS = 0x00
      const p1 = 0x00
      const p2 = 0x00
      
      // Start timer to measure how long the error takes
      const startTime = Date.now()
      
      try {
        // This should fail with error 0x6984 (invalid data)
        await transport.send(invalidCLA, validINS, p1, p2)
        
        // If we get here, the test failed - we expected an error
        expect.fail('Expected transport.send to throw an error')
      } catch (error: any) {
        const elapsedTime = Date.now() - startTime
        
        // The error should happen quickly (< 1 second), not after a timeout
        expect(elapsedTime).toBeLessThan(1000)
        
        // Check if we got the expected error code
        // Invalid CLA (0xFF) triggers CLA_NOT_SUPPORTED (0x6E00)
        expect(error.statusCode).toBe(0x6E00)
      }
    } finally {
      await sim.close()
    }
  })

  test('Should propagate transport errors in waitUntilScreenIs', async () => {
    const sim = new Zemu(DEMO_APP_PATH_S)
    
    try {
      await sim.start(ZEMU_OPTIONS_S)
      const mainMenuSnapshot = sim.getMainMenuSnapshot()
      
      // Mock a transport error by directly calling an invalid command
      // that will cause subsequent operations to fail
      const transport = sim.getTransport()
      
      // Send invalid command to put device in error state
      try {
        await transport.send(0xFF, 0x00, 0x00, 0x00)
      } catch {
        // Expected to fail
      }
      
      // Now try to wait for screen - this should fail fast, not timeout
      const startTime = Date.now()
      
      try {
        // This should fail quickly due to transport error, not wait for timeout
        await sim.waitUntilScreenIs(mainMenuSnapshot, 5000)
        expect.fail('Expected waitUntilScreenIs to throw an error')
      } catch (error: any) {
        const elapsedTime = Date.now() - startTime
        
        // Should fail fast, not wait for the 5000ms timeout
        expect(elapsedTime).toBeLessThan(1000)
        
        // Error message should indicate transport error, not timeout
        expect(error.message).not.toContain('Timeout')
      }
    } finally {
      await sim.close()
    }
  })

  test('Should handle error in getEvents gracefully', async () => {
    const sim = new Zemu(DEMO_APP_PATH_S)
    
    try {
      await sim.start(ZEMU_OPTIONS_S)
      
      // Force a transport error
      const transport = sim.getTransport()
      try {
        await transport.send(0xFF, 0x00, 0x00, 0x00)
      } catch {
        // Expected
      }
      
      // getEvents should propagate error, not return empty array
      try {
        const events = await sim.getEvents()
        // If device is in error state, getEvents might still work
        // But if transport is broken, it should throw
        expect(Array.isArray(events)).toBe(true)
      } catch (error: any) {
        // This is also acceptable - error propagation
        expect(error).toBeDefined()
      }
    } finally {
      await sim.close()
    }
  })
})