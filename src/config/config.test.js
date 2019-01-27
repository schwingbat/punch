const path = require('path')
const defaultConfig = require('./default.json')
const config = require('./index')
const brokenConfigPath = path.join(__dirname, '../test/brokentestconfig.json')

describe('Config', () => {
  it('loads a config file from a given path', () => {
    expect(config(path.join(__dirname, 'default.json'))).toEqual(defaultConfig)
  })

  it('loads the default config when not given a path', () => {
    expect(config()).toBeTruthy()
  })
})
