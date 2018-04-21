#!/usr/bin/env node

const flags = {
  VERBOSE: false,
  BENCHMARK: false,
  NO_SYNC: false
}

// Process command line args into params/flags

const ARGS = process.argv.slice(2)

for (let i = 0; i < ARGS.length; i++) {
  const arg = ARGS[i]

  if (arg[0] === '-') {
    switch (arg.toLowerCase()) {
    case '-v':
      console.log('punch v' + require('./package.json').version)
      return
    case '--verbose':
      flags.VERBOSE = true
      break
    case '-b':
    case '--benchmark':
      flags.BENCHMARK = true
      require('time-require')
      break
    case '-ns':
    case '--nosync':
    case '--no-sync':
      flags.NO_SYNC = true
      break
    }
  }
}

if (flags.BENCHMARK) {
  require('time-require')
}

// Dependencies
const fs = require('fs')
const path = require('path')

global.appRoot = path.resolve(__dirname)

const moment = require('moment')
const readline = require('readline-sync')
const chalk = require('chalk')
const logUpdate = require('log-update')

const config = require('./config')
const Syncer = require('./sync/syncer')
const Invoicer = require('./invoicing/invoicer')
const Logger = require('./logging/log')
const Punchfile = require('./files/punchfile')(config)
const SQLish = require('./files/sqlish')
const TimeSpan = require('./time/timespan')
const Duration = require('./time/duration')

const { descendingBy } = require('./utils/sort-factories')

// Formatting
const format = require('./format/format')
const summaryfmt = require('./format/projsummary')
const print = require('./logging/printing')

// Utils
const CLI = require('./utils/cli.js')
const resolvePath = require('./utils/resolve-path')

const { autoSync } = config.sync

const { command, run, invoke } = CLI({
  name: 'punch',
  version: require('./package.json').version,
})

/*=========================*\
||          Utils          ||
\*=========================*/

const getLabelFor = name => {
  return config.projects[name]
    ? config.projects[name].name
    : name
}

const getRateFor = name => {
  return config.projects[name]
    ? config.projects[name].hourlyRate
    : 0
}

const getFileFor = date => {
  date = new Date(date)
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()

  return path.join(config.punchPath, `punch_${y}_${m}_${d}.json`)
}

const currentSession = () =>
  Punchfile.mostRecent().punches.find(p => p.out == null)

const getMessageFor = (file) => {
  // Returns a random message from the given file.
  // Assumes the file is a JSON file containing an array of strings in the resources/messages/ folder.
  try {
    const options = require('./resources/messages/' + file + '.json')
    const i = Math.round(Math.random() * options.length - 1)
    console.log(options, i)
    return options[i]
  } catch (err) {
    return 'BLORK'
  }
}

const confirm = question => {
  let response

  while (!['y', 'n', 'yes', 'no'].includes(response)) {
    response = readline.question(`${question} [y/n] `).toLowerCase().trim()

    if (response === 'y' || response === 'yes') {
      return true
    } else if (response === 'n' || response === 'no') {
      return false
    } else {
      console.log('Please enter: y, n, yes or no.')
    }
  }
}

const handleSync = () => {
  if (autoSync && !flags.NO_SYNC) {
    const syncer = Syncer(config, flags)
    syncer.sync()
  }
}

/*=========================*\
||      Parse/Dispatch     ||
\*=========================*/

command({
  signature: 'in <project>',
  description: 'start tracking time on a project',
  run: function(args) {
    const { project } = args

    const current = currentSession()

    if (current) {
      console.log(`You're already punched in on ${getLabelFor(current.project)}! Punch out first.`)
    } else {
      const file = Punchfile.forDate(new Date())
      file.punchIn(project)
      file.save()

      const time = moment().format('h:mm')
      console.log(`Punched in on ${getLabelFor(project)} at ${time}.`)

      handleSync()
    }
  }
})

command({
  signature: 'out [*comment]',
  description: 'stop tracking time and record an optional description of tasks completed', 
  run: function(args) {
    const { comment } = args
    const current = currentSession()

    if (current) {
      current._file.punchOut(current.project)

      const label = getLabelFor(current.project)
      const time = format.time(Date.now())
      const duration = new Duration(current.out - current.in)
      const pay = duration.totalHours() * getRateFor(current.project)

      current.comments.push(comment)
      current._file.save()

      let str = `Punched out on ${label} at ${time}. Worked for ${duration}`
      if (pay > 0) {
         str += ` and earned ${format.currency(pay)}`
      }

      console.log(str + '.')

      handleSync()
    } else {
      console.log(`You're not punched in!`)
    }
  }
})

