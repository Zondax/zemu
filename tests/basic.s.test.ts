// noinspection SpellCheckingInspection

/** ******************************************************************************
 *  (c) 2020 Zondax GmbH
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
import Zemu, { DEFAULT_START_OPTIONS, StartOptions } from '../src'
import MinimalApp from './minapp'
import { newPolymeshApp } from '@zondax/ledger-substrate'

const Resolve = require('path').resolve

jest.setTimeout(60000)
const DEMO_APP_PATH_S = Resolve('bin/demoAppS.elf')
const DEMO_APP2_PATH_S = Resolve('bin/app_s.elf')

const APP_SEED = 'equip will roof matter pink blind book anxiety banner elbow sun young'

beforeAll(async () => {
  await Zemu.checkAndPullImage()
})

const ZEMU_OPTIONS_S: StartOptions = {
  ...DEFAULT_START_OPTIONS,
  X11: false,
  logging: true,
  custom: `-s "${APP_SEED}" `,
}

test('File-Missing', () => {
  expect(() => {
    new Zemu('it_does_not_exist')
  }).toThrow(/Did you compile/)
})

test('Start&Close-NanoS', async () => {
  const sim = new Zemu(DEMO_APP_PATH_S)
  expect(sim).not.toBeNull()
  try {
    await sim.start(ZEMU_OPTIONS_S)
  } finally {
    await sim.close()
  }
})

test('Basic Control - S', async () => {
  const sim = new Zemu(DEMO_APP_PATH_S)
  try {
    await sim.start(ZEMU_OPTIONS_S)

    await sim.clickLeft(undefined, false)
    await sim.clickLeft(undefined, false)
    await sim.clickLeft(undefined, false)

    // Move up and down and check screens
    const view0 = await sim.snapshot('tests/tmp/00000.png')
    const view1 = await sim.clickRight('tests/tmp/00001.png', false)
    const view2 = await sim.clickLeft('tests/tmp/00002.png', false)

    // compare to check that it went back to the same view
    expect(view2).toEqual(view0)
    expect(view1).not.toEqual(view0)
  } finally {
    await sim.close()
  }
})

test('Load/Compare Snapshots', async () => {
  const image1A = Zemu.LoadPng2RGB('tests/snapshots/image1A.png')
  const image1B = Zemu.LoadPng2RGB('tests/snapshots/image1B.png')
  const image2A = Zemu.LoadPng2RGB('tests/snapshots/image2A.png')

  expect(image1A).toEqual(image1B)
  expect(image1A).not.toEqual(image2A)
})

test('Wait for change / timeout', async () => {
  const sim = new Zemu(DEMO_APP_PATH_S)
  try {
    await sim.start(ZEMU_OPTIONS_S)
    const result = sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot(), 5000)
    await expect(result).rejects.toEqual('Timeout waiting for screen to change (5000 ms)')
  } finally {
    await sim.close()
  }
})

test('Snapshot and compare', async () => {
  const sim = new Zemu(DEMO_APP_PATH_S)
  try {
    await sim.start(ZEMU_OPTIONS_S)
    expect(await sim.compareSnapshotsAndAccept('tests', 'compare_test', 1)).toBeTruthy()
  } finally {
    await sim.close()
  }
})

test('Snapshot and compare 2', async () => {
  const sim = new Zemu(DEMO_APP_PATH_S)
  try {
    await sim.start(ZEMU_OPTIONS_S)

    expect(await sim.compareSnapshotsAndAccept('tests', 'compare_test2', 1, 1)).toBeTruthy()
  } finally {
    await sim.close()
  }
})

// eslint-disable-next-line jest/expect-expect
test('GRPC Server start-stop', async () => {
  const sim = new Zemu(DEMO_APP_PATH_S)
  await sim.start(ZEMU_OPTIONS_S)
  sim.startGRPCServer('localhost', 3002)
  await Zemu.sleep(3000)
  await sim.close()
})

test('Get app info', async () => {
  const sim = new Zemu(DEMO_APP_PATH_S)
  expect(sim).not.toBeNull()
  try {
    await sim.start(ZEMU_OPTIONS_S)
    const app = new MinimalApp(sim.getTransport())
    const resp = await app.appInfo()

    console.log(resp)
  } finally {
    await sim.close()
  }
})

test('sign real app', async function () {
  const sim = new Zemu(DEMO_APP2_PATH_S)
  try {
    const defaultOptions = {
      ...DEFAULT_START_OPTIONS,
      logging: true,
      custom: `-s "${APP_SEED}"`,
      X11: false,
    }

    await sim.start({ ...defaultOptions, model: 'nanos' })
    const app = newPolymeshApp(sim.getTransport())
    const pathAccount = 0x80000000
    const pathChange = 0x80000000
    const pathIndex = 0x80000000

    const txBasic =
      '050000ca1ef1d326bd379143d6e743f6c3b51b7058d07e02e4614dc027e05bdb226c6503d2029649d503ae1103008ed73e0db80b0000010000006fbd74e5e1d0a61d52ccfe9d4adaed16dd3a7caa37c6bc4d0c2fa12e8b2f40636fbd74e5e1d0a61d52ccfe9d4adaed16dd3a7caa37c6bc4d0c2fa12e8b2f4063'
    const txBlob = Buffer.from(txBasic, 'hex')

    const signatureRequest = app.sign(pathAccount, pathChange, pathIndex, txBlob)
    await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
    await sim.compareSnapshotsAndApprove('.', `s-sign_basic_normal`)

    const signatureResponse = await signatureRequest
    console.log(signatureResponse)

    expect(signatureResponse.return_code).toEqual(0x9000)
    expect(signatureResponse.error_message).toEqual('No errors')
  } finally {
    await sim.close()
  }
})
