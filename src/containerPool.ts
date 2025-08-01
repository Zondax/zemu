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

import axios from 'axios'
import axiosRetry from 'axios-retry'
import Docker from 'dockerode'
import rndstr from 'randomstring'
import { BASE_NAME, DEFAULT_EMU_IMG, DEFAULT_HOST, DEFAULT_START_DELAY } from './constants'
import EmuContainer from './emulator'
import type { IStartOptions, TModel } from './types'

export interface IPooledContainer {
  container: EmuContainer
  transportPort: number
  speculosApiPort: number
  model: TModel
  containerName: string
  isAvailable: boolean
  createdAt: Date
  lastUsed: Date
}

export interface IPoolConfig {
  nanos?: number
  nanox?: number
  nanosp?: number
  stax?: number
  flex?: number
}

export class ContainerPool {
  private static instance: ContainerPool | null = null
  private pools: Map<TModel, IPooledContainer[]> = new Map()
  private busyContainers: Set<string> = new Set()
  private portRanges: Map<TModel, { transportStart: number; speculosStart: number }> = new Map()
  private readonly host: string = DEFAULT_HOST
  private readonly emuImage: string = DEFAULT_EMU_IMG
  private readonly docker: Docker = new Docker()

  private constructor() {
    this.initializePortRanges()
  }

  static getInstance(): ContainerPool {
    if (!ContainerPool.instance) {
      ContainerPool.instance = new ContainerPool()
    }
    return ContainerPool.instance
  }

  private initializePortRanges(): void {
    // Pre-allocate port ranges for each device type to avoid conflicts
    this.portRanges.set('nanos', { transportStart: 10000, speculosStart: 15000 })
    this.portRanges.set('nanox', { transportStart: 10100, speculosStart: 15100 })
    this.portRanges.set('nanosp', { transportStart: 10200, speculosStart: 15200 })
    this.portRanges.set('stax', { transportStart: 10300, speculosStart: 15300 })
    this.portRanges.set('flex', { transportStart: 10400, speculosStart: 15400 })
  }

  async initialize(config: IPoolConfig): Promise<void> {
    // Clean up any stale containers before initializing new ones
    await this.cleanupStaleContainers()

    const initPromises: Promise<void>[] = []

    for (const [model, count] of Object.entries(config)) {
      if (count && count > 0) {
        initPromises.push(this.createPoolForModel(model as TModel, count))
      }
    }

    await Promise.all(initPromises)
  }

  private async createPoolForModel(model: TModel, count: number): Promise<void> {
    const containers: IPooledContainer[] = []
    const portRange = this.portRanges.get(model)

    if (!portRange) {
      throw new Error(`No port range configured for model ${model}`)
    }

    // Create containers in parallel for faster initialization
    const createPromises = Array.from({ length: count }, async (_, index) => {
      const transportPort = portRange.transportStart + index
      const speculosApiPort = portRange.speculosStart + index
      const containerName = `${BASE_NAME}-pool-${model}-${index}-${rndstr.generate(4)}`

      try {
        const container = await this.createContainer(model, containerName, transportPort, speculosApiPort)

        const pooledContainer: IPooledContainer = {
          container,
          transportPort,
          speculosApiPort,
          model,
          containerName,
          isAvailable: true,
          createdAt: new Date(),
          lastUsed: new Date(),
        }

        containers.push(pooledContainer)
      } catch (error) {
        console.warn(`Failed to create pooled container ${containerName}:`, error)
        // Continue with other containers even if one fails
      }
    })

    await Promise.all(createPromises)

    if (containers.length > 0) {
      this.pools.set(model, containers)
    } else {
      throw new Error(`Failed to create any containers for model ${model}`)
    }
  }

  private async createContainer(
    model: TModel,
    containerName: string,
    transportPort: number,
    speculosApiPort: number
  ): Promise<EmuContainer> {
    // Use a dummy ELF path for pool containers - will be replaced when acquired
    // For now, we need a valid ELF file path to create the container
    const dummyElfPath = 'bin/demoAppS.elf'
    const container = new EmuContainer(dummyElfPath, {}, this.emuImage, containerName)

    const startOptions: IStartOptions = {
      model,
      startText: '',
      approveKeyword: '',
      rejectKeyword: '',
      approveAction: 1,
      logging: false,
      startTimeout: DEFAULT_START_DELAY,
      startDelay: DEFAULT_START_DELAY,
      caseSensitive: false,
      X11: false,
      custom: '',
      sdk: '',
    }

    await container.runContainer({
      ...startOptions,
      transportPort: transportPort.toString(),
      speculosApiPort: speculosApiPort.toString(),
    })

    // Wait for container to be ready
    await this.waitForContainerReady(transportPort, speculosApiPort)

    return container
  }

