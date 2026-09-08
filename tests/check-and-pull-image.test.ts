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
import { PassThrough } from 'node:stream'
import Docker from 'dockerode'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import Zemu from '../src'
import { DEFAULT_EMU_IMG } from '../src/constants'
import EmuContainer from '../src/emulator'

// Regression tests for #564. None of these talk to a Docker daemon: `Docker.prototype.pull` is
// replaced with a fake stream, while `docker.modem.followProgress` stays real so the tests drive the
// same code path that used to stall when the pull failed.

const IMAGE = 'zondax/does-not-matter:test'

function fakePull(): PassThrough {
  const stream = new PassThrough()
  vi.spyOn(Docker.prototype, 'pull').mockImplementation(() => Promise.resolve(stream as any))
  return stream
}

describe('EmuContainer.checkAndPullImage', () => {
  beforeEach(() => {
    // Keep pull progress out of the test output
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('rejects when the pull request itself fails', async () => {
    const error = new Error('connect ENOENT /var/run/docker.sock')
    vi.spyOn(Docker.prototype, 'pull').mockImplementation(() => Promise.reject(error))

    await expect(EmuContainer.checkAndPullImage(IMAGE)).rejects.toBe(error)
  })

  test('rejects when the pull stream errors after progress started', async () => {
    const stream = fakePull()
    const error = new Error('unexpected EOF')

    const pending = EmuContainer.checkAndPullImage(IMAGE)
    stream.write('{"status":"Pulling from zondax/does-not-matter"}\n')
    setImmediate(() => stream.emit('error', error))

    await expect(pending).rejects.toBe(error)
  })

  test('rejects when the pull stream produces no progress for longer than the inactivity timeout', async () => {
    const stream = fakePull()
    const destroy = vi.spyOn(stream, 'destroy')

    const pending = EmuContainer.checkAndPullImage(IMAGE, 50)
    stream.write('{"status":"Waiting"}\n')

    await expect(pending).rejects.toThrow(/no progress for 50 ms/)
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  test('keeps waiting while progress events keep arriving', async () => {
    const stream = fakePull()

    const pending = EmuContainer.checkAndPullImage(IMAGE, 80)
    // Each event lands inside the timeout window but the whole pull takes longer than one window
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 40))
      stream.write(`{"status":"Downloading","progress":"${i * 20}%"}\n`)
    }
    stream.end()

    await expect(pending).resolves.toBeUndefined()
  })

  test('resolves when the pull completes', async () => {
    const stream = fakePull()

    const pending = EmuContainer.checkAndPullImage(IMAGE)
    stream.write('{"status":"Pull complete"}\n')
    stream.end()

    await expect(pending).resolves.toBeUndefined()
  })

  test('passes the inactivity timeout to the Docker client as socket timeout', async () => {
    const stream = fakePull()
    let clientTimeout: number | undefined
    vi.spyOn(Docker.prototype, 'pull').mockImplementation(function (this: Docker) {
      clientTimeout = (this.modem as { timeout?: number }).timeout
      return Promise.resolve(stream as any)
    })

    const pending = EmuContainer.checkAndPullImage(IMAGE, 1234)
    stream.end()
    await pending

    expect(clientTimeout).toBe(1234)
  })
})

describe('Zemu.checkAndPullImage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('pulls the default emulator image and propagates failures', async () => {
    const error = new Error('pull failed')
    const spy = vi.spyOn(EmuContainer, 'checkAndPullImage').mockRejectedValue(error)

    await expect(Zemu.checkAndPullImage()).rejects.toBe(error)
    expect(spy).toHaveBeenCalledWith(DEFAULT_EMU_IMG)
  })
})
