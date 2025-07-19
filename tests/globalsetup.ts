import Zemu from '../src'

const catchExit = () => {
  process.on('SIGINT', () => {
    console.log('Stopping dangling containers')
    Zemu.stopAllEmuContainers()
  })
}

module.exports = async () => {
  await catchExit()
}
