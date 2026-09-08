import Zemu from '../src'

// Registered in vitest.config.ts as globalSetup. Runs once in the main vitest process.

async function killContainers(reason: string): Promise<void> {
  console.log(`[zemu] ${reason}: stopping dangling containers`)
  try {
    await Zemu.stopAllEmuContainers()
  } catch (error) {
    console.error('[zemu] failed to stop containers:', error)
  }
}

export function setup(): void {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void killContainers(signal).finally(() => process.exit(130))
    })
  }
}

export async function teardown(): Promise<void> {
  await killContainers('teardown')
}
