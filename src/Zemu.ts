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

import { resolve } from 'node:path'
import type Transport from '@ledgerhq/hw-transport'
import HttpTransport from '@ledgerhq/hw-transport-http'
import axios, { type AxiosResponse } from 'axios'
import axiosRetry from 'axios-retry'
// @ts-expect-error typings are missing
import elfy from 'elfy'
import fs from 'fs-extra'
import getPort from 'get-port'
import { PNG, type PNGWithMetadata } from 'pngjs'
import rndstr from 'randomstring'
import { ClickNavigation, scheduleToNavElement, TouchNavigation } from './actions'
import { getTouchElement } from './buttons'
import {
  BASE_NAME,
  DEFAULT_EMU_IMG,
  DEFAULT_HOST,
  DEFAULT_KEY_DELAY,
  DEFAULT_METHOD_TIMEOUT,
  DEFAULT_NANO_APPROVE_KEYWORD,
  DEFAULT_NANO_REJECT_KEYWORD,
  DEFAULT_NANO_START_TEXT,
  DEFAULT_PENDING_REVIEW_TEXT,
  DEFAULT_STAX_APPROVE_KEYWORD,
  DEFAULT_STAX_REJECT_KEYWORD,
  DEFAULT_STAX_START_TEXT,
  DEFAULT_WAIT_TIMEOUT,
  KILL_TIMEOUT,
  WINDOW_FLEX,
  WINDOW_S,
  WINDOW_STAX,
  WINDOW_X,
} from './constants'
import { ContainerPool, type IPoolConfig, type IPooledContainer } from './containerPool'
import EmuContainer from './emulator'
import { getAPDUStatusMessage, isCriticalTransportError, TransportError } from './errors'
import GRPCRouter from './grpc'
import {
  ActionKind,
  ButtonKind,
  type IButton,
  type IDeviceWindow,
  type IEvent,
  type INavElement,
  type ISnapshot,
  type IStartOptions,
  type ISwipeCoordinates,
  SwipeDirection,
  type TModel,
} from './types'
import { isTouchDevice, zondaxToggleBlindSigning, zondaxToggleExpertMode, zondaxTouchEnableSpecialMode } from './zondax'

export default class Zemu {
  public startOptions!: IStartOptions

  private readonly host: string
  public transport!: Transport
  private readonly transportProtocol: string = 'http'
  public transportPort!: number
  public speculosApiPort!: number
  private readonly desiredTransportPort?: number
  private readonly desiredSpeculosApiPort?: number

  private emuContainer: EmuContainer
  public containerName: string
  private lastTransportError: Error | null = null

  public readonly elfPath: string
  public readonly libElfs: Record<string, string>
  private grpcManager?: GRPCRouter

  public mainMenuSnapshot!: ISnapshot
  public initialEvents!: IEvent[]

  // Container pool management
  private static containerPool: ContainerPool | null = null
  private static poolEnabled: boolean = process.env.ZEMU_DISABLE_POOL !== 'true'
  private static poolInitialized = false
  private static poolInitPromise: Promise<void> | null = null
  private pooledContainer: IPooledContainer | null = null
  private usingPool = false

  constructor(
    elfPath: string,
    libElfs: Record<string, string> = {},
    host: string = DEFAULT_HOST,
    desiredTransportPort?: number,
    desiredSpeculosApiPort?: number,
    emuImage: string = DEFAULT_EMU_IMG
  ) {
    this.host = host
    this.desiredTransportPort = desiredTransportPort
    this.desiredSpeculosApiPort = desiredSpeculosApiPort
    this.elfPath = elfPath
    this.libElfs = libElfs

    if (this.elfPath == null) {
      throw new Error('elfPath cannot be null!')
    }

    if (!fs.existsSync(this.elfPath)) {
      throw new Error('elf file was not found! Did you compile?')
    }

    for (const libName of Object.keys(libElfs)) {
      if (!fs.existsSync(libElfs[libName])) {
        throw new Error('lib elf file was not found! Did you compile?')
      }
    }

    this.containerName = BASE_NAME + rndstr.generate(8)
    this.emuContainer = new EmuContainer(this.elfPath, this.libElfs, emuImage, this.containerName)
    this.pooledContainer = null
    this.usingPool = false
  }

  // Static pool management methods
  static disablePool(): void {
    Zemu.poolEnabled = false
  }

  static enablePool(): void {
    Zemu.poolEnabled = true
  }

  static isPoolEnabled(): boolean {
    return Zemu.poolEnabled
  }

  static async initializePool(config?: IPoolConfig): Promise<void> {
    if (!Zemu.poolEnabled) {
      return
    }

    try {
      Zemu.containerPool = ContainerPool.getInstance()

      const defaultConfig: IPoolConfig = {
        nanos: 2,
        nanox: 1,
        nanosp: 1,
        stax: 1,
        flex: 1,
      }

      await Zemu.containerPool.initialize(config || defaultConfig)
      Zemu.poolInitialized = true
    } catch (error) {
      console.warn('Container pool initialization failed, falling back to individual containers:', error)
      Zemu.poolEnabled = false
      Zemu.containerPool = null
    }
  }

