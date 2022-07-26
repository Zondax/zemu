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
import PNG from 'pngjs'
import fs from 'fs-extra'
import sleep from 'sleep'
import getPort from 'get-port'
import axios from 'axios'
import axiosRetry from 'axios-retry'

// @ts-ignore
import TransportHttp from '@ledgerhq/hw-transport-http'
// @ts-ignore
import elfy from 'elfy'
// @ts-ignore
import GRPCRouter from './grpc'
import {
  BASE_NAME,
  DEFAULT_EMU_IMG,
  DEFAULT_HOST,
  DEFAULT_KEY_DELAY,
  DEFAULT_MODEL,
  DEFAULT_START_DELAY,
  DEFAULT_START_TIMEOUT,
  KILL_TIMEOUT,
  WINDOW_S,
  WINDOW_X,
} from './constants'
import EmuContainer from './emulator'
import Transport from '@ledgerhq/hw-transport'

const Resolve = require('path').resolve
const rndstr = require('randomstring')

export const DEFAULT_START_OPTIONS = {
  model: DEFAULT_MODEL,
  sdk: '',
  logging: false,
  X11: false,
  custom: '',
  startDelay: DEFAULT_START_DELAY,
  pressDelay: DEFAULT_KEY_DELAY,
  startText: 'Ready',
  caseSensitive: false,
  startTimeout: DEFAULT_START_TIMEOUT,
}

export class StartOptions {
  model = 'nanos'
  sdk = ''
  logging = false
  /**
  * @deprecated [ZEMU] X11 support is deprecated and not supported anymore
  */
  X11 = false
  custom = ''
  startDelay = DEFAULT_START_DELAY
  startText = 'Ready'
  caseSensitive = false
  startTimeout = 1000
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
  private speculosApiPort?: number

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

