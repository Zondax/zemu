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

import path from 'node:path'
import { Transform } from 'node:stream'
import Docker, { type Container } from 'dockerode'

// Development certificate key for emulator testing only - NOT FOR PRODUCTION USE
// This is a well-known test key used by the Ledger emulator for development purposes
export const DEV_CERT_PRIVATE_KEY = 'ff701d781f43ce106f72dc26a46b6a83e053b5d07bb3d4ceab79c91ca822a66b'
export const BOLOS_SDK = '/project/deps/nanos-secure-sdk'
export const DEFAULT_APP_PATH = '/project/app/bin'

export interface ILoggerOptions {
  enabled: boolean
  timestamp: {
    enabled: boolean
    format: 'unix' | 'iso'
  }
}

export default class EmuContainer {
  private logger: ILoggerOptions

  private readonly elfLocalPath: string
  private readonly name: string
  private readonly image: string
  private readonly libElfs: Record<string, string>
  private currentContainer?: Container
  private stopping?: Promise<void>

  constructor(elfLocalPath: string, libElfs: Record<string, string>, image: string, name: string) {
    this.image = image
    this.elfLocalPath = elfLocalPath
    this.libElfs = libElfs
    this.name = name
    this.logger = {
      enabled: false,
      timestamp: {
        enabled: false,
        format: 'iso',
      },
    }
  }

  /**
   * Force-removes every container whose name contains `name`.
   * `createdAfter` (unix seconds) limits the sweep to containers created after that time.
   */
  static async killContainerByName(name: string, createdAfter?: number): Promise<void> {
    const docker = new Docker()
    const containers = await docker.listContainers({ all: true, filters: { name: [name] } })
    const targets = createdAfter === undefined ? containers : containers.filter((info) => info.Created >= createdAfter)
    await Promise.all(targets.map((info) => docker.getContainer(info.Id).remove({ force: true })))
  }

  static async checkAndPullImage(imageName: string): Promise<void> {
    const docker = new Docker()
    const stream = await docker.pull(imageName)

    await new Promise<void>((resolve, reject) => {
      const onProgress = (event: any): void => {
        const progress = event?.progress ?? ''
        const status = event?.status ?? ''
        process.stdout.write(`[DOCKER] ${status}: ${progress}\n`)
      }

      const onFinished = (err: Error | null): void => {
        if (err != null) {
          process.stdout.write(`[DOCKER] ${err}\n`)
          reject(err)
          return
        }
        resolve()
      }

      docker.modem.followProgress(stream, onFinished, onProgress)
    })
  }

  private formatTimestamp(): string {
    switch (this.logger.timestamp.format) {
      case 'iso':
        return `[${new Date().toISOString()}] `
      case 'unix':
        return `[${Date.now()}] `
      default:
        throw new Error('invalid logger timestamp format')
    }
  }

  log(message: string): void {
    if (!this.logger.enabled) return
    const prefix = this.logger.timestamp.enabled ? this.formatTimestamp() : ''
    process.stdout.write(`${prefix}${message}\n`)
  }

  async runContainer(options: {
    logging: boolean
    logger?: ILoggerOptions
    custom: string
    model: string
    transportPort: string
    speculosApiPort: string
  }): Promise<void> {
    const docker = new Docker()

    this.logger = options.logger ?? { enabled: options.logging, timestamp: { enabled: false, format: 'iso' } }

    const appFilename = path.basename(this.elfLocalPath)
    const appDir = path.dirname(this.elfLocalPath)

    const dirBindings = [`${appDir}:${DEFAULT_APP_PATH}`]

    let libArgs = ''
    for (const [libName, libPath] of Object.entries(this.libElfs)) {
      const libFilename = path.basename(libPath)
      libArgs += ` -l ${libName}:${DEFAULT_APP_PATH}/${libFilename}`
    }

    const customOptions = options.custom

    const displaySetting = '--display headless'
    const command = `/home/zondax/speculos/speculos.py --log-level speculos:DEBUG --color JADE_GREEN ${displaySetting} ${customOptions} -m ${options.model} ${DEFAULT_APP_PATH}/${appFilename} ${libArgs}`

    this.log(`[ZEMU] Command: ${command}`)

    const portBindings: Record<string, Array<{ HostPort: string }>> = {
      '9998/tcp': [{ HostPort: options.transportPort }],
      '5000/tcp': [{ HostPort: options.speculosApiPort }],
    }

    if (customOptions.includes('--debug')) {
      portBindings['1234/tcp'] = [{ HostPort: '1234' }]
    }

    const displayEnvironment: string = process.platform === 'darwin' ? 'host.docker.internal:0' : (process.env.DISPLAY ?? '')
    // Docker passes Env values verbatim (no shell), so no quoting here.
    const environment = [
      `SCP_PRIVKEY=${DEV_CERT_PRIVATE_KEY}`,
      `BOLOS_SDK=${BOLOS_SDK}`,
      'BOLOS_ENV=/opt/bolos',
      `DISPLAY=${displayEnvironment}`,
    ]

    this.log(`[ZEMU] Creating Container ${this.image} - ${this.name} `)
    this.currentContainer = await docker.createContainer({
      Image: this.image,
      name: this.name,
      Tty: true,
      AttachStdout: true,
      AttachStderr: true,
      User: '1000',
      Env: environment,
      HostConfig: {
        PortBindings: portBindings,
        Binds: dirBindings,
      },
      Cmd: [command],
    })

    this.log(`[ZEMU] Connected ${this.currentContainer.id}`)

    if (this.logger.enabled) {
      const timestampTransform = new Transform({
        transform: (chunk, _encoding, callback) => {
          const prefix = this.logger.timestamp.enabled ? this.formatTimestamp() : ''
          callback(null, `${prefix}${chunk}`)
        },
      })

      const stream = await this.currentContainer.attach({ stream: true, stdout: true, stderr: true })
      stream.pipe(timestampTransform).pipe(process.stdout)
      this.log(`[ZEMU] Attached ${this.currentContainer.id}`)
    }

    await this.currentContainer.start()

    this.log(`[ZEMU] Started ${this.currentContainer.id}`)
  }

  /**
   * Stops and removes the container. The handle is only dropped once the
   * container is gone, so a failed attempt can be retried with another stop().
   * Concurrent calls share the same in-flight operation.
   */
  stop(): Promise<void> {
    if (this.stopping == null) {
      this.stopping = this.doStop().finally(() => {
        this.stopping = undefined
      })
    }
    return this.stopping
  }

  private async doStop(): Promise<void> {
    const container = this.currentContainer
    if (container == null) return

    this.log('[ZEMU] Stopping container')
    try {
      await container.stop({ t: 0 })
    } catch (e: any) {
      // 304: already stopped, 404: already gone. Anything else is a real failure.
      if (e?.statusCode !== 304 && e?.statusCode !== 404) {
        this.log(`[ZEMU] Stopping: ${e}`)
        throw e
      }
    }
    this.log('[ZEMU] Stopped')
    try {
      await container.remove({ force: true })
    } catch (e: any) {
      if (e?.statusCode !== 404) {
        this.log(`[ZEMU] Unable to remove container: ${e}`)
        throw e
      }
    }
    this.currentContainer = undefined
    this.log('[ZEMU] Removed')
  }
}
