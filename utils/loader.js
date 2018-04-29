const loaders = {
  braille: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
  spinner: ['|', '/', '-', '\\'],
  transfer: [
    '[-------]',
    '[>------]',
    '[<>-----]',
    '[-<>----]',
    '[--<>---]',
    '[---<>--]',
    '[----<>-]',
    '[-----<>]',
    '[------<]'
  ],
  tris: ['◢', '◣', '◤', '◥']
}

module.exports = function ({ text = 'Loading...', animation = 'braille', stopText, fps = 12 } = {}) {
  const chalk = require('chalk')
  const logUpdate = require('log-update')

  let interval
  let frames = loaders[animation]
  let i = 0

  return {
    start (startText = text) {
      if (!interval) {
        i = 0
        console.log()
        interval = setInterval(() => {
          logUpdate(chalk.yellow(frames[i]) + ' ' + startText)
          i = (i + 1) % frames.length
        }, 1000 / fps)
      }
      return this
    },
    stop (stopText) {
      clearInterval(interval)
      interval = null
      i = 0

      if (stopText) {
        logUpdate(stopText)
      }
    }
  }
}
