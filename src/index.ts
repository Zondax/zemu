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

import axios from 'axios'
import axiosRetry from 'axios-retry'
import fs from 'fs-extra'
import getPort from 'get-port'
import PNG from 'pngjs'

import HttpTransport from '@ledgerhq/hw-transport-http'
import Transport from '@ledgerhq/hw-transport'

// @ts-expect-error
import elfy from 'elfy'
import { resolve } from 'path'
import rndstr from 'randomstring'

import {
  BASE_NAME,
  DEFAULT_EMU_IMG,
  DEFAULT_HOST,
  DEFAULT_KEY_DELAY,
  DEFAULT_MODEL,
  DEFAULT_START_DELAY,
  DEFAULT_START_TEXT,
  DEFAULT_START_TIMEOUT,
  KILL_TIMEOUT,
  WINDOW_S,
  WINDOW_X,
} from './constants'

import EmuContainer from './emulator'
import GRPCRouter from './grpc'

export const DEFAULT_START_OPTIONS: StartOptions = {
  model: DEFAULT_MODEL,
  sdk: '',
  logging: false,
  custom: '',
  startDelay: DEFAULT_START_DELAY,
  startText: DEFAULT_START_TEXT,
  caseSensitive: false,
  startTimeout: DEFAULT_START_TIMEOUT,
}

export class StartOptions {
  logging = false
  startDelay = DEFAULT_START_DELAY
  custom = ''
  model = DEFAULT_MODEL
  sdk = ''
  startText = DEFAULT_START_TEXT
  caseSensitive = false
  startTimeout = DEFAULT_START_TIMEOUT
}

export interface Snapshot {
  width: number
  height: number
}

export class DeviceModel {
  name!: string
  prefix!: string
  path!: string
}

export default class Zemu {
  private startOptions: StartOptions | undefined
  private host: string
  private transportPort?: number
  protected speculosApiPort?: number

  private desiredTransportPort?: number
  private desiredSpeculosApiPort?: number

  private transportProtocol = 'http'
  private elfPath: string
  private grpcManager: GRPCRouter | null | undefined
  private mainMenuSnapshot: null
  private libElfs: { [p: string]: string }
  private emuContainer: EmuContainer
  private transport: Transport | undefined
  private containerName: string

  constructor(
    elfPath: string,
    libElfs: { [key: string]: string } = {},
    host: string = DEFAULT_HOST,
    desiredTransportPort?: number,
    desiredSpeculosApiPort?: number,
  ) {
    this.host = host
    this.desiredTransportPort = desiredTransportPort
    this.desiredSpeculosApiPort = desiredSpeculosApiPort
    this.elfPath = elfPath
    this.libElfs = libElfs
    this.mainMenuSnapshot = null

    if (this.elfPath == null) {
      throw new Error('elfPath cannot be null!')
    }

    if (!fs.existsSync(this.elfPath)) {
      throw new Error('elf file was not found! Did you compile?')
    }

    Object.keys(libElfs).forEach(libName => {
      if (!fs.existsSync(libElfs[libName])) {
        throw new Error('lib elf file was not found! Did you compile?')
      }
    })

    this.containerName = BASE_NAME + rndstr.generate(12) // generate 12 chars long string
    this.emuContainer = new EmuContainer(this.elfPath, this.libElfs, DEFAULT_EMU_IMG, this.containerName)
  }

  static LoadPng2RGB(filename: string) {
    const tmpBuffer = fs.readFileSync(filename)
    return PNG.PNG.sync.read(tmpBuffer)
  }

