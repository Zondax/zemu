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
import rfb, { RfbClient } from 'rfb2'
import sleep from 'sleep'
import getPort from 'get-port';

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
  DEFAULT_KEY_DELAY_AFTER,
  DEFAULT_MODEL,
  DEFAULT_START_DELAY,
  DEFAULT_TRANSPORT_PORT,
  DEFAULT_VNC_PORT,
  KEYS,
  KILL_TIMEOUT,
  TIMEOUT,
  WINDOW_S,
  WINDOW_X,
} from './constants'
import EmuContainer from './emulator'

const Resolve = require('path').resolve
const rndstr = require('randomstring')

export const DEFAULT_START_OPTIONS = {
  model: DEFAULT_MODEL,
  logging: false,
  X11: false,
  custom: '',
  startDelay: DEFAULT_START_DELAY,
  pressDelay: DEFAULT_KEY_DELAY,
  pressDelayAfter: DEFAULT_KEY_DELAY_AFTER,
}

export class StartOptions {
  model = 'nanos'
  logging = false
  X11 = false
  custom = ''
  startDelay = DEFAULT_START_DELAY
  pressDelay = DEFAULT_KEY_DELAY
  pressDelayAfter = DEFAULT_KEY_DELAY_AFTER
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
  private vncPort: number
  private transportPort: number
  private transportProtocol = "http"
  private elfPath: string
  private grpcManager: GRPCRouter | null | undefined
  private mainMenuSnapshot: null
  private vncSession: RfbClient | null
  private libElfs: { [p: string]: string }
  private emuContainer: EmuContainer
  private transport: any

  constructor(
    elfPath: string,
    libElfs: { [key: string]: string } = {},
    host: string = DEFAULT_HOST,
    vncPort: number = DEFAULT_VNC_PORT,
    transportPort = DEFAULT_TRANSPORT_PORT,
  ) {
    this.host = host
    this.vncPort = vncPort
    this.transportPort = transportPort
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

    this.setConfigPorts(vncPort, transportPort)

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

      this.log(`Starting Container`)
      await this.emuContainer.runContainer({...this.startOptions, vncPort: this.vncPort, transportPort: this.transportPort})

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

    this.log(`Wait VNC for ${waitDelay}`)
    Zemu.delay(waitDelay)

    await this.connectVNC()

    const transport_url = `${this.transportProtocol}://${this.host}:${this.transportPort}`
    this.transport = await TransportHttp(transport_url).open(transport_url)
  }

  log(message: string) {
    if (this.startOptions?.logging ?? false) {
      const currentTimestamp = new Date().toISOString().slice(11, 23)
      process.stdout.write(`[ZEMU] ${currentTimestamp}: ${message}\n`)
    }
  }

  async connectVNC() {
    return new Promise((resolve, reject) => {
      this.vncSession = rfb.createConnection({
        host: this.host,
        port: this.vncPort,
      })

      this.log(`VNC Connection created ${this.host}:${this.vncPort}`)

      const tmpVncSession = this.vncSession
      this.vncSession.on('connect', () => {
        this.log(`VNC Session ready`)

        // @ts-ignore
        tmpVncSession.keyEvent(KEYS.LEFT, KEYS.NOT_PRESSED)
        // @ts-ignore
        tmpVncSession.keyEvent(KEYS.RIGHT, KEYS.NOT_PRESSED)
        resolve(true)
      })

      const tmpVncPort = this.vncPort
      const tmpHost = this.host
      this.vncSession.on('error', error => {
        this.log(`Could not connect to port ${tmpVncPort}  on ${tmpHost}`)
        reject(error)
      })

      setTimeout(() => reject(new Error('timeout on connectVNC')), 6000)
    })
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
    if (this.vncSession) {
      this.vncSession.end()
    }

    this.stopGRPCServer()
  }

  getTransport() {
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

  async snapshot(filename?: string): Promise<any> {
    const { vncSession } = this

    return new Promise((resolve, reject) => {
      const session = this.getSession()

      if (!session) {
        throw new Error('Session is null')
      }

      session.once('rect', (rect: any) => {
        if (filename) {
          Zemu.saveRGBA2Png(rect, filename)
        }
        resolve(rect)
      })

      const modelWindow = this.getWindowRect()

      // @ts-ignore
      vncSession.requestUpdate(false, 0, 0, modelWindow.width, modelWindow.height)

      setTimeout(() => reject(new Error('timeout')), TIMEOUT)
    })
  }

  async getMainMenuSnapshot() {
    return this.mainMenuSnapshot
  }

  async waitUntilScreenIsNot(screen: any, timeout = 10000) {
    const start = new Date()
    const inputSnapshotBufferHex = (await screen).buffer.toString('hex')
    let currentSnapshotBufferHex = (await this.snapshot()).buffer.toString('hex')

    this.log(`Wait for screen change`)

    while (inputSnapshotBufferHex === currentSnapshotBufferHex) {
      const currentTime = new Date()
      const elapsed: any = currentTime.getTime() - start.getTime()
      if (elapsed > timeout) {
        throw `Timeout waiting for screen to change (${timeout} ms)`
      }
      await Zemu.delay(500)
      this.log(`Check [${elapsed}ms]`)
      currentSnapshotBufferHex = (await this.snapshot()).buffer.toString('hex')
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

  async clickLeft(filename?: string) {
    this.getSession().keyEvent(KEYS.LEFT, KEYS.PRESSED)
    Zemu.delay(this.startOptions?.pressDelay ?? DEFAULT_KEY_DELAY)
    this.getSession().keyEvent(KEYS.LEFT, KEYS.NOT_PRESSED)
    Zemu.delay(this.startOptions?.pressDelayAfter ?? DEFAULT_KEY_DELAY_AFTER)
    this.log(`Click Left  ${filename}`)
    return this.snapshot(filename)
  }

  async clickRight(filename?: string) {
    this.getSession().keyEvent(KEYS.RIGHT, KEYS.PRESSED)
    Zemu.delay(this.startOptions?.pressDelay ?? DEFAULT_KEY_DELAY)
    this.getSession().keyEvent(KEYS.RIGHT, KEYS.NOT_PRESSED)
    Zemu.delay(this.startOptions?.pressDelayAfter ?? DEFAULT_KEY_DELAY_AFTER)
    this.log(`Click Right ${filename}`)
    return this.snapshot(filename)
  }

  async clickBoth(filename?: string) {
    this.getSession().keyEvent(KEYS.LEFT, KEYS.PRESSED)
    this.getSession().keyEvent(KEYS.RIGHT, KEYS.PRESSED)
    Zemu.delay(this.startOptions?.pressDelay ?? DEFAULT_KEY_DELAY)
    this.getSession().keyEvent(KEYS.LEFT, KEYS.NOT_PRESSED)
    this.getSession().keyEvent(KEYS.RIGHT, KEYS.NOT_PRESSED)
    Zemu.delay(this.startOptions?.pressDelayAfter ?? DEFAULT_KEY_DELAY_AFTER)
    this.log(`Click Both  ${filename}`)
    return this.snapshot(filename)
  }

  private async setConfigPorts( desiredVncPort: number, desiredTransportPort: number) : Promise<void> {
    const vncPort = await getPort({port: desiredVncPort})
    const transportPort = await getPort({port: desiredTransportPort})

    this.vncPort = vncPort
    this.transportPort = transportPort
  }


}
