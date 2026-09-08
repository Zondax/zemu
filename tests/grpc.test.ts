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
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { exchangeViaGrpc } from './grpcClient'

// These tests exercise the compiled package in dist/ (run `pnpm build` first).
// They guard against shipping the .proto file in the wrong place, which broke
// startGRPCServer() in published releases without any test noticing.
const distRouter = resolve('dist/grpc/index.js')
const distProto = resolve('dist/grpc/zemu.proto')

describe('gRPC router (dist)', () => {
  test('zemu.proto is shipped next to the compiled router', () => {
    expect(existsSync(distRouter)).toBe(true)
    expect(existsSync(distProto)).toBe(true)
  })

  test('forwards Exchange to the transport and stops', async () => {
    const GRPCRouter = require(distRouter).default
    const seen: Buffer[] = []
    const fakeTransport = {
      exchange: (apdu: Buffer) => {
        seen.push(apdu)
        return Promise.resolve(Buffer.from([0x01, 0x02, 0x90, 0x00]))
      },
    }
    const router = new GRPCRouter('127.0.0.1', 0, fakeTransport)
    const port = await router.startServer()
    expect(port).toBeGreaterThan(0)

    try {
      const reply = await exchangeViaGrpc(port, Buffer.from([0xb0, 0x01, 0x00, 0x00, 0x00]))
      expect(reply).toEqual(Buffer.from([0x01, 0x02, 0x90, 0x00]))
      expect(seen).toEqual([Buffer.from([0xb0, 0x01, 0x00, 0x00, 0x00])])
    } finally {
      router.stopServer()
    }

    // After shutdown the port no longer answers
    await expect(exchangeViaGrpc(port, Buffer.alloc(0))).rejects.toThrow()
  })

  test('transport failures are propagated to the client', async () => {
    const GRPCRouter = require(distRouter).default
    const failingTransport = {
      exchange: () => Promise.reject(new Error('device unplugged')),
    }
    const router = new GRPCRouter('127.0.0.1', 0, failingTransport)
    const port = await router.startServer()
    try {
      await expect(exchangeViaGrpc(port, Buffer.alloc(0))).rejects.toThrow(/device unplugged/)
    } finally {
      router.stopServer()
    }
  })
})