  static delay(v: number = DEFAULT_KEY_DELAY) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, v)
  }

  static sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms))
  }

  static async delayedPromise(p: Promise<any>, delay: number) {
    await Promise.race([
      p,
      new Promise(resolve => {
        setTimeout(resolve, delay)
      }),
    ])
  }

  static async stopAllEmuContainers() {
    const timer = setTimeout(function () {
      console.log('Could not kill all containers before timeout!')
      process.exit(1)
    }, KILL_TIMEOUT)
    await EmuContainer.killContainerByName(BASE_NAME)
    clearTimeout(timer)
  }

  static async checkAndPullImage() {
    await EmuContainer.checkAndPullImage(DEFAULT_EMU_IMG)
  }

  static checkElf(model: string, elfPath: string) {
    const elfCodeNanoS = 0xc0d00001
    const elfCodeNanoX = 0xc0de0001
    const elfCodeNanoSP = 0xc0de0001

    const elfApp = fs.readFileSync(elfPath)
    const elfInfo = elfy.parse(elfApp)

    if (elfInfo.entry !== elfCodeNanoS && elfInfo.entry !== elfCodeNanoX && elfInfo.entry !== elfCodeNanoSP) {
      throw new Error('Are you sure is a Nano S/S+/X app ?')
    }
  }

  async start(options: StartOptions) {
    this.startOptions = options

    this.log(`Checking ELF`)
    Zemu.checkElf(this.startOptions.model ?? DEFAULT_MODEL, this.elfPath)

    try {
      await this.assignPortsToListen()

      if (!this.transportPort || !this.speculosApiPort) {
        const e = new Error("The Speculos API port or/and transport port couldn't be reserved")
        this.log(`[ZEMU] ${e}`)
        // noinspection ExceptionCaughtLocallyJS
        throw e
      }

      this.log(`Starting Container`)
      await this.emuContainer.runContainer({
        ...this.startOptions,
        transportPort: this.transportPort.toString(),
        speculosApiPort: this.speculosApiPort.toString(),
      })

      this.log(`Connecting to container`)
      // eslint-disable-next-liwaine func-names
      await this.connect().catch(error => {
        this.log(`${error}`)
        this.close()
        throw error
      })

      // Captures main screen
      this.log(`Wait for start text`)
      await this.waitForText(this.startOptions.startText, this.startOptions.startTimeout, this.startOptions.caseSensitive)

      this.log(`Get initial snapshot`)
      this.mainMenuSnapshot = await this.snapshot()
    } catch (e) {
      this.log(`[ZEMU] ${e}`)
      throw e
    }
  }

  async connect() {
    const transportUrl = `${this.transportProtocol}://${this.host}:${this.transportPort}`
    const start = new Date()
    let connected = false
    const maxWait = this.startOptions?.startDelay ?? DEFAULT_START_DELAY

    while (!connected) {
      const currentTime = new Date()
      const elapsed = currentTime.getTime() - start.getTime()
      if (elapsed > maxWait) {
        throw `Timeout waiting to connect`
      }
      Zemu.delay()

      try {
        // here we should be able to import directly HttpTransport, instead of that Ledger
        // offers a wrapper that returns a `StaticTransport` instance
        // we need to expect the error to avoid typing errors
        // @ts-expect-error
        this.transport = await HttpTransport(transportUrl).open(transportUrl)
        connected = true
      } catch (e) {
        this.log(`WAIT ${this.containerName} ${elapsed} - ${e} ${transportUrl}`)
        connected = false
      }
    }
  }

  log(message: string) {
    if (this.startOptions?.logging ?? false) {
      const currentTimestamp = new Date().toISOString().slice(11, 23)
      process.stdout.write(`[ZEMU] ${currentTimestamp}: ${message}\n`)
    }
  }

  startGRPCServer(ip: string, port: number, options = {}) {
    this.grpcManager = new GRPCRouter(ip, port, options, this.transport)
    this.grpcManager.startServer()
  }

  stopGRPCServer() {
    if (this.grpcManager) {
      this.grpcManager.stopServer()
    }
  }

  async close() {
    this.log('Close')
    await this.emuContainer.stop()

    this.stopGRPCServer()
  }

  getTransport(): Transport {
    if (!this.transport) throw new Error('Transport is not loaded.')

    return this.transport
  }

  getWindowRect() {
    switch (this.startOptions?.model ?? DEFAULT_MODEL) {
      case 'nanos':
        return WINDOW_S
      case 'nanox':
      case 'nanosp':
        return WINDOW_X
    }
    throw `model ${this.startOptions?.model ?? DEFAULT_MODEL} not recognized`
  }

  async fetchSnapshot(url: string) {
    // Exponential back-off retry delay between requests
    axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay })

    return axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
    })
  }

  saveSnapshot(arrayBuffer: Buffer, filePath: string) {
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer), 'binary')
  }

  convertBufferToPNG(arrayBuffer: Buffer) {
    return PNG.PNG.sync.read(Buffer.from(arrayBuffer))
  }

  async snapshot(filename?: string): Promise<any> {
    const snapshotUrl = 'http://localhost:' + this.speculosApiPort?.toString() + '/screenshot'
    const { data } = await this.fetchSnapshot(snapshotUrl)
    const modelWindow = this.getWindowRect()

    if (filename) this.saveSnapshot(data, filename)

    const rect = {
      height: modelWindow.height,
      width: modelWindow.width,
      data,
    }

    return rect
  }

  async getMainMenuSnapshot() {
    return this.mainMenuSnapshot
  }

  async waitUntilScreenIsNot(screen: any, timeout = 60000) {
    const start = new Date()

    const inputSnapshotBufferHex = this.convertBufferToPNG((await screen).data)
    let currentSnapshotBufferHex = this.convertBufferToPNG((await this.snapshot()).data)

    this.log(`Wait for screen change`)

    while (inputSnapshotBufferHex.data.equals(currentSnapshotBufferHex.data)) {
      const currentTime = new Date()
      const elapsed = currentTime.getTime() - start.getTime()
      if (elapsed > timeout) {
        throw `Timeout waiting for screen to change (${timeout} ms)`
      }
      Zemu.delay()
      this.log(`Check [${elapsed}ms]`)
      currentSnapshotBufferHex = this.convertBufferToPNG((await this.snapshot()).data)
    }

    this.log(`Screen changed`)
  }

  formatIndexString(i: number) {
    return `${i}`.padStart(5, '0')
  }

  getSnapshotPath(snapshotPrefix: string, index: number, takeSnapshots: boolean) {
    return takeSnapshots ? `${snapshotPrefix}/${this.formatIndexString(index)}.png` : undefined
  }

  async navigate(
    path: string,
    testcaseName: string,
    clickSchedule: number[],
    waitForScreenUpdate = true,
    takeSnapshots = true,
    startImgIndex = 0,
  ) {
    const snapshotPrefixGolden = resolve(`${path}/snapshots/${testcaseName}`)
    const snapshotPrefixTmp = resolve(`${path}/snapshots-tmp/${testcaseName}`)

    if (takeSnapshots) {
      fs.ensureDirSync(snapshotPrefixGolden)
      fs.ensureDirSync(snapshotPrefixTmp)
    }

    let imageIndex = startImgIndex
    let filename = this.getSnapshotPath(snapshotPrefixTmp, imageIndex, takeSnapshots)
    this.log(`---------------------------`)
    this.log(`Start        ${filename}`)
    await this.snapshot(filename)
    this.log(`Instructions ${clickSchedule}`)

    for (const value of clickSchedule) {
      // Both click action
      if (value == 0) {
        imageIndex += 1
        filename = this.getSnapshotPath(snapshotPrefixTmp, imageIndex, takeSnapshots)
        await this.clickBoth(filename, waitForScreenUpdate)
        continue
      }

      // Move forward/backwards
      for (let j = 0; j < Math.abs(value); j += 1) {
        imageIndex += 1
        filename = this.getSnapshotPath(snapshotPrefixTmp, imageIndex, takeSnapshots)
        if (value < 0) {
          await this.clickLeft(filename, waitForScreenUpdate)
        } else {
          await this.clickRight(filename, waitForScreenUpdate)
        }
      }
    }

    await this.dumpEvents()
    return imageIndex
  }

  async takeSnapshotAndOverwrite(path: string, testcaseName: string, imageIndex: number) {
    const snapshotPrefixTmp = resolve(`${path}/snapshots-tmp/${testcaseName}`)
    fs.ensureDirSync(snapshotPrefixTmp)
    const filename = this.getSnapshotPath(snapshotPrefixTmp, imageIndex, true)

    try {
      if (typeof filename === 'undefined') throw Error
      fs.unlinkSync(filename)
    } catch (err) {
      console.log(err)
      throw new Error('Snapshot does not exist')
    }
    await this.snapshot(filename)
  }

  async navigateAndCompareSnapshots(
    path: string,
    testcaseName: string,
    clickSchedule: number[],
    waitForScreenUpdate = true,
    startImgIndex = 0,
  ) {
    const takeSnapshots = true
    const lastImgIndex = await this.navigate(path, testcaseName, clickSchedule, waitForScreenUpdate, takeSnapshots, startImgIndex)
    return this.compareSnapshots(path, testcaseName, lastImgIndex)
  }

  async compareSnapshots(path: string, testcaseName: string, snapshotCount: number): Promise<boolean> {
    const snapshotPrefixGolden = resolve(`${path}/snapshots/${testcaseName}`)
    const snapshotPrefixTmp = resolve(`${path}/snapshots-tmp/${testcaseName}`)

    this.log(`golden      ${snapshotPrefixGolden}`)
    this.log(`tmp         ${snapshotPrefixTmp}`)

    ////////////////////
    this.log(`Start comparison`)
    for (let j = 0; j < snapshotCount + 1; j += 1) {
      this.log(`Checked     ${snapshotPrefixTmp}/${this.formatIndexString(j)}.png`)
      const img1 = Zemu.LoadPng2RGB(`${snapshotPrefixTmp}/${this.formatIndexString(j)}.png`)
      const img2 = Zemu.LoadPng2RGB(`${snapshotPrefixGolden}/${this.formatIndexString(j)}.png`)

      if (!img1.data.equals(img2.data)) {
        throw new Error(`Image [${this.formatIndexString(j)}] do not match!`)
      }
    }

    return true
  }

  /**
   * @deprecated The method will be deprecated soon. Try to use navigateAndCompareSnapshots instead
   */
  async compareSnapshotsAndAccept(path: string, testcaseName: string, snapshotCount: number, backClickCount = 0) {
    const instructions = []
    if (snapshotCount > 0) instructions.push(snapshotCount)
    if (backClickCount > 0) {
      instructions.push(-backClickCount)
      instructions.push(backClickCount)
    }
    instructions.push(0)
    return this.navigateAndCompareSnapshots(path, testcaseName, instructions)
  }

  async compareSnapshotsAndApprove(
    path: string,
    testcaseName: string,
    waitForScreenUpdate = true,
    startImgIndex = 0,
    timeout = 30000,
  ): Promise<boolean> {
    return this.navigateAndCompareUntilText(path, testcaseName, 'APPROVE', waitForScreenUpdate, startImgIndex, timeout)
  }

  async navigateUntilText(
    path: string,
    testcaseName: string,
    text: string,
    waitForScreenUpdate = true,
    takeSnapshots = true,
    startImgIndex = 0,
    timeout = 30000,
  ): Promise<number> {
    const snapshotPrefixGolden = resolve(`${path}/snapshots/${testcaseName}`)
    const snapshotPrefixTmp = resolve(`${path}/snapshots-tmp/${testcaseName}`)

    if (takeSnapshots) {
      fs.ensureDirSync(snapshotPrefixGolden)
      fs.ensureDirSync(snapshotPrefixTmp)
    }

    let imageIndex = startImgIndex
    let filename = this.getSnapshotPath(snapshotPrefixTmp, imageIndex, takeSnapshots)
    await this.snapshot(filename)

    let start = new Date()

    let found = false

    while (!found) {
      const currentTime = new Date()
      const elapsed = currentTime.getTime() - start.getTime()

      if (elapsed > timeout) {
        throw `Timeout waiting for screen containing ${text}`
      }

      const events = await this.getEvents()
      imageIndex += 1
      filename = this.getSnapshotPath(snapshotPrefixTmp, imageIndex, takeSnapshots)

      found = events.some((event: any) => event.text.includes(text))

      if (found) {
        await this.clickBoth(filename, waitForScreenUpdate)
      } else {
        // navigate to next screen
        await this.clickRight(filename, waitForScreenUpdate)
        start = new Date()
      }
    }
    return imageIndex
  }

  async navigateAndCompareUntilText(
    path: string,
    testcaseName: string,
    text: string,
    waitForScreenUpdate = true,
    startImgIndex = 0,
    timeout = 30000,
  ): Promise<boolean> {
    const takeSnapshots = true
    const lastImgIndex = await this.navigateUntilText(path, testcaseName, text, waitForScreenUpdate, takeSnapshots, startImgIndex, timeout)
    return this.compareSnapshots(path, testcaseName, lastImgIndex)
  }

  async getEvents() {
    axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay })
    const eventsUrl = 'http://localhost:' + this.speculosApiPort?.toString() + '/events'
    try {
      const { data } = await axios.get(eventsUrl)
      return data['events']
    } catch (error) {
      return []
    }
  }

  async deleteEvents() {
    await axios({
      method: 'DELETE',
      url: 'http://localhost:' + this.speculosApiPort?.toString() + '/events',
    })
  }

  async dumpEvents() {
    const events = await this.getEvents()
    if (events) {
      events.forEach((x: any) => this.log(`[ZEMU] ${JSON.stringify(x)}`))
    }
  }

  async waitScreenChange(timeout = 30000) {
    const start = new Date()
    const prev_events_qty = (await this.getEvents()).length
    let current_events_qty = prev_events_qty
    this.log(`Wait for screen change`)

    while (prev_events_qty === current_events_qty) {
      const currentTime = new Date()
      const elapsed = currentTime.getTime() - start.getTime()
      if (elapsed > timeout) {
        throw `Timeout waiting for screen to change (${timeout} ms)`
      }
      Zemu.delay()
      this.log(`Check [${elapsed}ms]`)
      current_events_qty = (await this.getEvents()).length
    }
    this.log(`Screen changed`)
  }

  async waitForText(text: string | RegExp, timeout = 60000, caseSensitive = false) {
    const start = new Date()
    let found = false
    const flags = !caseSensitive ? 'i' : ''
    const startRegex = new RegExp(text, flags)

    while (!found) {
      const currentTime = new Date()
      const elapsed = currentTime.getTime() - start.getTime()
      if (elapsed > timeout) {
        throw `Timeout (${timeout}) waiting for text (${text})`
      }

      const events = await this.getEvents()
      found = events.some((event: any) => startRegex.test(event.text))
      Zemu.delay()
    }
  }

  async click(endpoint: string, filename?: string, waitForScreenUpdate?: boolean) {
    let previousScreen
    if (waitForScreenUpdate) previousScreen = await this.snapshot()

    const bothClickUrl = 'http://localhost:' + this.speculosApiPort?.toString() + endpoint
    const payload = { action: 'press-and-release' }
    await axios.post(bothClickUrl, payload)
    this.log(`Click ${endpoint} -> ${filename}`)

    // Wait and poll Speculos until the application screen gets updated
    if (waitForScreenUpdate) await this.waitUntilScreenIsNot(previousScreen)
    else Zemu.delay() // A minimum delay is required

    return this.snapshot(filename)
  }

  async clickLeft(filename?: string, waitForScreenUpdate = true) {
    return this.click('/button/left', filename, waitForScreenUpdate)
  }

  async clickRight(filename?: string, waitForScreenUpdate = true) {
    return this.click('/button/right', filename, waitForScreenUpdate)
  }

  async clickBoth(filename?: string, waitForScreenUpdate = true) {
    return this.click('/button/both', filename, waitForScreenUpdate)
  }

  private async assignPortsToListen(): Promise<void> {
    if (!this.transportPort || !this.speculosApiPort) {
      const transportPort = await getPort({ port: this.desiredTransportPort })
      const speculosApiPort = await getPort({ port: this.desiredSpeculosApiPort })

      this.transportPort = transportPort
      this.speculosApiPort = speculosApiPort
    }
  }
}