    this.containerName = BASE_NAME + rndstr.generate()
    this.emuContainer = new EmuContainer(this.elfPath, this.libElfs, DEFAULT_EMU_IMG, this.containerName)
  }

  static LoadPng2RGB(filename: string) {
    const tmpBuffer = fs.readFileSync(filename)
    return PNG.PNG.sync.read(tmpBuffer)
  }

  static delay(v: number) {
    if (v) {
      sleep.msleep(v)
    } else {
      sleep.msleep(DEFAULT_KEY_DELAY)
    }
  }

  static sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  static async delayedPromise(p: any, delay: number) {
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
      await Zemu.stopAllEmuContainers()
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
    const transport_url = `${this.transportProtocol}://${this.host}:${this.transportPort}`
    const start = new Date()
    let connected = false
    const maxWait = this.startOptions?.startDelay ?? DEFAULT_START_DELAY

    while (!connected) {
      const currentTime = new Date()
      const elapsed: any = currentTime.getTime() - start.getTime()
      if (elapsed > maxWait) {
        throw `Timeout waiting to connect`
      }
      Zemu.delay(100)

      try {
        // Here it should be "StaticTransport" type, in order to be able to use the static method "open". That method belongs to StaticTransport
        // https://github.com/LedgerHQ/ledgerjs/blob/0ec9a60fe57d75dff26a69c213fd824aa321231c/packages/hw-transport-http/src/withStaticURLs.ts#L89
        this.transport = await (TransportHttp(transport_url) as any).open(transport_url)
        connected = true
      } catch (e) {
        this.log(`WAIT ${this.containerName} ${elapsed} - ${e} ${transport_url}`)
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
    const response = await this.fetchSnapshot(snapshotUrl)
    const modelWindow = this.getWindowRect()

    if (filename) {
      this.saveSnapshot(response.data, filename)
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return new Promise((resolve, reject) => {
      const rect = {
        width: modelWindow.width,
        height: modelWindow.height,
        data: response.data,
      }
      resolve(rect)
    })
  }

  async getMainMenuSnapshot() {
    return this.mainMenuSnapshot
  }

  async waitUntilScreenIsNot(screen: any, timeout = 10000) {
    const start = new Date()

    const inputSnapshotBufferHex = this.convertBufferToPNG((await screen).data)
    let currentSnapshotBufferHex = this.convertBufferToPNG((await this.snapshot()).data)

    this.log(`Wait for screen change`)


    while (inputSnapshotBufferHex.data.equals(currentSnapshotBufferHex.data)) {
      const currentTime = new Date()
      const elapsed: any = currentTime.getTime() - start.getTime()
      if (elapsed > timeout) {
        throw `Timeout waiting for screen to change (${timeout} ms)`
      }
      await Zemu.delay(500)
      this.log(`Check [${elapsed}ms]`)
      currentSnapshotBufferHex = this.convertBufferToPNG((await this.snapshot()).data)
    }

    this.log(`Screen changed`)
  }

  formatIndexString(i: number) {
    return `${i}`.padStart(5, '0')
  }



  async navigate(path: string, testcaseName: string, clickSchedule: number[],
                waitForScreenUpdate = true,  takeSnapshots = true, startImgIndex = 0) {

      const snapshotPrefixGolden = Resolve(`${path}/snapshots/${testcaseName}`)
      const snapshotPrefixTmp = Resolve(`${path}/snapshots-tmp/${testcaseName}`)

      fs.ensureDirSync(snapshotPrefixGolden)
      fs.ensureDirSync(snapshotPrefixTmp)

      let imageIndex = startImgIndex
      const filename = takeSnapshots ? `${snapshotPrefixTmp}/${this.formatIndexString(imageIndex)}.png` : undefined
      this.log(`---------------------------`)
      this.log(`Start        ${filename}`)
      await this.snapshot(filename)
      this.log(`Instructions ${clickSchedule}`)

      for (let i = 0; i < clickSchedule.length; i++) {
        const value = clickSchedule[i]
        if (value == 0) {
          imageIndex += 1
          const filename = takeSnapshots ? `${snapshotPrefixTmp}/${this.formatIndexString(imageIndex)}.png` : undefined
          await this.clickBoth(filename, waitForScreenUpdate)
          continue
        }

        if (value < 0) {
          // Move backwards
          for (let j = 0; j < -value; j += 1) {
            imageIndex += 1
            const filename = takeSnapshots ? `${snapshotPrefixTmp}/${this.formatIndexString(imageIndex)}.png` : undefined
            await this.clickLeft(filename, waitForScreenUpdate)
          }
          continue
        }

        // Move forward
        for (let j = 0; j < value; j += 1) {
          imageIndex += 1
          const filename = takeSnapshots ? `${snapshotPrefixTmp}/${this.formatIndexString(imageIndex)}.png` : undefined
          await this.clickRight(filename, waitForScreenUpdate)
        }
      }

      await this.dumpEvents()
      return imageIndex
  }

  async navigateAndCompareSnapshots(path: string, testcaseName: string, clickSchedule: number[],
                                    waitForScreenUpdate = true, startImgIndex = 0) {
    const takeSnapshots = true
    const lastImgIndex = await this.navigate(path, testcaseName, clickSchedule, waitForScreenUpdate, takeSnapshots, startImgIndex)
    return this.compareSnapshots(path, testcaseName, lastImgIndex)
  }

  async compareSnapshots(path: string, testcaseName: string, snapshotCount: number): Promise<boolean> {
    const snapshotPrefixGolden = Resolve(`${path}/snapshots/${testcaseName}`)
    const snapshotPrefixTmp = Resolve(`${path}/snapshots-tmp/${testcaseName}`)

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

  async compareSnapshotsAndApprove(path: string, testcaseName: string, waitForScreenUpdate = true,
                                   startImgIndex = 0, timeout = 5000): Promise<boolean> {
    return this.navigateAndCompareUntilText(path, testcaseName, 'APPROVE', waitForScreenUpdate, startImgIndex, timeout)
  }

  async navigateUntilText(path: string, testcaseName: string, text: string, waitForScreenUpdate = true, takeSnapshots = true,
                          startImgIndex = 0, timeout = 5000): Promise<number> {
      const snapshotPrefixGolden = Resolve(`${path}/snapshots/${testcaseName}`)
      const snapshotPrefixTmp = Resolve(`${path}/snapshots-tmp/${testcaseName}`)

      fs.ensureDirSync(snapshotPrefixGolden)
      fs.ensureDirSync(snapshotPrefixTmp)

      let imageIndex = startImgIndex
      const filename = takeSnapshots ? `${snapshotPrefixTmp}/${this.formatIndexString(imageIndex)}.png` : undefined
      await this.snapshot(filename)

      let start = new Date()
      const prev_events_qty = (await this.getEvents()).length
      let current_events_qty = prev_events_qty

      let found = false

      while (!found) {
        const currentTime = new Date()
        const elapsed: any = currentTime.getTime() - start.getTime()

        if (elapsed > timeout) {
          throw `Timeout waiting for screen containing ${text}`
        }

        const events = await this.getEvents()

        if (current_events_qty != events.length) {
          imageIndex += 1
          const filename = takeSnapshots ? `${snapshotPrefixTmp}/${this.formatIndexString(imageIndex)}.png` : undefined
          current_events_qty = events.length

          events.forEach((element: any) => {
            if (element['text'].includes(text)) {
              found = true
            }
          })

          if (found) {
            await this.clickBoth(filename, waitForScreenUpdate)
          } else {
            // navigate to next screen
            await this.clickRight(filename, waitForScreenUpdate)
            start = new Date()
          }
        } else {
          // this case we need to pull again in order to move to next screen
          this.log('No new event, clicking right')
          imageIndex += 1
          const filename = takeSnapshots ? `${snapshotPrefixTmp}/${this.formatIndexString(imageIndex)}.png` : undefined
          await this.clickRight(filename, waitForScreenUpdate)
          start = new Date()
        }
      }
      return imageIndex
  }

  async navigateAndCompareUntilText(path: string, testcaseName: string, text: string, waitForScreenUpdate = true,
                                    startImgIndex = 0, timeout = 5000): Promise<boolean> {
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

  async waitScreenChange(timeout = 5000) {
    const start = new Date()
    const prev_events_qty = (await this.getEvents()).length
    let current_events_qty = prev_events_qty
    this.log(`Wait for screen change`)

    while (prev_events_qty === current_events_qty) {
      const currentTime = new Date()
      const elapsed: any = currentTime.getTime() - start.getTime()
      if (elapsed > timeout) {
        throw `Timeout waiting for screen to change (${timeout} ms)`
      }
      await Zemu.delay(500)
      this.log(`Check [${elapsed}ms]`)
      current_events_qty = (await this.getEvents()).length
    }
    this.log(`Screen changed`)
  }

  async waitForText(text: any, timeout = 5000, caseSensitive = false) {
    const start = new Date()
    let found = false
    const flags = !caseSensitive? 'i' : ''
    const startRegex = new RegExp(text, flags);

    while (!found) {
      const currentTime = new Date()
      const elapsed: any = currentTime.getTime() - start.getTime()
      if (elapsed > timeout) {
        throw `Timeout (${timeout}) waiting for text (${text})`
      }

      const events = await this.getEvents()
      events.forEach((element: any) => {
        const v = element['text']
        found = startRegex.test(v)
      })
      await Zemu.delay(100)
    }
  }

  async click(endpoint: string, filename?: string, waitForScreenUpdate?: boolean) {
    let previousScreen
    if (waitForScreenUpdate) {
      previousScreen = await this.snapshot()
    }
    const bothClickUrl = 'http://localhost:' + this.speculosApiPort?.toString() + endpoint
    const payload = { action: 'press-and-release' }
    await axios.post(bothClickUrl, payload)
    this.log(`Click ${endpoint} -> ${filename}`)

    // Wait and poll Speculos until the application screen gets updated
    if (waitForScreenUpdate) {
      let watchdog = 5000
      let currentScreen = await this.snapshot()
      while (currentScreen.data.equals(previousScreen.data)) {
        this.log('sleep')
        await Zemu.delay(100)
        watchdog -= 100
        if (watchdog <= 0) throw 'Timeout waiting for screen update'
        currentScreen = await this.snapshot()
      }
    } else {
      // A minimum delay is required
      await Zemu.delay(100)
    }
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
