/** ******************************************************************************
 *  (c) 2018 - 2024 Zondax AG
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 ******************************************************************************* */
import { describe, expect, test } from 'vitest'
import Zemu, { APDU_STATUS_CODES, TransportError } from '../src'
import { defaultOptions, nanoModels } from './common'

const model = nanoModels[0]
const options = { ...defaultOptions, model: model.name }

// CLA 0xff is not handled by any Zondax app and yields CLA_NOT_SUPPORTED (0x6e00)
const INVALID_CLA = 0xff

function differentScreen(sim: Zemu) {
  const snapshot = sim.getMainMenuSnapshot()
  const data = Buffer.from(snapshot.data)
  data[data.length - 1] ^= 0xff
  return { ...snapshot, data }
}

describe('APDU error handling', () => {
  test.concurrent('rejected status word throws fast with its status code', async () => {
    const sim = new Zemu(model.path)
    try {
      await sim.start(options)
      const transport = sim.getTransport()

      // Generous bound: the point is "not a wait-helper timeout", not raw latency
      const startTime = Date.now()
      await expect(transport.send(INVALID_CLA, 0x00, 0x00, 0x00)).rejects.toMatchObject({ statusCode: APDU_STATUS_CODES.CLA_NOT_SUPPORTED })
      expect(Date.now() - startTime).toBeLessThan(5000)

      const recorded = sim.getLastTransportError() as any
      expect(recorded).not.toBeNull()
      expect(recorded.statusCode).toBe(APDU_STATUS_CODES.CLA_NOT_SUPPORTED)
    } finally {
      await sim.close()
    }
  })

  test.concurrent('status words listed in statusList are returned, not thrown', async () => {
    const sim = new Zemu(model.path)
    try {
      await sim.start(options)
      const transport = sim.getTransport()

      const response = await transport.send(INVALID_CLA, 0x00, 0x00, 0x00, Buffer.alloc(0), [
        APDU_STATUS_CODES.SUCCESS,
        APDU_STATUS_CODES.CLA_NOT_SUPPORTED,
      ])
      expect(response.readUInt16BE(response.length - 2)).toBe(APDU_STATUS_CODES.CLA_NOT_SUPPORTED)

      // The status is still recorded so wait helpers can fail fast
      expect((sim.getLastTransportError() as any)?.statusCode).toBe(APDU_STATUS_CODES.CLA_NOT_SUPPORTED)
    } finally {
      await sim.close()
    }
  })

  test.concurrent('wait helpers fail fast after a critical status word', async () => {
    const sim = new Zemu(model.path)
    try {
      await sim.start(options)
      const transport = sim.getTransport()

      await expect(transport.send(INVALID_CLA, 0x00, 0x00, 0x00)).rejects.toThrow()

      // Must fail well before the 20s wait timeout
      const startTime = Date.now()
      await expect(sim.waitUntilScreenIs(differentScreen(sim), 20000)).rejects.toBeInstanceOf(TransportError)
      expect(Date.now() - startTime).toBeLessThan(5000)

      await expect(sim.waitForText('never shown', 20000)).rejects.toBeInstanceOf(TransportError)
      await expect(sim.getEvents()).rejects.toMatchObject({ statusCode: APDU_STATUS_CODES.CLA_NOT_SUPPORTED })
    } finally {
      await sim.close()
    }
  })

  test.concurrent('clearTransportError restores normal timeouts', async () => {
    const sim = new Zemu(model.path)
    try {
      await sim.start(options)
      const transport = sim.getTransport()

      await expect(transport.send(INVALID_CLA, 0x00, 0x00, 0x00)).rejects.toThrow()
      sim.clearTransportError()
      expect(sim.getLastTransportError()).toBeNull()

      const startTime = Date.now()
      await expect(sim.waitUntilScreenIs(differentScreen(sim), 1500)).rejects.toThrow(/Timeout waiting for screen to be/)
      expect(Date.now() - startTime).toBeGreaterThanOrEqual(1500)
    } finally {
      await sim.close()
    }
  })

  test.concurrent('start() does not mutate the options object', async () => {
    const sim = new Zemu(model.path)
    const shared = { ...defaultOptions, model: model.name }
    try {
      await sim.start(shared)
      expect(shared.startText).toBe('')
      expect(shared.approveKeyword).toBe('')
      expect(sim.startOptions.startText).toBe('Ready')
    } finally {
      await sim.close()
    }
  })
})