command({
  signature: 'comment [*comment]',
  description: 'add a comment to remember what you worked on',
  run: function(args) {
    const current = currentSession()

    if (!current) {
      const mostRecent = Punchfile.mostRecent().punches.pop()

      let label = getLabelFor(mostRecent.project)
      let inTime = moment(mostRecent.in)
      let outTime = moment(mostRecent.out)
      let date = new Date().getDate()

      let format = ''

      if (inTime.date() !== date || outTime.date() !== date) {
        format += 'MMMM Do '
      }
      format += 'h:mma'

      inTime = inTime.format(format)
      outTime = outTime.format(format)

      let str = `You're not punched in. Add to last punch on '${label}' (${inTime} - ${outTime})?`

      if (confirm(str)) {
        mostRecent.comments.push(args.comment)
        mostRecent._file.save()

        handleSync()
      }
    } else {
      current.comments.push(args.comment)
      current._file.save()

      console.log('Comment saved.')
      handleSync()
    }
  }
})

command({
  signature: 'create <project> <timeIn> <timeOut> [*comment]',
  description: 'create a punch',
  run: function(args) {
    const { project, timeIn, timeOut, comment } = args

    let punchIn, punchOut
    try {
      punchIn = moment(timeIn, 'MM-DD-YYYY@hh:mmA')
      punchOut = moment(timeOut, 'MM-DD-YYYY@hh:mmA')
    } catch (err) {
      console.log(`Please enter dates formatted as 'mm-dd-yyyy@hours:minutesAM' (err: ${err})`)
    }

    if (!punchIn.isValid() || !punchOut.isValid()) {
      return console.log('Please enter dates formatted as \'mm-dd-yyyy@hours:minutesAM\'')
    }

    const proj = config.projects[project]
    const duration = new Duration(punchOut - punchIn)
    let pay
    if (proj && proj.hourlyRate) {
      pay = format.currency(duration.totalHours() * proj.hourlyRate)
    } else {
      pay = 'N/A'
    }

    let str = ''

    str += `   Project: ${getLabelFor(project)}\n`
    str += `   Time In: ${punchIn.format('dddd, MMM Do YYYY [@] h:mma')}\n`
    str += `  Time Out: ${punchOut.format('dddd, MMM Do YYYY [@] h:mma')}\n`
    str += `  Duration: ${duration}\n`
    str += `       Pay: ${pay}\n`

    if (comment) {
      str += `   Comment: ${comment}\n\n`
    }

    str += '\nCreate this punch?'

    if (confirm(str)) {
      const file = Punchfile.forDate(punchIn.toDate())
      file.addPunch({
        project,
        in: punchIn.toDate(),
        out: punchOut.toDate(),
        comments: comment,
      })
      file.save()

      console.log('Punch created!')

      handleSync()
    }
  }
})

command({
  signature: 'purge <project>',
  description: 'destroy all punches for a given project',
  hidden: true,
  // disabled: true,
  run: function(args) {
    const { project } = args
    const label = getLabelFor(project)
    const punches = SQLish(config, flags)
      .select()
      .from('punches')
      .where(p => p.project === project)
      .run()

    if (punches.length > 0) {
      const totalTime = punches.reduce((sum, p) =>
        sum + ((p.out || Date.now()) - p.in), 0)

      // Confirm and commit changes to files.
      const confirmString = `Purging ${label} would delete ${punches.length} punch${punches.length == 1 ? '' : 'es'} totalling ${new Duration(totalTime)}.`

      console.log(confirmString)

      let response

      while (response !== label) {
        response = readline.question(`Type in '${label}' if you're REALLY sure, or 'n' to cancel: `).toLowerCase().trim()

        if (response === label) {
          // Delete
          punches.forEach(punch => {
            punch._file.punches = punch._file.punches.filter(p => p !== punch)
            punch._file.save()
          })
          console.log(`Purged ${punches.length} punches.`)
        } else if (response === 'n') {
          return false
        }
      }
    } else {
      console.log(`${label} has no punches.`)
    }
  }
})

command({
  signature: 'now',
  description: 'show the status of the current session',
  run: function() {
    const active = currentSession()

    if (active) {
      const duration = new Duration(Date.now() - active.in)
      const rate = getRateFor(active.project)
      const pay = duration.totalHours() * getRateFor(active.project)
      const punchedIn = format.time(active.timestamp)

      let str = `You've been working on ${getLabelFor(active.project)} since ${punchedIn} (${duration} ago).`

      if (rate) {
        str += ` Earned ${format.currency(pay)}.`
      }

      console.log(str)
    } else {
      console.log('No current session.')
    }
  }
})

