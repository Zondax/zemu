import Zemu from '../src'

const catchExit = () => {
  const cleanup = () => {
    console.log('Stopping dangling containers')
    Zemu.stopAllEmuContainers()
  }

  // Handle various exit signals
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  process.on('beforeExit', cleanup)

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception, cleaning up containers:', error)
    cleanup()
    process.exit(1)
  })

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection, cleaning up containers:', reason)
    cleanup()
    process.exit(1)
  })
}

module.exports = () => {
  catchExit()
}