  private async waitForContainerReady(_transportPort: number, speculosApiPort: number): Promise<void> {
    const startTime = Date.now()
    const maxWait = DEFAULT_START_DELAY

    while (Date.now() - startTime < maxWait) {
      try {
        // Test both transport and API endpoints
        const apiUrl = `http://${this.host}:${speculosApiPort}/screenshot`
        await axios.get(apiUrl, { timeout: 1000 })
        return // Container is ready
      } catch (_error) {
        // Container not ready yet, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    throw new Error(`Container failed to become ready within ${maxWait}ms`)
  }

  async acquire(model: TModel, elfPath: string, libElfs: Record<string, string> = {}): Promise<IPooledContainer | null> {
    const pool = this.pools.get(model)
    if (!pool || pool.length === 0) {
      return null // No pool available for this model
    }

    // Find an available container
    const availableContainer = pool.find((container) => container.isAvailable && !this.busyContainers.has(container.containerName))

    if (!availableContainer) {
      return null // No available containers in pool
    }

    // Mark as busy
    availableContainer.isAvailable = false
    this.busyContainers.add(availableContainer.containerName)
    availableContainer.lastUsed = new Date()

    try {
      // Reset the container and load new ELF
      await this.resetContainer(availableContainer, elfPath, libElfs)
      return availableContainer
    } catch (error) {
      // If reset fails, release the container and return null
      await this.release(availableContainer)
      throw error
    }
  }

  async release(container: IPooledContainer): Promise<void> {
    try {
      // Reset container state for next use
      await this.resetContainerState(container)

      // Mark as available
      container.isAvailable = true
      this.busyContainers.delete(container.containerName)
    } catch (error) {
      console.warn(`Failed to reset container ${container.containerName}, removing from pool:`, error)
      await this.removeFromPool(container)
    }
  }

  private async resetContainer(container: IPooledContainer, elfPath: string, libElfs: Record<string, string>): Promise<void> {
    // Reset Speculos via API
    await this.resetContainerState(container)

    // Load new ELF if different from current
    await this.loadElfInContainer(container, elfPath, libElfs)
  }

  private async resetContainerState(container: IPooledContainer): Promise<void> {
    axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay })

    try {
      // Reset device state via Speculos API
      const resetUrl = `http://${this.host}:${container.speculosApiPort}/button/both`
      await axios.post(resetUrl, { action: 'reset' }, { timeout: 5000 })

      // Clear events
      const eventsUrl = `http://${this.host}:${container.speculosApiPort}/events`
      await axios.delete(eventsUrl, { timeout: 5000 })

      // Small delay to ensure reset is complete
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      throw new Error(`Failed to reset container state: ${error}`)
    }
  }

  private async loadElfInContainer(container: IPooledContainer, elfPath: string, libElfs: Record<string, string>): Promise<void> {
    // For now, we'll restart the container with new ELF
    // In future, could implement dynamic ELF loading via Speculos API
    try {
      await container.container.stop()

      // Recreate container with new ELF
      const newContainer = new EmuContainer(elfPath, libElfs, this.emuImage, container.containerName)

      const startOptions: IStartOptions = {
        model: container.model,
        startText: '',
        approveKeyword: '',
        rejectKeyword: '',
        approveAction: 1,
        logging: false,
        startTimeout: DEFAULT_START_DELAY,
        startDelay: DEFAULT_START_DELAY,
        caseSensitive: false,
        X11: false,
        custom: '',
        sdk: '',
      }

      await newContainer.runContainer({
        ...startOptions,
        transportPort: container.transportPort.toString(),
        speculosApiPort: container.speculosApiPort.toString(),
      })

      await this.waitForContainerReady(container.transportPort, container.speculosApiPort)

      container.container = newContainer
    } catch (error) {
      throw new Error(`Failed to load ELF in container: ${error}`)
    }
  }

  private async removeFromPool(container: IPooledContainer): Promise<void> {
    const pool = this.pools.get(container.model)
    if (pool) {
      const index = pool.findIndex((c) => c.containerName === container.containerName)
      if (index !== -1) {
        pool.splice(index, 1)
      }
    }

    this.busyContainers.delete(container.containerName)

    try {
      await container.container.stop()
    } catch (error) {
      console.warn(`Failed to stop removed container ${container.containerName}:`, error)
    }
  }

  private async cleanupStaleContainers(): Promise<void> {
    try {
      // List all containers that match our naming pattern
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          name: [`${BASE_NAME}-pool-`, `${BASE_NAME}-`],
        },
      })

      if (containers.length === 0) {
        return
      }

      console.warn(`Found ${containers.length} stale zemu containers, cleaning up...`)

      // Remove all found containers in parallel
      const cleanupPromises = containers.map(async (containerInfo) => {
        try {
          const container = this.docker.getContainer(containerInfo.Id)
          await container.remove({ force: true })
        } catch (error) {
          // Ignore errors when removing containers (they might already be removed)
          console.warn(`Failed to remove stale container ${containerInfo.Names?.[0]}:`, error)
        }
      })

      await Promise.all(cleanupPromises)
      console.warn(`Cleaned up ${containers.length} stale containers`)
    } catch (error) {
      console.warn('Failed to cleanup stale containers:', error)
      // Don't throw - we want initialization to continue even if cleanup fails
    }
  }

  async cleanup(): Promise<void> {
    const cleanupPromises: Promise<void>[] = []

    for (const [, pool] of this.pools.entries()) {
      for (const container of pool) {
        cleanupPromises.push(
          container.container.stop().catch((error) => console.warn(`Failed to stop container ${container.containerName}:`, error))
        )
      }
    }

    await Promise.all(cleanupPromises)

    this.pools.clear()
    this.busyContainers.clear()
  }

  getPoolStatus(): Record<string, { total: number; available: number; busy: number }> {
    const status: Record<string, { total: number; available: number; busy: number }> = {}

    for (const [model, pool] of this.pools.entries()) {
      const available = pool.filter((c) => c.isAvailable).length
      const busy = pool.filter((c) => !c.isAvailable).length

      status[model] = {
        total: pool.length,
        available,
        busy,
      }
    }

    return status
  }
}