command ({
  signature: 'watch',
  description: 'continue running to show automatically updated stats of your current session',
  run: function() {
    const active = currentSession()
    const clock = require('./utils/big-clock')({
      style: 'clockBlockDots',
      letterSpacing: 1,
    })

    if (active) {
      const project = config.projects[active.project]
      const label = project && project.name ? project.name : active.project
      const rate = project && project.hourlyRate ? project.hourlyRate : 0

      const update = () => {
        let duration = new Duration(Date.now() - active.in)
        let pay = duration.totalHours() * rate

        let working = `Working on ${label}`
        let money = format.currency(pay)
        let numbers = clock.display(format.clock(duration.milliseconds))
        let numbersLength = numbers.split('\n')[0].length

        let topLine = working.padEnd(numbersLength - money.length, ' ') + money

        logUpdate('\n' + topLine + '\n' + numbers)
      }

      update()
      setInterval(update, 1000)
    } else {
      console.log('You aren\'t punched in right now.')
    }
  }
})

command({
  signature: 'project <name>',
  description: 'get statistics for a specific project',
  run: function(args) {
    invoke(`projects ${args.name || ''}`)
  }
})

command({
  signature: 'projects [names...]',
  description: 'show statistics for all projects in your config file',
  run: function(args) {
    let { names } = args

    if (!names) {
      names = Object.keys(config.projects)
    }

    const allPunches = SQLish(config, flags)
      .select()
      .from('punches')
      .orderBy('in', 'asc')
      .run()

    const summaries = []

    for (let i = 0; i < names.length; i++) {
      const project = names[i]

      const punches = allPunches
          .filter(p => p.project === project)

      let firstPunch = punches[0]
      let latestPunch = punches[punches.length - 1]

      const projectData = config.projects[project]
      const fullName = projectData
        ? projectData.name
        : project
      const totalTime = punches.reduce(
        (sum, punch) =>
          sum + ((punch.out || Date.now()) - punch.in - (punch.rewind || 0)),
        0)
      const totalHours = (totalTime / 3600000)
      const totalPay = projectData && projectData.hourlyRate
        ? totalHours * projectData.hourlyRate
        : 0
      const hourlyRate = projectData && projectData.hourlyRate
        ? projectData.hourlyRate
        : 0

      summaries.push({
        fullName,
        totalTime,
        totalHours,
        totalPay,
        hourlyRate,
        firstPunch,
        latestPunch,
        totalPunches: punches.length,
      })
    }

    summaries
      .sort((a, b) => a.fullName > b.fullName) // Sort alphabetically
      .forEach(s => console.log(print.projectSummary(summaryfmt(s))))
  }
})

command({
  signature: 'log [*when]',
  description: 'show a summary of punches for a given period ("last month", "this week", "two days ago", etc)',
  options: [{
    signature: '--project, -p <name>',
    description: 'show only punches for this project'
  }],
  run: function(args) {
    const span = TimeSpan.fuzzyParse(args.when || 'today')

    if (span) {
      Logger(config, flags).forTimeSpan(span, args.options.project)
    }
  }
})

command({
  signature: 'today',
  description: 'show a summary of today\'s punches (alias of "punch log today")',
  hidden: true,
  run: function() {
    invoke('log today')
  }
})

command({
  signature: 'yesterday',
  description: 'show a summary of yesterday\'s punches (alias of "punch log yesterday")',
  hidden: true,
  run: function() {
    invoke('log yesterday')
  }
})

command({
  signature: 'week',
  description: 'show a summary of punches for the current week (alias of "punch log this week")',
  hidden: true,
  run: function() {
    invoke('log this week')
  }
})

command({
  signature: 'month',
  description: 'show a summary of punches for the current month (alias of "punch log this month")',
  hidden: true,
  run: function() {
    invoke('log this month')
  }
})

