import Zemu from '../src/index'

async function main(): Promise<void> {
  await Zemu.checkAndPullImage()
  await Zemu.stopAllEmuContainers()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
