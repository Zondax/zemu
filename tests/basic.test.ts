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
import { createPublicKey, verify } from 'node:crypto'
import { PolkadotGenericApp } from '@zondax/ledger-substrate'
import { describe, expect, test } from 'vitest'
import Zemu, { zondaxMainmenuNavigation } from '../src'
import { defaultOptions, models, nanoModels, PATH, POLYMESH_SS58_PREFIX, SNAPSHOTS_DIR } from './common'
import { exchangeViaGrpc } from './grpcClient'

// DER prefix for a raw Ed25519 public key (SubjectPublicKeyInfo)
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

function verifyEd25519(message: Buffer, signature: Buffer, pubKey: Buffer): boolean {
  const key = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, pubKey]), format: 'der', type: 'spki' })
  return verify(null, message, key, signature)
}

test('File-Missing', () => {
  expect(() => {
    new Zemu('it_does_not_exist')
  }).toThrow(/Did you compile/)
})

test('Load/Compare Snapshots', () => {
  const image1A = Zemu.LoadPng2RGB('tests/snapshots/image1A.png')
  const image1B = Zemu.LoadPng2RGB('tests/snapshots/image1B.png')
  const image2A = Zemu.LoadPng2RGB('tests/snapshots/image2A.png')

  expect(image1A).toEqual(image1B)
  expect(image1A).not.toEqual(image2A)
})

test('Nano S is rejected with a clear error', () => {
  expect(() => Zemu.checkElf('nanos' as any, nanoModels[0].path)).toThrow(/no longer supported/)
})

describe.each(models)('$name', (m) => {
  const prefix = m.prefix.toLowerCase()

  test.concurrent('start and close', async () => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      expect(sim.getMainMenuSnapshot().data.length).toBeGreaterThan(0)
    } finally {
      await sim.close()
    }
  })

  test.concurrent('wait for change / timeout', async () => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const result = sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot(), 2000)
      await expect(result).rejects.toThrowError('Timeout waiting for screen to be not (2000 ms)')
    } finally {
      await sim.close()
    }
  })

  test.concurrent('main menu navigation and snapshots', async () => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const nav = zondaxMainmenuNavigation(m.name)
      expect(await sim.navigateAndCompareSnapshots(SNAPSHOTS_DIR, `${prefix}-mainmenu`, nav.schedule)).toBe(true)
    } finally {
      await sim.close()
    }
  })

  test.concurrent('get app version', async () => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new PolkadotGenericApp(sim.getTransport(), 'polymesh')
      const resp = await app.getVersion()

      expect(resp).toHaveProperty('major')
      expect(resp).toHaveProperty('minor')
      expect(resp).toHaveProperty('patch')
      expect(sim.getLastTransportError()).toBeNull()
    } finally {
      await sim.close()
    }
  })

  test.concurrent('sign raw payload and approve', async () => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new PolkadotGenericApp(sim.getTransport(), 'polymesh')

      const txBlob = Buffer.from('<Bytes>This is our test payload!</Bytes>')
      const { pubKey } = await app.getAddressEd25519(PATH, POLYMESH_SS58_PREFIX)

      // do not await here, the UI has to be driven first
      const signatureRequest = app.signRawEd25519(PATH, txBlob)
      // avoid an unhandled rejection if the UI flow fails before the signature is awaited
      signatureRequest.catch(() => undefined)

      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      expect(await sim.compareSnapshotsAndApprove(SNAPSHOTS_DIR, `${prefix}-sign_raw`)).toBe(true)

      const { signature } = await signatureRequest
      // First byte is the signature scheme
      expect(verifyEd25519(txBlob, signature.subarray(1), Buffer.from(pubKey, 'hex'))).toBe(true)
    } finally {
      await sim.close()
    }
  })
})

describe.each(nanoModels)('$name buttons', (m) => {
  const prefix = m.prefix.toLowerCase()

  test.concurrent('basic control', async () => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })

      await sim.clickLeft(undefined, false)
      await sim.clickLeft(undefined, false)
      await sim.clickLeft(undefined, false)

      // Move up and down and check screens
      const view0 = await sim.snapshot(`tests/snapshots-tmp/${prefix}-basic/00000.png`)
      const view1 = await sim.clickRight(`tests/snapshots-tmp/${prefix}-basic/00001.png`)
      const view2 = await sim.clickLeft(`tests/snapshots-tmp/${prefix}-basic/00002.png`)

      // compare to check that it went back to the same view
      expect(view2).toEqual(view0)
      expect(view1).not.toEqual(view0)
    } finally {
      await sim.close()
    }
  })

  test.concurrent('navigate until text', async () => {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      expect(await sim.navigateAndCompareUntilText(SNAPSHOTS_DIR, `${prefix}-until_expert`, 'Expert', true, 0, 5000, false)).toBe(true)
    } finally {
      await sim.close()
    }
  })
})

test('gRPC server forwards APDUs to the device', async () => {
  const m = nanoModels[0]
  const sim = new Zemu(m.path)
  try {
    await sim.start({ ...defaultOptions, model: m.name })
    const port = await sim.startGRPCServer('127.0.0.1', 0)
    expect(port).toBeGreaterThan(0)

    // GET_APP_INFO (handled by the OS): format id 1, then the app name
    const reply = await exchangeViaGrpc(port, Buffer.from([0xb0, 0x01, 0x00, 0x00, 0x00]))
    expect(reply.readUInt16BE(reply.length - 2)).toBe(0x9000)
    expect(reply[0]).toBe(1)
    expect(reply.subarray(2, 2 + reply[1]).toString('ascii')).toBe('Polymesh')

    sim.stopGRPCServer()
    await expect(exchangeViaGrpc(port, Buffer.alloc(0))).rejects.toThrow()
  } finally {
    await sim.close()
  }
})