command({
  signature: 'invoice <project> <startDate> <endDate> <outputFile>',
  description: 'automatically generate an invoice using punch data',
  run: function(args) {
    const active = currentSession()

    if (active && active.project === args.project) {
      return console.log(`You're currently punched in on ${getLabelFor(active.project)}. Punch out before creating an invoice.`)
    }

    let { project, startDate, endDate, outputFile } = args
    const projectData = config.projects[project]
    if (!projectData) {
      console.log(`Can't invoice for ${chalk.red(project)} because your config file contains no information for that project.`)
      console.log(`You can run ${chalk.cyan('punch config')} to open your config file to add the project info.`)
      return
    }

    if (!projectData.hourlyRate) {
      let message = "Can't invoice for nothing!"

      console.log(`${getLabelFor(project)} has no hourlyRate set. ${getMessageFor('no_hourly_rate')}`)
      return
    }

    startDate = moment(startDate, 'MM-DD-YYYY').startOf('day')
    endDate = moment(endDate, 'MM-DD-YYYY').endOf('day')

    let format
    let ext = path.extname(outputFile)

    switch (ext.toLowerCase()) {
      case '.pdf':
        format = 'PDF'
        break
      case '.html':
        format = 'HTML'
        break
      case '.txt':
      case '.md':
        return console.log(`Exporting invoices as ${ext.toLowerCase()} is not yet supported. Use HTML or PDF.`)
      default:
        return console.log(`Can't export to file with an extension of ${ext}`)
    }

    let str = '\n'

    str += print.labelTable([
      { label: 'Project', value: projectData.name || project },
      { label: 'Start Date', value: startDate.format('dddd, MMM Do YYYY') },
      { label: 'End Date', value: endDate.format('dddd, MMM Do YYYY') },
      { label: 'Invoice Format', value: format },
      { label: 'Output To', value: resolvePath(outputFile) },
    ])
    console.log(str)

    let response

    if (confirm('Create invoice?')) {
      const sqlish = SQLish(config, flags)
      const invoicer = Invoicer(config, flags)

      const punches = sqlish.select()
        .from('punches')
        .where(p => p.project === project
                 && p.in >= startDate.valueOf()
                 && p.in <= endDate.valueOf())
        .run()

      const data = {
        startDate,
        endDate,
        punches,
        project: projectData,
        user: config.user,
        output: {
          path: resolvePath(outputFile),
        }
      }

      invoicer.create(data, format)
    }
  }
})

command({
  signature: 'sync',
  description: 'synchronize with any providers in your config file',
  run: function() {
    Syncer(config, flags).sync()
  }
})

command({
  signature: 'config [editor]',
  description: 'open config file in editor - uses EDITOR env var unless an editor command is specified.',
  run: function(args) {
    const editor = args.editor || process.env.EDITOR

    if (!editor) {
      return console.log(format.text('No editor specified and no EDITOR variable available. Please specify an editor to use: punch config <editor>', ['red']))
    }

    const spawn = require('child_process').spawn
    const configPath = config.configPath

    console.log(editor, configPath)

    const child = spawn(editor, [configPath], { stdio: 'inherit' })
  }
})

command({
  signature: 'edit [date] [editor]',
  description: 'edit punchfile for the given date - uses EDITOR env var unless and editor command is specified',
  hidden: true,
  run: function(args) {
    const editor = args.editor || process.env.EDITOR
    const date = moment(args.date || moment(), 'MM/DD/YYYY').startOf('day')
    const fs = require('fs')

    if (!editor) {
      return console.log(format.text('No editor specified and no EDITOR variable available.\nPlease specify an editor to use: punch edit <date> <editor>', ['red']))
    }

    const y = date.year()
    const m = date.month() + 1
    const d = date.date()

    const filename = 'punch_' + y + '_' + m + '_' + d + '.json';
    const file = path.join(config.punchPath, filename)

    if (!fs.existsSync(file)) {
      console.warn(format.text('File doesn\'t exist.', ['red']))
    }

    const spawn = require('child_process').spawn
    const child = spawn(editor, [file], { stdio: 'inherit' })
  }
})

command({
  signature: 'timestamp <time>',
  description: 'get a millisecond timestamp for a given time (mm/dd/yyyy@hh:mm:ss)',
  hidden: true,
  run: function(args) {
    const date = moment(args.time, 'MM/DD/YYYY@hh:mm:ssa')
    console.log(date.valueOf() + format.text(' << ', ['grey']) + date.format('MMM Do YYYY, hh:mm:ssa'))
  }
})

command({
  signature: 'migrate <to>',
  description: 'migrate any punchfiles with older schemas than the specified version to the specified version',
  hidden: true,
  arguments: [{
    name: 'to',
    description: 'target schema version number',
    parse: val => parseInt(val)
  }],
  run: function(args) {
    const version = parseInt(args.to)
    const fs = require('fs')
    const path = require('path')
    const migrator = require('./utils/migrator')
    const dir = fs.readdirSync(config.punchPath)

    dir.forEach(fileName => {
      const filePath = path.join(config.punchPath, fileName)
      let file

      try {
        file = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      } catch (err) {
        console.log('Failed to read file as JSON: ' + filePath)
        return
      }

      const fileVersion = migrator.getPunchfileVersion(file)
      const migrated = migrator.migrate(fileVersion, version, file)

      migrated.updated = Date.now()

      fs.writeFileSync(filePath, JSON.stringify(migrated, null, 2))
      console.log(`Converted ${fileName} from version ${fileVersion} to version ${Math.max(fileVersion, version)}`)
    })
  }
})

run(ARGS.filter(a => a[0] !== '-'))
