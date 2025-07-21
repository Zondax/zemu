import Zemu from '../src/index'

;(async () => {
  await Zemu.checkAndPullImage()
  await Zemu.stopAllEmuContainers()
})()
