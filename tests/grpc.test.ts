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

// These tests exercise the compiled package in dist/ (run `pnpm build` first).
// They guard against shipping the .proto file in the wrong place, which broke
// startGRPCServer() in published releases without any test noticing.
describe('gRPC router (dist)', () => {
  const distRouter = resolve('dist/grpc/index.js')
  const distProto = resolve('dist/grpc/zemu.proto')

  test('zemu.proto is shipped next to the compiled router', () => {
    expect(existsSync(distRouter)).toBe(true)
    expect(existsSync(distProto)).toBe(true)
  })

  test('router starts and stops from the compiled package', async () => {
    const GRPCRouter = require(distRouter).default
    const fakeTransport = { exchange: async () => Buffer.from([0x90, 0x00]) }
    const router = new GRPCRouter('127.0.0.1', 0, fakeTransport)
    await router.startServer()
    router.stopServer()
  })
})
