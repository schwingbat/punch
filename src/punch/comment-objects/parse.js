const parsers = {
  vsts: require('./parsers/vsts.js')
}
const noopParser = require('./parsers/noop.js')

module.exports = function (objects) {
  return objects.map(o => {
    let lowerKey = o.key.toLowerCase()
    if (parsers[lowerKey]) {
      return parsers[lowerKey](o)
    } else {
      return noopParser(o)
    }
  })
}