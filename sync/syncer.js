const capitalize = (str) => {
  return str[0].toUpperCase() + str.slice(1)
}

module.exports = function(config, flags) {
  const fs = require('fs')
  const path = require('path')
  const chalk = require('chalk')
  const logUpdate = require('log-update')
  const Loader = require('../utils/loader')
  const { write } = process.stdout

  const { VERBOSE } = flags
  const backends = {}

  const { punchPath, configPath } = config

  backends.load = function(name) {
    if (!config.sync.backends[name]) {
      console.log(`Backend ${name} is not configured in config.sync.backends.`)
    } else {
      let conf = config.sync.backends[name]
      let module
      try {
        return require(`./${name.toLowerCase()}.backend.js`)(config.sync.backends[name], flags)
      } catch (err) {
        console.log(`Backend ${name} is not (yet) supported by Punch.`, err)
      }
    }
  }

  function diff(manifest) {
    return new Promise((resolve, reject) => {
      const uploads = [];
      const downloads = [];
      let total = 0;
      let done = 0;

      for (const file in manifest) {
        total += 1;
      }

      // Check for files in sync manifest.
      for (const file in manifest) {
        try {
          const f = JSON.parse(fs.readFileSync(path.join(punchPath, file), 'utf8'));

          if (!manifest[file] || f.updated > manifest[file]) {
            uploads.push(file)
          } else if (f.updated < manifest[file]) {
            downloads.push(file);
          }
        } catch (err) {
          downloads.push(file);
        }
      }

      fs.readdirSync(punchPath).forEach(file => {
        if (!manifest[file]) {
          uploads.push(file);
        }
      });
      if (VERBOSE) console.log(`Finished diffing ${total} files.`);
      return resolve({ uploads, downloads, manifest });
    });
  }

  async function writeFiles(results) {
    if (results.downloaded) {
      let count = 0;
      for (const name in results.downloaded) {
        const d = results.downloaded[name];
        fs.writeFileSync(path.join(config.punchPath, name), JSON.stringify(d, null, 2));
      }
      if (VERBOSE && count > 0) console.log(`Wrote ${count} downloaded files.`);
    }
    return results;
  }

  async function readFiles(results) {
    if (VERBOSE && results.uploads.length > 0) console.log(`Reading contents of files to be uploaded.`);

    let count = 0;
    const uploadable = {};
    results.uploads.forEach(u => {
      count += 1;
      uploadable[u] = JSON.parse(fs.readFileSync(path.join(punchPath, u), 'utf8'));
    });
    results.uploadable = uploadable;

    if (VERBOSE && count > 0) {
      console.log(`Read contents of ${count} files.`);
    }

    return results;
  }

  async function updateStamps(results) {
    const { uploads, postManifest } = results;

    if (results._dummy) return results;

    if (uploads && uploads.length > 0) {
      if (VERBOSE) console.log('Updating timestamps on uploaded files...');
      uploads.forEach(file => {
        if (postManifest[file]) {
          try {
            const p = path.join(punchPath, file)
            const f = JSON.parse(fs.readFileSync(p, 'utf8'));
            f.updated = postManifest[file];
            fs.writeFileSync(p, JSON.stringify(f, null, 2));
          } catch (err) {
            console.error(`There was a problem updating the timestamp on ${file}: ${err}`);
          }
        }
      });
    }

    return results;
  }

  async function doSync(backend, next) {
    const service = backends.load(backend);
    const loader = new Loader({
      text: `[${capitalize(backend)}] Syncing...`,
      animation: 'braille',
    });
    loader.start();

    if (service) {
      service
        .getManifest()
        .then(diff)
        .then(readFiles)
        .then(service.upload)
        .then(service.download)
        .then(writeFiles)
        .then(updateStamps)
        .then(r => {
          const up = r.uploads.length;
          const down = r.downloads.length;

          let counts = '';
          if (up > 0) counts += ` ${chalk.magenta('⬈')} ${up} up`;
          if (down > 0) counts += ` ${chalk.cyan('⬊')} ${down} down`;
          if (counts === '') counts = ` ${chalk.green('⊙')} no changes`;

          loader.stop(`${chalk.green('⸭')} Synced with ${capitalize(backend)}! ${counts}`);
          next();
        })
        .catch(err => {
          console.error(`${chalk.red('⁙')} Sync with ${capitalize(backend)} failed!`, err);
          next();
        });
    } else {
      console.log(`No sync service by the name ${backend}`);
      next();
    }
  }

  return {
    sync() {
      const syncers = [];
      const start = Date.now();

      const backends = Object.keys(config.sync.backends);
      let current = 0;

      const next = () => {
        if (backends[current]) {
          doSync(backends[current], next.bind(this));
          current += 1;
        } else {
          return Promise.all(syncers);
        }
      }

      next();
    }
  }
}
