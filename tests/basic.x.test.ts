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

const Resolve = require('path').resolve

jest.setTimeout(60000)
const DEMO_APP_PATH_X = Resolve('bin/demoAppX.elf')

const APP_SEED = 'equip will roof matter pink blind book anxiety banner elbow sun young'

beforeAll(async () => {
  await Zemu.checkAndPullImage()
})

const ZEMU_OPTIONS_X: StartOptions = {
  ...DEFAULT_START_OPTIONS,
  X11: false,
  logging: true,
  custom: `-s "${APP_SEED}" `,
  model: 'nanox',
}

test('File-Missing', () => {
  expect(() => {
    new Zemu('it_does_not_exist')
  }).toThrow(/Did you compile/)
})

test('Start&Close-NanoX', async () => {
  const sim = new Zemu(DEMO_APP_PATH_X)
  expect(sim).not.toBeNull()
  try {
    await sim.start(ZEMU_OPTIONS_X)
  } finally {
    await sim.close()
  }
})

test('Basic Control - X', async () => {
  const sim = new Zemu(DEMO_APP_PATH_X)
  try {
    await sim.start(ZEMU_OPTIONS_X)

    await sim.clickLeft()
    await sim.clickLeft()
    await sim.clickLeft()

    // Move up and down and check screens
    const view0 = await sim.snapshot('tests/tmpX/00000.png')
    const view1 = await sim.clickRight('tests/tmpX/00001.png')
    const view2 = await sim.clickLeft('tests/tmpX/00002.png')

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
  const sim = new Zemu(DEMO_APP_PATH_X)
  try {
    await sim.start(ZEMU_OPTIONS_X)
    const result = sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot(), 2000)
    await expect(result).rejects.toEqual('Timeout waiting for screen to change (2000 ms)')
  } finally {
    await sim.close()
  }
})
