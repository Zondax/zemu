import Zemu from '../src'

// Registered in vitest.config.ts as globalSetup. Runs once in the main vitest process.

// Only containers created by this run are swept on teardown, so a concurrent
// zemu session on the same Docker daemon is left alone. Ctrl-C still sweeps everything.
let runStartedAt = 0

async function killContainers(reason: string, createdAfter?: number): Promise<void> {
  console.log(`[zemu] ${reason}: stopping dangling containers`)
  try {
    await Zemu.stopAllEmuContainers(createdAfter)
  } catch (error) {
    console.error('[zemu] failed to stop containers:', error)
  }
}

export function setup(): void {
  runStartedAt = Math.floor(Date.now() / 1000) - 1
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void killContainers(signal).finally(() => process.exit(130))
    })
  }
}

export async function teardown(): Promise<void> {
  await killContainers('teardown', runStartedAt)
}