  static async cleanupPool(): Promise<void> {
    if (Zemu.containerPool) {
      await Zemu.containerPool.cleanup()
      Zemu.containerPool = null
      Zemu.poolInitialized = false
    }
  }

  static getPoolStatus(): Record<string, { total: number; available: number; busy: number }> | null {
    return Zemu.containerPool?.getPoolStatus() || null
  }

  static LoadPng2RGB(filename: string): PNGWithMetadata {
    const tmpBuffer = fs.readFileSync(filename)
    return PNG.sync.read(tmpBuffer)
  }

  static async sleep(timeInMs: number = DEFAULT_KEY_DELAY): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, timeInMs))
  }

  static stopAllEmuContainers(): void {
    const timer = setTimeout(() => {
      console.log('Could not kill all containers before timeout!')
      process.exit(1)
    }, KILL_TIMEOUT)

    // Clean up pool first
    if (Zemu.containerPool) {
      Zemu.containerPool.cleanup().catch((error) => console.warn('Failed to cleanup container pool:', error))
    }

    // Then kill any remaining containers
    EmuContainer.killContainerByName(BASE_NAME)
    clearTimeout(timer)
  }

  static async checkAndPullImage(): Promise<void> {
    await EmuContainer.checkAndPullImage(DEFAULT_EMU_IMG)
  }

  static checkElf(model: TModel, elfPath: string): void {
    const elfsModel: Record<TModel, number> = {
      nanos: 0xc0d00001,
      nanox: 0xc0de0001,
      nanosp: 0xc0de0001,
      stax: 0xc0de0001,
      flex: 0xc0de0001,
    }
    const elfApp = fs.readFileSync(elfPath)
    const elfInfo = elfy.parse(elfApp)

    if (elfInfo.entry !== elfsModel[model]) {
      throw new Error(`Are you sure is a ${model} app elf?`)
    }
  }

  async start(options: IStartOptions): Promise<void> {
    this.startOptions = options
    const approveWord = options.approveKeyword
    const rejectWord = options.rejectKeyword
    if (isTouchDevice(options.model)) {
      this.startOptions.approveKeyword = approveWord.length === 0 ? DEFAULT_STAX_APPROVE_KEYWORD : approveWord
      this.startOptions.rejectKeyword = rejectWord.length === 0 ? DEFAULT_STAX_REJECT_KEYWORD : rejectWord
    } else {
      this.startOptions.approveKeyword = approveWord.length === 0 ? DEFAULT_NANO_APPROVE_KEYWORD : approveWord
      this.startOptions.rejectKeyword = rejectWord.length === 0 ? DEFAULT_NANO_REJECT_KEYWORD : rejectWord
    }

    this.log('Checking ELF')
    Zemu.checkElf(this.startOptions.model, this.elfPath)

    try {
      // Try to use pool if enabled and not explicitly disabled
      if (Zemu.poolEnabled && !options.disablePool) {
        await this.tryStartWithPool()
        if (this.usingPool) {
          return
        }
      }

      // Fallback to traditional container creation
      await this.startWithNewContainer()
    } catch (e) {
      this.log(`[ZEMU] ${e}`)
      throw e
    }
  }

  private async tryStartWithPool(): Promise<void> {
    try {
      // Initialize pool if not already done
      if (!Zemu.poolInitialized && Zemu.containerPool === null) {
        if (!Zemu.poolInitPromise) {
          Zemu.poolInitPromise = Zemu.initializePool()
        }
        await Zemu.poolInitPromise
      }

      if (!Zemu.containerPool || !Zemu.poolInitialized) {
        return // Pool not available, will fallback
      }

      // Try to acquire container from pool
      this.pooledContainer = await Zemu.containerPool.acquire(this.startOptions.model, this.elfPath, this.libElfs)

      if (this.pooledContainer) {
        this.log('Using pooled container')
        this.usingPool = true
        this.emuContainer = this.pooledContainer.container
        this.transportPort = this.pooledContainer.transportPort
        this.speculosApiPort = this.pooledContainer.speculosApiPort
        this.containerName = this.pooledContainer.containerName

        // Connect to the pooled container
        await this.connect()
        await this.finalizeStart()
      }
    } catch (error) {
      this.log(`Pool container failed, falling back to new container: ${error}`)
      this.usingPool = false
      this.pooledContainer = null
    }
  }

  private async startWithNewContainer(): Promise<void> {
    this.log('Creating new container')

    await this.assignPortsToListen()

    if (this.transportPort === undefined || this.speculosApiPort === undefined) {
      const e = new Error("The Speculos API port or/and transport port couldn't be reserved")
      this.log(`[ZEMU] ${e}`)
      throw e
    }

    this.log('Starting Container')
    await this.emuContainer.runContainer({
      ...this.startOptions,
      transportPort: this.transportPort.toString(),
      speculosApiPort: this.speculosApiPort.toString(),
    })

    this.log('Connecting to container')
    await this.connect().catch(async (error) => {
      this.log(`${error}`)
      await this.close()
      throw error
    })

    await this.finalizeStart()
  }

  private async finalizeStart(): Promise<void> {
    // Captures main screen
    this.log('Wait for start text')

    if (this.startOptions.startText.length === 0) {
      this.startOptions.startText = isTouchDevice(this.startOptions.model) ? DEFAULT_STAX_START_TEXT : DEFAULT_NANO_START_TEXT
    }
    const start = new Date()
    let found = false
    let reviewPendingFound = false
    const flags = !this.startOptions.caseSensitive ? 'i' : ''
    const startRegex = new RegExp(this.startOptions.startText, flags)
    const reviewPendingRegex = new RegExp(DEFAULT_PENDING_REVIEW_TEXT, flags)

    while (!found) {
      const currentTime = new Date()
      const elapsed = currentTime.getTime() - start.getTime()
      if (elapsed > this.startOptions.startTimeout) {
        throw new Error(`Timeout (${this.startOptions.startTimeout}) waiting for text (${this.startOptions.startText})`)
      }
      const events = await this.getEvents()
      if (!reviewPendingFound && events.some((event: IEvent) => reviewPendingRegex.test(event.text))) {
        const nav = isTouchDevice(this.startOptions.model)
          ? new TouchNavigation(this.startOptions.model, [ButtonKind.ConfirmYesButton])
          : new ClickNavigation([0])
        await this.navigate('', '', nav.schedule, true, false)
        reviewPendingFound = true
      }
      found = events.some((event: IEvent) => startRegex.test(event.text))
      await Zemu.sleep()
    }

    this.log('Get initial snapshot and events')
    this.mainMenuSnapshot = await this.snapshot()
    this.initialEvents = await this.getEvents()
  }

  async connect(): Promise<void> {
    const transportUrl = `${this.transportProtocol}://${this.host}:${this.transportPort}`
    const start = new Date()
    let connected = false
    const maxWait = this.startOptions.startDelay

    while (!connected) {
      const currentTime = new Date()
      const elapsed = currentTime.getTime() - start.getTime()
      if (elapsed > maxWait) {
        throw new Error('Timeout waiting to connect')
      }

      try {
        this.transport = await HttpTransport(transportUrl).open(transportUrl)
        connected = true
      } catch (e) {
        this.log(`WAIT ${this.containerName} ${elapsed} - ${e} ${transportUrl}`)
        connected = false
      }

      await Zemu.sleep()
    }
  }

  private async assignPortsToListen(): Promise<void> {
    if (this.transportPort === undefined || this.speculosApiPort === undefined) {
      this.transportPort = await getPort({ port: this.desiredTransportPort })
      this.speculosApiPort = await getPort({ port: this.desiredSpeculosApiPort })
    }
  }

  log(message: string): void {
    if (this.startOptions.logger?.enabled ?? this.startOptions.logging) {
      const currentTimestamp = new Date().toISOString().slice(11, 23)
      process.stdout.write(`[${this.containerName}] ${currentTimestamp}: ${message}\n`)
    }
  }

  startGRPCServer(ip: string, port: number): void {
    this.grpcManager = new GRPCRouter(ip, port, this.transport)
    this.grpcManager.startServer()
  }

  stopGRPCServer(): void {
    if (this.grpcManager != null) {
      this.grpcManager.stopServer()
    }
  }

  async close(): Promise<void> {
    try {
      this.stopGRPCServer()

      if (this.usingPool && this.pooledContainer && Zemu.containerPool) {
        this.log('Returning container to pool')
        await Zemu.containerPool.release(this.pooledContainer)
        this.usingPool = false
        this.pooledContainer = null
      } else {
        this.log('Stopping container')
        await this.emuContainer.stop()
      }
    } catch (error) {
      this.log(`Error during close: ${error}`)
      // If pool return fails, try to stop container directly
      if (this.usingPool) {
        try {
          await this.emuContainer.stop()
        } catch (stopError) {
          this.log(`Failed to stop container after pool release failure: ${stopError}`)
        }
        this.usingPool = false
        this.pooledContainer = null
      }
      throw error
    }
  }

  getTransport(): Transport {
    if (this.transport == null) throw new Error('Transport is not loaded.')

    // Create a wrapper to intercept transport errors
    const self = this
    const originalTransport = this.transport

    // Return a proxy that intercepts send() calls
    return new Proxy(originalTransport, {
      get(target, prop, receiver) {
        if (prop === 'send') {
          return async function (cla: number, ins: number, p1: number, p2: number, data?: Buffer, statusList?: number[]) {
            try {
              self.lastTransportError = null // Clear previous error
              const result = await target.send(cla, ins, p1, p2, data, statusList)
              return result
            } catch (error) {
              // Store the error for later checks
              self.lastTransportError = error as Error

              // Log critical errors
              if (isCriticalTransportError(error)) {
                const statusCode = (error as any).statusCode
                self.log(`Critical transport error detected: ${getAPDUStatusMessage(statusCode)}`)
              }

              // Re-throw the error
              throw error
            }
          }
        }

        // For exchange and other methods, apply similar wrapping
        if (prop === 'exchange') {
          return async function (apdu: Buffer) {
            try {
              self.lastTransportError = null
              const result = await target.exchange(apdu)
              return result
            } catch (error) {
              self.lastTransportError = error as Error
              if (isCriticalTransportError(error)) {
                const statusCode = (error as any).statusCode
                self.log(`Critical transport error detected: ${getAPDUStatusMessage(statusCode)}`)
              }
              throw error
            }
          }
        }

        // For all other properties/methods, return as-is
        return Reflect.get(target, prop, receiver)
      },
    }) as Transport
  }

  getWindowRect(): IDeviceWindow {
    switch (this.startOptions.model) {
      case 'nanos':
        return WINDOW_S
      case 'nanox':
      case 'nanosp':
        return WINDOW_X
      case 'stax':
        return WINDOW_STAX
      case 'flex':
        return WINDOW_FLEX
      default:
        throw new Error(`model ${this.startOptions.model} not recognized`)
    }
  }

  async fetchSnapshot(url: string): Promise<AxiosResponse<Buffer, any>> {
    // Exponential back-off retry delay between requests
    // eslint-disable-next-line @typescript-eslint/unbound-method
    axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay })

    return await axios({
      method: 'GET',
      url,
      responseType: 'arraybuffer',
    })
  }

  saveSnapshot(arrayBuffer: Buffer, filePath: string): void {
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer), 'binary')
  }

  convertBufferToPNG(arrayBuffer: Buffer): PNGWithMetadata {
    return PNG.sync.read(Buffer.from(arrayBuffer))
  }

  async snapshot(filename = ''): Promise<ISnapshot> {
    const snapshotUrl = `${this.transportProtocol}://${this.host}:${this.speculosApiPort}/screenshot`
    const { data } = await this.fetchSnapshot(snapshotUrl)
    const modelWindow = this.getWindowRect()

    if (filename !== '') this.saveSnapshot(data, filename)

    const rect: ISnapshot = {
      height: modelWindow.height,
      width: modelWindow.width,
      data,
    }

    return rect
  }

  getMainMenuSnapshot(): ISnapshot {
    return this.mainMenuSnapshot
  }

  async waitUntilScreenIs(screen: ISnapshot, timeout = DEFAULT_WAIT_TIMEOUT): Promise<void> {
    const start = new Date()

    const inputSnapshotBufferHex = screen.data
    let currentSnapshotBufferHex = (await this.snapshot('')).data

    this.log('Wait until screen is')

    while (!inputSnapshotBufferHex.equals(currentSnapshotBufferHex)) {
      // Check for critical transport errors that should fail immediately
      if (this.lastTransportError && isCriticalTransportError(this.lastTransportError)) {
        const statusCode = (this.lastTransportError as any).statusCode
        throw new TransportError(
          `Transport error ${getAPDUStatusMessage(statusCode)} - failing immediately instead of waiting for timeout`,
          statusCode,
          this.lastTransportError
        )
      }

      const currentTime = new Date()
      const elapsed = currentTime.getTime() - start.getTime()
      if (elapsed > timeout) {
        this.log('Timeout waiting for screen to be')
        throw new Error(`Timeout waiting for screen to be (${timeout} ms)`)
      }
      await Zemu.sleep()
      this.log(`Check [${elapsed}ms]`)
      currentSnapshotBufferHex = (await this.snapshot()).data
    }
    this.log('Screen matches')
  }

  async waitUntilScreenIsNot(screen: ISnapshot, timeout = DEFAULT_WAIT_TIMEOUT): Promise<void> {
    const start = new Date()

    const inputSnapshotBufferHex = screen.data
    let currentSnapshotBufferHex = (await this.snapshot('')).data

    this.log('Wait until screen is not')

    while (inputSnapshotBufferHex.equals(currentSnapshotBufferHex)) {
      // Check for critical transport errors that should fail immediately
      if (this.lastTransportError && isCriticalTransportError(this.lastTransportError)) {
        const statusCode = (this.lastTransportError as any).statusCode
        throw new TransportError(
          `Transport error ${getAPDUStatusMessage(statusCode)} - failing immediately instead of waiting for timeout`,
          statusCode,
          this.lastTransportError
        )
      }

      const currentTime = new Date()
      const elapsed = currentTime.getTime() - start.getTime()
      if (elapsed > timeout) {
        this.log('Timeout waiting for screen to be not')
        throw new Error(`Timeout waiting for screen to be not (${timeout} ms)`)
      }
      await Zemu.sleep()
      this.log(`Check [${elapsed}ms]`)
      currentSnapshotBufferHex = (await this.snapshot()).data
    }
    this.log('Screen changed')
  }

  eventsAreEqual(events1: IEvent[], events2: IEvent[]): boolean {
    if (events1.length !== events2.length) return false
    for (let i = 0; i < events1.length; i++) {
      if (events1[i].x !== events2[i].x) return false
      if (events1[i].y !== events2[i].y) return false
      if (events1[i].text !== events2[i].text) return false
    }
    return true
  }

  async waitForScreenChanges(prevEvents: IEvent[], timeout = DEFAULT_WAIT_TIMEOUT): Promise<void> {
    let currEvents = await this.getEvents()
    const startTime = new Date()

    this.log('Wait for screen changes')

    while (this.eventsAreEqual(prevEvents, currEvents)) {
      const elapsed = Date.now() - startTime.getTime()
      if (elapsed > timeout) {
        this.log('Timeout waiting for screen to change')
        throw new Error(`Timeout waiting for screen to change (${timeout} ms)`)
      }
      await Zemu.sleep()
      this.log(`Check [${elapsed}ms]`)
      currEvents = await this.getEvents()
    }
    this.log(JSON.stringify(currEvents))
    this.log('Events changed')
  }

  formatIndexString(i: number): string {
    return `${i}`.padStart(5, '0')
  }

  getSnapshotPath(snapshotPrefix: string, index: number, takeSnapshots: boolean): string {
    return takeSnapshots ? `${snapshotPrefix}/${this.formatIndexString(index)}.png` : ''
  }

  async toggleExpertMode(testcaseName = '', takeSnapshots = false, startImgIndex = 0): Promise<number> {
    const nav = zondaxToggleExpertMode(this.startOptions.model)
    return await this.navigate('.', testcaseName, nav.schedule, true, takeSnapshots, startImgIndex)
  }

  async toggleBlindSigning(testcaseName = '', takeSnapshots = false, startImgIndex = 0): Promise<number> {
    const nav = zondaxToggleBlindSigning(this.startOptions.model)
    return await this.navigate('.', testcaseName, nav.schedule, true, takeSnapshots, startImgIndex)
  }

  async enableSpecialMode(
    nanoModeText: string,
    nanoIsSecretMode = false,
    touchToggleSettingButton?: ButtonKind,
    path = '.',
    testcaseName = '',
    waitForScreenUpdate = true,
    takeSnapshots = false,
    startImgIndex = 0,
    timeout = DEFAULT_METHOD_TIMEOUT
  ): Promise<number> {
    if (!isTouchDevice(this.startOptions.model)) {
      const expertImgIndex = await this.toggleExpertMode(testcaseName, takeSnapshots, startImgIndex)
      let tmpImgIndex = await this.navigateUntilText(
        path,
        testcaseName,
        nanoModeText,
        waitForScreenUpdate,
        takeSnapshots,
        expertImgIndex,
        timeout,
        !nanoIsSecretMode
      )
      if (nanoIsSecretMode) {
        const secretClicks = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // 10 double clicks
        // do not wait for screen update
        tmpImgIndex = await this.navigate(path, testcaseName, secretClicks, false, takeSnapshots, tmpImgIndex)
      }
      return await this.navigateUntilText('.', testcaseName, this.startOptions.approveKeyword, true, takeSnapshots, tmpImgIndex, timeout)
    }
    const nav = zondaxTouchEnableSpecialMode(this.startOptions.model, touchToggleSettingButton)
    return await this.navigate(path, testcaseName, nav.schedule, waitForScreenUpdate, takeSnapshots, startImgIndex)
  }

  async navigate(
    path: string,
    testcaseName: string,
    navigateSchedule: Array<INavElement | number>,
    waitForScreenUpdate = true,
    takeSnapshots = true,
    startImgIndex = 0,
    waitForEventsChange = false
  ): Promise<number> {
    const snapshotPrefixGolden = resolve(`${path}/snapshots/${testcaseName}`)
    const snapshotPrefixTmp = resolve(`${path}/snapshots-tmp/${testcaseName}`)

    const navSchedule = scheduleToNavElement(navigateSchedule)

    if (takeSnapshots) {
      fs.ensureDirSync(snapshotPrefixGolden)
      fs.ensureDirSync(snapshotPrefixTmp)
    }
    let imageIndex = startImgIndex
    let filename = this.getSnapshotPath(snapshotPrefixTmp, imageIndex, takeSnapshots)
    this.log('---------------------------')
    this.log(`Start        ${filename}`)
    await this.snapshot(filename)
    this.log(`Instructions ${navSchedule}`)

    for (const nav of navSchedule) {
      imageIndex += 1
      filename = this.getSnapshotPath(snapshotPrefixTmp, imageIndex, takeSnapshots)
      await this.runAction(nav, filename, waitForScreenUpdate, waitForEventsChange)
    }

    return imageIndex
  }

  async takeSnapshotAndOverwrite(path: string, testcaseName: string, imageIndex: number): Promise<void> {
    const snapshotPrefixTmp = resolve(`${path}/snapshots-tmp/${testcaseName}`)
    fs.ensureDirSync(snapshotPrefixTmp)
    const filename = this.getSnapshotPath(snapshotPrefixTmp, imageIndex, true)

    try {
      if (filename === '') throw new Error('Snapshot filename not defined')
      fs.unlinkSync(filename)
    } catch (err) {
      this.log(`${err}`)
      throw new Error('Snapshot does not exist')
    }
    await this.snapshot(filename)
  }

  async navigateAndCompareSnapshots(
    path: string,
    testcaseName: string,
    navigateSchedule: Array<INavElement | number>,
    waitForScreenUpdate = true,
    startImgIndex = 0
  ): Promise<boolean> {
    const takeSnapshots = true
    const lastImgIndex = await this.navigate(path, testcaseName, navigateSchedule, waitForScreenUpdate, takeSnapshots, startImgIndex)
    return this.compareSnapshots(path, testcaseName, lastImgIndex)
  }

  compareSnapshots(path: string, testcaseName: string, lastSnapshotIdx: number): boolean {
    const snapshotPrefixGolden = resolve(`${path}/snapshots/${testcaseName}`)
    const snapshotPrefixTmp = resolve(`${path}/snapshots-tmp/${testcaseName}`)

    this.log(`golden      ${snapshotPrefixGolden}`)
    this.log(`tmp         ${snapshotPrefixTmp}`)

    this.log('Start comparison')
    for (let j = 0; j <= lastSnapshotIdx; j += 1) {
      this.log(`Checked     ${snapshotPrefixTmp}/${this.formatIndexString(j)}.png`)
      const img1 = Zemu.LoadPng2RGB(`${snapshotPrefixTmp}/${this.formatIndexString(j)}.png`)
      const img2 = Zemu.LoadPng2RGB(`${snapshotPrefixGolden}/${this.formatIndexString(j)}.png`)

      if (!img1.data.equals(img2.data)) {
        throw new Error(`Image [${this.formatIndexString(j)}] do not match!`)
      }
    }
    return true
  }

  async compareSnapshotsAndApprove(
    path: string,
    testcaseName: string,
    waitForScreenUpdate = true,
    startImgIndex = 0,
    timeout = DEFAULT_METHOD_TIMEOUT,
    isBlindSigning = false
  ): Promise<boolean> {
    const approveKeyword = this.startOptions.approveKeyword
    const takeSnapshots = true
    const lastSnapshotIdx = await this.navigateUntilText(
      path,
      testcaseName,
      approveKeyword,
      waitForScreenUpdate,
      takeSnapshots,
      startImgIndex,
      timeout,
      true,
      true,
      isBlindSigning
    )
    if (isTouchDevice(this.startOptions.model)) {
      // Avoid taking a snapshot of the final animation
      await this.waitUntilScreenIs(this.mainMenuSnapshot)
      await this.takeSnapshotAndOverwrite(path, testcaseName, lastSnapshotIdx)
    }
    return this.compareSnapshots(path, testcaseName, lastSnapshotIdx)
  }

  async compareSnapshotsAndReject(
    path: string,
    testcaseName: string,
    waitForScreenUpdate = true,
    startImgIndex = 0,
    timeout = DEFAULT_METHOD_TIMEOUT
  ): Promise<boolean> {
    const rejectKeyword = this.startOptions.rejectKeyword
    if (!isTouchDevice(this.startOptions.model)) {
      return await this.navigateAndCompareUntilText(path, testcaseName, rejectKeyword, waitForScreenUpdate, startImgIndex, timeout)
    }
    const takeSnapshots = true
    const runLastAction = false
    // For Stax/Flex devices navigate until reject keyword --> Reject --> Confirm rejection
    // reject keyword should be actually approve keyword (issue with OCR)
    const navLastIndex = await this.navigateUntilText(
      path,
      testcaseName,
      rejectKeyword,
      waitForScreenUpdate,
      takeSnapshots,
      startImgIndex,
      timeout,
      runLastAction
    )
    const rejectConfirmationNav = new TouchNavigation(this.startOptions.model, [ButtonKind.RejectButton, ButtonKind.ConfirmYesButton])
    // Overwrite last snapshot since navigate starts taking a snapshot of the current screen
    const lastIndex = await this.navigate(
      path,
      testcaseName,
      rejectConfirmationNav.schedule,
      waitForScreenUpdate,
      takeSnapshots,
      navLastIndex - 1
    )
    // Avoid taking a snapshot of the final animation
    await this.waitUntilScreenIs(this.mainMenuSnapshot)
    await this.takeSnapshotAndOverwrite(path, testcaseName, lastIndex)
    return this.compareSnapshots(path, testcaseName, lastIndex)
  }

  async navigateUntilText(
    path: string,
    testcaseName: string,
    text: string | RegExp,
    waitForScreenUpdate = true,
    takeSnapshots = true,
    startImgIndex = 0,
    timeout = DEFAULT_METHOD_TIMEOUT,
    runLastAction = true,
    waitForInitialEventsChange = true,
    isBlindSigning = false
  ): Promise<number> {
    const snapshotPrefixGolden = resolve(`${path}/snapshots/${testcaseName}`)
    const snapshotPrefixTmp = resolve(`${path}/snapshots-tmp/${testcaseName}`)

    if (takeSnapshots) {
      fs.ensureDirSync(snapshotPrefixGolden)
      fs.ensureDirSync(snapshotPrefixTmp)
    }

    let imageIndex = startImgIndex
    let filename = this.getSnapshotPath(snapshotPrefixTmp, imageIndex, takeSnapshots)
    if (waitForInitialEventsChange) await this.waitForScreenChanges(this.initialEvents)
    await this.snapshot(filename)

    let start = new Date()
    let found = false
    const touchDevice = isTouchDevice(this.startOptions.model)

    const textRegex = new RegExp(text, 'i')

    while (!found) {
      const currentTime = new Date()
      const elapsed = currentTime.getTime() - start.getTime()

      if (elapsed > timeout) {
        throw new Error(`Timeout waiting for screen containing ${text}`)
      }

      const events = await this.getEvents()
      imageIndex += 1
      filename = this.getSnapshotPath(snapshotPrefixTmp, imageIndex, takeSnapshots)

      found = events.some((event: IEvent) => textRegex.test(event.text))
      if (found) break

      const nav: INavElement = {
        type: touchDevice ? ActionKind.Touch : ActionKind.RightClick,
        button:
          imageIndex === 1 && isBlindSigning
            ? getTouchElement(this.startOptions.model, ButtonKind.RejectButton)
            : getTouchElement(this.startOptions.model, ButtonKind.SwipeContinueButton), // Change button based on imageIndex
      }
      await this.runAction(nav, filename, waitForScreenUpdate, true)
      start = new Date()
    }

    if (!runLastAction) return imageIndex // do not run last action if requested

    // Approve can be performed with Tap or PressAndHold
    const approveButton = getTouchElement(this.startOptions.model, this.startOptions.approveAction)

    if (this.startOptions.approveAction === ButtonKind.DynamicTapButton) {
      const events = await this.getEvents()
      const matchingEvent = events.find((event: IEvent) => textRegex.test(event.text))

      if (matchingEvent != null) {
        approveButton.x = Math.round(matchingEvent.x + matchingEvent.w / 2)
        approveButton.y = Math.round(matchingEvent.y + matchingEvent.h / 2)
      }
    }

    const nav: INavElement = {
      type: touchDevice ? ActionKind.Touch : ActionKind.BothClick,
      button: approveButton,
    }
    await this.runAction(nav, filename, waitForScreenUpdate, true)
    return imageIndex
  }

  async navigateAndCompareUntilText(
    path: string,
    testcaseName: string,
    text: string | RegExp,
    waitForScreenUpdate = true,
    startImgIndex = 0,
    timeout = DEFAULT_METHOD_TIMEOUT,
    waitForInitialEventsChange = true
  ): Promise<boolean> {
    const takeSnapshots = true
    const lastImgIndex = await this.navigateUntilText(
      path,
      testcaseName,
      text,
      waitForScreenUpdate,
      takeSnapshots,
      startImgIndex,
      timeout,
      true, // runLastAction
      waitForInitialEventsChange
    )
    return this.compareSnapshots(path, testcaseName, lastImgIndex)
  }

  async getEvents(): Promise<IEvent[]> {
    // Check if we have a critical transport error that should be propagated
    if (this.lastTransportError && isCriticalTransportError(this.lastTransportError)) {
      throw this.lastTransportError
    }

    // eslint-disable-next-line @typescript-eslint/unbound-method
    axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay })
    const eventsUrl = `${this.transportProtocol}://${this.host}:${this.speculosApiPort}/events`
    try {
      const { data } = await axios.get(eventsUrl)
      return data.events
    } catch (error) {
      // Only suppress network errors for events endpoint
      // Transport errors should still be tracked via lastTransportError
      this.log(`Failed to get events: ${error}`)
      return []
    }
  }

  async deleteEvents(): Promise<void> {
    await axios({
      method: 'DELETE',
      url: `${this.transportProtocol}://${this.host}:${this.speculosApiPort}/events`,
    })
  }

  async dumpEvents(): Promise<void> {
    const events = await this.getEvents()
    if (events != null) {
      for (const x of events) {
        this.log(`[ZEMU] ${JSON.stringify(x)}`)
      }
    }
  }

  async waitForText(text: string | RegExp, timeout = DEFAULT_METHOD_TIMEOUT, caseSensitive = false): Promise<void> {
    const start = new Date()
    let found = false
    const flags = !caseSensitive ? 'i' : ''
    const startRegex = new RegExp(text, flags)

    while (!found) {
      // Check for critical transport errors that should fail immediately
      if (this.lastTransportError && isCriticalTransportError(this.lastTransportError)) {
        const statusCode = (this.lastTransportError as any).statusCode
        throw new TransportError(
          `Transport error ${getAPDUStatusMessage(statusCode)} - failing immediately instead of waiting for timeout`,
          statusCode,
          this.lastTransportError
        )
      }

      const currentTime = new Date()
      const elapsed = currentTime.getTime() - start.getTime()
      if (elapsed > timeout) {
        throw new Error(`Timeout (${timeout}) waiting for text (${text})`)
      }

      const events = await this.getEvents()
      found = events.some((event: IEvent) => startRegex.test(event.text))
      await Zemu.sleep()
    }
  }

  async click(endpoint: string, filename = '', waitForScreenUpdate = true, waitForEventsChange = false): Promise<ISnapshot> {
    if (!this.startOptions.model.startsWith('nano')) throw new Error('click method can only be used with nano devices')
    const prevEvents = await this.getEvents()
    const prevScreen = await this.snapshot()

    const clickUrl = `${this.transportProtocol}://${this.host}:${this.speculosApiPort}${endpoint}`
    const payload = { action: 'press-and-release' }
    await axios.post(clickUrl, payload)
    this.log(`Click ${endpoint} -> ${filename}`)

    // Wait and poll Speculos until the application screen gets updated
    if (waitForScreenUpdate) {
      await this.waitUntilScreenIsNot(prevScreen)
      if (waitForEventsChange) await this.waitForScreenChanges(prevEvents)
    } else {
      // A minimum delay is required
      await Zemu.sleep()
    }

    return await this.snapshot(filename)
  }

  async clickLeft(filename = '', waitForScreenUpdate = true, waitForEventsChange = false): Promise<ISnapshot> {
    return await this.click('/button/left', filename, waitForScreenUpdate, waitForEventsChange)
  }

  async clickRight(filename = '', waitForScreenUpdate = true, waitForEventsChange = false): Promise<ISnapshot> {
    return await this.click('/button/right', filename, waitForScreenUpdate, waitForEventsChange)
  }

  async clickBoth(filename = '', waitForScreenUpdate = true, waitForEventsChange = false): Promise<ISnapshot> {
    return await this.click('/button/both', filename, waitForScreenUpdate, waitForEventsChange)
  }

  private getSwipeCoordinates(button: IButton): ISwipeCoordinates {
    let newX = button.x
    let newY = button.y
    const SWIPE_PX_MOVEMENT = 10

    switch (button.direction) {
      case SwipeDirection.SwipeUp:
        newY += SWIPE_PX_MOVEMENT
        break

      case SwipeDirection.SwipeDown:
        newY -= SWIPE_PX_MOVEMENT
        break

      case SwipeDirection.SwipeRight:
        newX += SWIPE_PX_MOVEMENT
        break

      case SwipeDirection.SwipeLeft:
        newX -= SWIPE_PX_MOVEMENT
        break

      case SwipeDirection.NoSwipe:
        break
    }
    return {
      x: newX,
      y: newY,
    }
  }

  async fingerTouch(button: IButton, filename = '', waitForScreenUpdate = true, waitForEventsChange = false): Promise<ISnapshot> {
    if (!isTouchDevice(this.startOptions.model)) throw new Error('fingerTouch method can only be used with touchable devices')
    const prevEvents = await this.getEvents()
    const prevScreen = await this.snapshot()

    const fingerTouchUrl = `${this.transportProtocol}://${this.host}:${this.speculosApiPort}/finger`

    // Add x2, y2 params only for Swipe
    const swipe = this.getSwipeCoordinates(button)
    const payload = {
      action: 'press-and-release',
      x: button.x,
      y: button.y,
      delay: button.delay,
      ...(button.direction !== SwipeDirection.NoSwipe ? { x2: swipe.x, y2: swipe.y } : {}),
    }
    await axios.post(fingerTouchUrl, payload)
    this.log(`Touch /finger -> ${filename}`)

    // Wait and poll Speculos until the application screen gets updated
    if (waitForScreenUpdate) {
      await this.waitUntilScreenIsNot(prevScreen)
      if (waitForEventsChange) await this.waitForScreenChanges(prevEvents)
    } else {
      // A minimum delay is required
      await Zemu.sleep()
    }

    return await this.snapshot(filename)
  }

  async runAction(navElement: INavElement, filename = '', waitForScreenUpdate = true, waitForEventsChange = false): Promise<void> {
    switch (navElement.type) {
      case ActionKind.RightClick:
        await this.clickRight(filename, waitForScreenUpdate, waitForEventsChange)
        break

      case ActionKind.LeftClick:
        await this.clickLeft(filename, waitForScreenUpdate, waitForEventsChange)
        break

      case ActionKind.BothClick:
        await this.clickBoth(filename, waitForScreenUpdate, waitForEventsChange)
        break

      case ActionKind.Touch:
        await this.fingerTouch(navElement.button, filename, waitForScreenUpdate, waitForEventsChange)
        break
      default:
        throw new Error('Action type not implemented')
    }
  }

  async runActionBatch(navElements: INavElement[], filename = '', waitForScreenUpdate = true, waitForEventsChange = false): Promise<void> {
    for (const nav of navElements) {
      await this.runAction(nav, filename, waitForScreenUpdate, waitForEventsChange)
    }
  }
}
