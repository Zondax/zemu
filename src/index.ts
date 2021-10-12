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
import { RfbClient } from 'rfb2'
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
  logging: false,
  X11: false,
  custom: '',
  startDelay: DEFAULT_START_DELAY,
  pressDelay: DEFAULT_KEY_DELAY,
}

export class StartOptions {
  model = 'nanos'
  logging = false
  X11 = false
  custom = ''
  startDelay = DEFAULT_START_DELAY
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
  private vncSession: RfbClient | null
  private libElfs: { [p: string]: string }
  private emuContainer: EmuContainer
  private transport: Transport | undefined

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
    this.vncSession = null

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

    const containerName = BASE_NAME + rndstr.generate(5)
    this.emuContainer = new EmuContainer(this.elfPath, this.libElfs, DEFAULT_EMU_IMG, containerName)
  }

  getSession(): any {
    return this.vncSession
  }

  static saveRGBA2Png(rect: { width: number; height: number; data: Buffer }, filename: string) {
    const png = new PNG.PNG({
      width: rect.width,
      height: rect.height,
    })
    png.data = rect.data.slice()
    const buffer = PNG.PNG.sync.write(png, { colorType: 6 })
    fs.writeFileSync(filename, buffer)
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

    const elfApp = fs.readFileSync(elfPath)
    const elfInfo = elfy.parse(elfApp)

    if (elfInfo.entry !== elfCodeNanoS && elfInfo.entry !== elfCodeNanoX) {
      throw new Error('Are you sure is a Nano S/X app ?')
    }
    // FIXME: SDK2.0 entry points have changed
  }

  async start(options: StartOptions) {
    this.startOptions = options

    this.log(`Checking ELF`)
    Zemu.checkElf(this.startOptions.model ?? DEFAULT_MODEL, this.elfPath)

    try {
      // await Zemu.stopAllEmuContainers()

      if (!this.transportPort || !this.speculosApiPort) await this.getPortsToListen()

      if (!this.transportPort || !this.speculosApiPort) {
        const e = new Error("The Speculos API port or/and transport port couldn't be reserved")
        this.log(`[ZEMU] ${e}`)
        throw e
      }

      this.log(`Starting Container`)
      await this.emuContainer.runContainer({
        ...this.startOptions,
        transportPort: this.transportPort.toString(),
        speculosApiPort: this.speculosApiPort.toString(),
      })

      this.log(`Started Container`)

      // eslint-disable-next-line func-names
      await this.connect().catch(error => {
        this.log(`${error}`)
        this.close()
        throw error
      })

      this.log(`Get initial snapshot`)

      // Captures main screen
      this.mainMenuSnapshot = await this.snapshot()
    } catch (e) {
      this.log(`[ZEMU] ${e}`)
      throw e
    }
  }

  async connect() {
    // FIXME: Can we detect open ports?
    const waitDelay = this.startOptions?.startDelay ?? DEFAULT_START_DELAY

    this.log(`Wait for ${waitDelay} ms`)
    Zemu.delay(waitDelay)

    const transport_url = `${this.transportProtocol}://${this.host}:${this.transportPort}`

    // Here it should be "StaticTransport" type, in order to be able to use the static method "open". That method belogs to StaticTransport
    // https://github.com/LedgerHQ/ledgerjs/blob/0ec9a60fe57d75dff26a69c213fd824aa321231c/packages/hw-transport-http/src/withStaticURLs.ts#L89
    this.transport = await (TransportHttp(transport_url) as any).open(transport_url)
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
        return WINDOW_X
    }
    throw `model ${this.startOptions?.model ?? DEFAULT_MODEL} not recognized`
  }

  async fetchSnapshot(url: string) {
    // Exponential back-off retry delay between requests
    axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay});

    return await axios({
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

  async navigateAndCompareSnapshots(path: string, testcaseName: string, clickSchedule: number[]) {
    const snapshotPrefixGolden = Resolve(`${path}/snapshots/${testcaseName}`)
    const snapshotPrefixTmp = Resolve(`${path}/snapshots-tmp/${testcaseName}`)

    fs.ensureDirSync(snapshotPrefixGolden)
    fs.ensureDirSync(snapshotPrefixTmp)

    this.log(`golden      ${snapshotPrefixGolden}`)
    this.log(`tmp         ${snapshotPrefixTmp}`)

    let imageIndex = 0
    let filename = `${snapshotPrefixTmp}/${this.formatIndexString(imageIndex)}.png`
    this.log(`---------------------------`)
    this.log(`Start        ${filename}`)
    await this.snapshot(filename)
    this.log(`Instructions ${clickSchedule}`)

    for (let i = 0; i < clickSchedule.length; i++) {
      const value = clickSchedule[i]
      if (value == 0) {
        imageIndex += 1
        filename = `${snapshotPrefixTmp}/${this.formatIndexString(imageIndex)}.png`
        await this.clickBoth(`${filename}`)
        continue
      }

      if (value < 0) {
        // Move backwards
        for (let j = 0; j < -value; j += 1) {
          imageIndex += 1
          filename = `${snapshotPrefixTmp}/${this.formatIndexString(imageIndex)}.png`
          await this.clickLeft(filename)
        }
        continue
      }

      // Move forward
      for (let j = 0; j < value; j += 1) {
        imageIndex += 1
        filename = `${snapshotPrefixTmp}/${this.formatIndexString(imageIndex)}.png`
        await this.clickRight(filename)
      }
    }

    ////////////////////
    this.log(`Start comparison`)
    for (let j = 0; j < imageIndex + 1; j += 1) {
      this.log(`Checked     ${snapshotPrefixTmp}/${this.formatIndexString(j)}.png`)
      const img1 = Zemu.LoadPng2RGB(`${snapshotPrefixTmp}/${this.formatIndexString(j)}.png`)
      const img2 = Zemu.LoadPng2RGB(`${snapshotPrefixGolden}/${this.formatIndexString(j)}.png`)

      if (!img1.data.equals(img2.data)) {
        throw new Error(`Image [${this.formatIndexString(j)}] do not match!`)
      }
    }

    return true
  }

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

  async getEvents() {
    const events = 'http://localhost:' + this.speculosApiPort!.toString() + '/events'
    const response = await axios({
      method: 'GET',
      url: events,
    });
    return response.data['events']
  }

  async deleteEvents() {
    const events = 'http://localhost:' + this.speculosApiPort!.toString() + '/events'
    const response = await axios({
      method: 'DELETE',
      url: events,
    });
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

  async waitForText(text: string, timeout = 5000) {
    const start = new Date()
    let found = false

    while(!found) {
      const currentTime = new Date()
      const elapsed: any = currentTime.getTime() - start.getTime()
      if (elapsed > timeout) {
        throw `Timeout waiting for text (${text})`
      }

      const events = await this.getEvents()
      events.forEach((element: any) => {
        if(element['text'].includes(text)) {
          found = true
        }
      })
      await Zemu.delay(500)
    }
  }

  async clickLeft(filename?: string) {
    const leftClickUrl = 'http://localhost:' + this.speculosApiPort?.toString() + '/button/left'
    const payload = { action: 'press-and-release' }
    await axios.post(leftClickUrl, payload)
    this.log(`Click Left  ${filename}`)
    return this.snapshot(filename)
  }

  async clickRight(filename?: string) {
    const rightClickUrl = 'http://localhost:' + this.speculosApiPort?.toString() + '/button/right'
    const payload = { action: 'press-and-release' }
    await axios.post(rightClickUrl, payload)
    this.log(`Click Right ${filename}`)
    return this.snapshot(filename)
  }

  async clickBoth(filename?: string) {
    const bothClickUrl = 'http://localhost:' + this.speculosApiPort?.toString() + '/button/both'
    const payload = { action: 'press-and-release' }
    await axios.post(bothClickUrl, payload)
    this.log(`Click Both  ${filename}`)
    return this.snapshot(filename)
  }

  private async getPortsToListen(): Promise<void> {
    const transportPort = await getPort({ port: this.desiredTransportPort })
    const speculosApiPort = await getPort({ port: this.desiredSpeculosApiPort })

    this.transportPort = transportPort
    this.speculosApiPort = speculosApiPort
  }
}
