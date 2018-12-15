const fs = require('fs')
const path = require('path')
const resolvePath = require('../../utils/resolve-path')
const SyncService = require('../syncservice.js')
const MON = require('@schwingbat/mon')
const is = require('@schwingbat/is')

class S3SyncService extends SyncService {
  constructor (appConfig, serviceConfig, Punch, S3 = require('aws-sdk').S3) {
    let creds = new S3Credentials(serviceConfig.credentials, appConfig)
    creds.region = serviceConfig.region || 'us-west-2'
    creds.endpoint = serviceConfig.endpoint || 's3.amazonaws.com'
    
    serviceConfig.auto = serviceConfig.auto == null
      ? true
      : serviceConfig.auto

    super(serviceConfig)

    this._punch = Punch
    this._s3 = new S3(creds)
  }

  getManifest () {
    const s3 = this._s3
    const config = this._config

    return new Promise((resolve, reject) => {
      const params = {
        Bucket: config.bucket,
        Key: 'punchmanifest.json'
      }

      s3.getObject(params, (err, obj) => {
        if (err) {
          if (err.code === 'NoSuchKey') {
            // If manifest doesn't exist, return a blank manifest.
            // There are likely no files in the bucket.
            return resolve({})
          } else {
            return reject(err)
          }
        }

        const manifest = JSON.parse(obj.Body.toString())
        for (const id in manifest) {
          manifest[id] = new Date(manifest[id])
        }

        return resolve(manifest)
      })
    })
  }

  async upload (uploads = [], manifest = {}) {
    const s3 = this._s3
    const config = this._config

    return new Promise((resolve, reject) => {
      if (uploads.length === 0) {
        return resolve([])
      }

      let uploaded = 0
      const done = () => {
        uploaded += 1
        if (uploaded === uploads.length) {
          const newManifest = { ...manifest }
          uploads.forEach(punch => {
            newManifest[punch.id] = punch.updated
          })
          const params = {
            Bucket: config.bucket,
            Key: 'punchmanifest.json',
            Body: JSON.stringify(newManifest, null, 2)
          }
          s3.putObject(params, (err, data) => {
            if (err) return reject(new Error('Error uploading new punchmanifest.json: ' + err.message))
            return resolve(uploads)
          })
        }
      }

      uploads.forEach(punch => {
        const params = {
          Bucket: config.bucket,
          Key: `punches/${punch.id}.json`,
          Body: JSON.stringify(punch.toJSON(true))
        }

        s3.putObject(params, (err, data) => {
          if (err) return reject(new Error('Error while uploading punch data: ' + err.message))
          done()
        })
      })
    })
  }

  download (ids = []) {
    const config = this._config
    const s3 = this._s3
    const Punch = this._punch

    return new Promise((resolve, reject) => {
      if (ids.length === 0) {
        return resolve([])
      }

      const downloaded = []
      const done = () => {
        if (downloaded.length === ids.length) {
          return resolve(downloaded)
        }
      }

      ids.forEach(id => {
        const params = {
          Bucket: config.bucket,
          Key: `punches/${id}.json`
        }

        s3.getObject(params, (err, obj) => {
          if (err) return reject(new Error('Error while downloading punch data: ' + err.message))

          const body = JSON.parse(obj.Body.toString())

          downloaded.push(new Punch(body))
          done()
        })
      })
    })
  }

  getSyncingMessage () {
    let label = this._config.label || `S3 (${this._config.bucket})`
    return `Syncing with ${label}`
  }

  getSyncCompleteMessage () {
    let label = this._config.label || `S3 (${this._config.bucket})`
    return `Synced with ${label}`
  }
}

class S3Credentials {
  constructor (credentials, appConfig) {
    if (!credentials) {
      throw new Error('S3 config has no credentials')
    }

    if (is.string(credentials)) {
      let credPath = resolvePath(credentials, path.dirname(appConfig.configPath))

      if (fs.existsSync(credPath)) {
        const ext = path.extname(credentials).toLowerCase()
        const read = fs.readFileSync(credPath, 'utf8')

        try {
          switch (ext) {
          case '.json':
            credentials = JSON.parse(read)
            break
          case '.mon':
            credentials = MON.parse(read)
            break
          default:
            throw new Error(`${ext} files are not supported as credential sources - use .json or .mon`)
          }
        } catch (err) {
          throw new Error('There was a problem reading the S3 credentials file: ' + err)
        }
      } else {
        throw new Error('Credentials is a path, but the file does not exist: ' + credPath)
      }
    } else if (is.object(credentials)) {
      throw new Error('Credentials should either be a path to a JSON file containing your S3 credentials or an object containing the credentials themselves.')
    }

    if (!credentials.hasOwnProperty('accessKeyId') || !credentials.hasOwnProperty('secretAccessKey')) {
      throw new Error('Credentials must include both accessKeyId and secretAccessKey.')
    }

    this.accessKeyId = credentials.accessKeyId
    this.secretAccessKey = credentials.secretAccessKey
  }
}

module.exports = S3SyncService