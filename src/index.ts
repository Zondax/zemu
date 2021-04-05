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

// @ts-ignore
import TransportHttp from '@ledgerhq/hw-transport-http'
// @ts-ignore
import elfy from 'elfy'
// @ts-ignore
import EmuContainer from './emuContainer'
// @ts-ignore
import GRPCRouter from './grpc'
import {
  BASE_NAME,
  DEFAULT_EMU_IMG,
  DEFAULT_HOST,
  DEFAULT_KEY_DELAY,
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
  pressDelay = 300
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
  private transport_url: string
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
    this.transport_url = `http://${this.host}:${transportPort}`
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

    if (model === 'nanos' && elfInfo.entry !== elfCodeNanoS) {
      throw new Error("Zemu model is set to 'nanos' but elf file doesn't seem to be nano s build. Did you pass the right elf ?")
    }

    if (model === 'nanox' && elfInfo.entry !== elfCodeNanoX) {
      throw new Error("Zemu model is set to 'nanox' but elf file doesn't seem to be nano x build. Did you pass the right elf ?")
    }
  }

  async start(options: StartOptions) {
    await Zemu.checkAndPullImage()

    this.startOptions = options

    this.log(`[ZEMU] Checking ELF`)
    Zemu.checkElf(this.startOptions.model ?? DEFAULT_MODEL, this.elfPath)

    this.log(`[ZEMU] Starting Container`)
    await this.emuContainer.runContainer(options)

    this.log(`[ZEMU] Started Container`)

    // eslint-disable-next-line func-names
    await this.connect().catch(error => {
      this.log(`[ZEMU] ${error}`)
      this.close()
    })

    this.log(`[ZEMU] Get initial snapshot`)

    // Captures main screen
    this.mainMenuSnapshot = await this.snapshot()
  }

  async connect() {
    // FIXME: Can we detect open ports?
    const waitDelay = this.startOptions?.startDelay ?? DEFAULT_START_DELAY

    this.log(`[ZEMU] Wait VNC for ${waitDelay}`)
    Zemu.delay(waitDelay)

    await this.connectVNC()

    this.transport = await TransportHttp(this.transport_url).open(this.transport_url)
  }

  log(message: string) {
    if (this.startOptions?.logging ?? false) {
      process.stdout.write(`${message}\n`)
    }
  }

  async connectVNC() {
    return new Promise((resolve, reject) => {
      this.vncSession = rfb.createConnection({
        host: this.host,
        port: this.vncPort,
      })

      this.log(`[ZEMU] VNC Connection created ${this.host}:${this.vncPort}`)

      const tmpVncSession = this.vncSession
      this.vncSession.on('connect', () => {
        this.log(`[ZEMU] VNC Session ready`)

        // @ts-ignore
        tmpVncSession.keyEvent(KEYS.LEFT, KEYS.NOT_PRESSED)
        // @ts-ignore
        tmpVncSession.keyEvent(KEYS.RIGHT, KEYS.NOT_PRESSED)
        resolve(true)
      })

      const tmpVncPort = this.vncPort
      const tmpHost = this.host
      this.vncSession.on('error', error => {
        this.log(`[ZEMU] Could not connect to port ${tmpVncPort}  on ${tmpHost}`)
        reject(error)
      })

      setTimeout(() => reject(new Error('timeout on connectVNC')), 10000)
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
    this.log('[ZEMU] Close')
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

    this.log('[ZEMU] Requested snapshot')
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

    while (inputSnapshotBufferHex === currentSnapshotBufferHex) {
      // @ts-ignore
      const elapsed: any = new Date() - start
      if (elapsed > timeout) {
        throw `Timeout waiting for screen to change (${timeout} ms)`
      }
      await Zemu.delay(100)
      currentSnapshotBufferHex = (await this.snapshot()).buffer.toString('hex')
    }
  }

  async compareSnapshotsAndAccept(path: string, testcaseName: string, snapshotCount: number, backClickCount = 0) {
    const snapshotPrefixGolden = Resolve(`${path}/snapshots/${testcaseName}`)
    const snapshotPrefixTmp = Resolve(`${path}/snapshots-tmp/${testcaseName}`)

    fs.ensureDirSync(snapshotPrefixGolden)
    fs.ensureDirSync(snapshotPrefixTmp)

    const localBackClickCount = typeof backClickCount === 'undefined' ? 0 : backClickCount

    this.log(`[ZEMU] forward: ${snapshotCount} backwards: ${localBackClickCount}`)
    this.log(`[ZEMU] golden      ${snapshotPrefixGolden}`)
    this.log(`[ZEMU] tmp         ${snapshotPrefixTmp}`)

    let imageIndex = 0
    let indexStr = '00000'
    let filename = `${snapshotPrefixTmp}/${indexStr}.png`
    this.log(`[ZEMU] Start       ${filename}`)
    await this.snapshot(filename)

    // Move forward to the end
    for (let j = 0; j < snapshotCount; j += 1) {
      imageIndex += 1
      indexStr = `${imageIndex}`.padStart(5, '0')
      filename = `${snapshotPrefixTmp}/${indexStr}.png`
      await this.clickRight(filename)
      this.log(`[ZEMU] Click Right ${filename}`)
    }

    // now go back a few clicks and come back
    for (let j = 0; j < localBackClickCount; j += 1) {
      imageIndex += 1
      indexStr = `${imageIndex}`.padStart(5, '0')
      filename = `${snapshotPrefixTmp}/${indexStr}.png`
      this.log(`[ZEMU] Click Left  ${filename}`)
      await this.clickLeft(`${filename}`)
    }

    for (let j = 0; j < localBackClickCount; j += 1) {
      imageIndex += 1
      indexStr = `${imageIndex}`.padStart(5, '0')
      filename = `${snapshotPrefixTmp}/${indexStr}.png`
      this.log(`[ZEMU] Click Right ${filename}`)
      await this.clickRight(`${filename}`)
    }

    imageIndex += 1
    indexStr = `${imageIndex}`.padStart(5, '0')
    filename = `${snapshotPrefixTmp}/${indexStr}.png`
    this.log(`[ZEMU] Click Both  ${filename}`)
    await this.clickBoth(`${filename}`)

    this.log(`[ZEMU] Start comparison`)
    for (let j = 0; j < imageIndex + 1; j += 1) {
      indexStr = `${j}`.padStart(5, '0')
      this.log(`[ZEMU] Checked     ${snapshotPrefixTmp}/${indexStr}.png`)
      const img1 = Zemu.LoadPng2RGB(`${snapshotPrefixTmp}/${indexStr}.png`)
      const img2 = Zemu.LoadPng2RGB(`${snapshotPrefixGolden}/${indexStr}.png`)

      if (!img1.data.equals(img2.data)) {
        return false
      }
    }

    return true
  }

  async clickLeft(filename?: string) {
    this.getSession().keyEvent(KEYS.LEFT, KEYS.PRESSED)
    Zemu.delay(this.startOptions?.pressDelay ?? DEFAULT_KEY_DELAY)
    this.getSession().keyEvent(KEYS.LEFT, KEYS.NOT_PRESSED)
    Zemu.delay(this.startOptions?.pressDelay ?? DEFAULT_KEY_DELAY)
    return this.snapshot(filename)
  }

  async clickRight(filename?: string) {
    this.getSession().keyEvent(KEYS.RIGHT, KEYS.PRESSED)
    Zemu.delay(this.startOptions?.pressDelay ?? DEFAULT_KEY_DELAY)
    this.getSession().keyEvent(KEYS.RIGHT, KEYS.NOT_PRESSED)
    Zemu.delay(this.startOptions?.pressDelay ?? DEFAULT_KEY_DELAY)
    return this.snapshot(filename)
  }

  async clickBoth(filename?: string) {
    this.getSession().keyEvent(KEYS.LEFT, KEYS.PRESSED)
    this.getSession().keyEvent(KEYS.RIGHT, KEYS.PRESSED)
    Zemu.delay(this.startOptions?.pressDelay ?? DEFAULT_KEY_DELAY)
    this.getSession().keyEvent(KEYS.LEFT, KEYS.NOT_PRESSED)
    this.getSession().keyEvent(KEYS.RIGHT, KEYS.NOT_PRESSED)
    Zemu.delay(this.startOptions?.pressDelay ?? DEFAULT_KEY_DELAY)
    return this.snapshot(filename)
  }
}
