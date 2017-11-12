#!/usr/bin/env node

const readline = require('readline-sync');
const moment = require('moment');
const path = require('path');
const flags = require('./flags');

// Process command line args into params/flags

const params = [];

process.argv.slice(2).forEach(arg => {
  if (arg[0] === '-') {
    switch (arg.toLowerCase()) {
    case '-v':
    case '--verbose':
      flags.VERBOSE = true;
      break;
    }
  } else {
    params.push(arg);
  }
});

const command = params.shift();

if (flags.VERBOSE) {
  console.log({ command, params, flags });
}

const config = require('./files/config')();
const syncer = require('./sync/syncer')(config, flags);
const puncher = require('./files/puncher')(config, flags);
const invoicer = require('./invoicing/invoicer')(config, flags);
const datefmt = require('./formatting/time');
const durationfmt = require('./formatting/duration');
const resolvePath = require('./utils/resolvepath');

const { autoSync } = config.sync;

if (command == null) {
  return cmdHelp();
}

/*=========================*\
||          Utils          ||
\*=========================*/

const getLabelFor = param => {
  const project = config.projects.find(p => p.alias === param);
  if (project) {
    return project.name;
  } else {
    return param;
  }
};

const getRateFor = proj => {
  const project = config.projects.find(p => p.alias === proj);
  if (project) {
    return project.hourlyRate;
  } else {
    return 0;
  }
}

const confirm = question => {
  let response;

  while (!['y', 'n', 'yes', 'no'].includes(response)) {
    response = readline.question(`${question} [y/n]`).toLowerCase().trim();

    if (response === 'y' || response === 'yes') {
      return true;
    } else if (response === 'n' || response === 'no') {
      return false;
    } else {
      console.log('Please enter: y, n, yes or no.');
    }
  }
}

/*=========================*\
||      Parse/Dispatch     ||
\*=========================*/

switch (command.toLowerCase()) {
case 'in':
  return cmdIn();
case 'out':
  return cmdOut();
case 'rewind':
  return cmdRewind();
case 'create':
  return cmdCreate();
case 'purge':
  return cmdPurge();
case 'current':
case 'time':
case 'now':
  return cmdNow();
case 'projects':
  return cmdProjects();
case 'today':
case 'yesterday':
  // 'today' and 'yesterday' are short for 'report today', etc.
  params.unshift(command);
case 'report':
  return cmdReport();
case 'invoice':
  // punch invoice [project] [start_date] [end_date] [output].pdf
  return cmdInvoice();
case 'sync':
  return cmdSync();
default:
  console.error(`Unrecognized command: ${command}`);
  return cmdHelp();
}

/*=========================*\
||         Commands        ||
\*=========================*/

async function cmdIn() {
  // Begin a session.
  const [project] = params;

  if (!project) {
    return console.log(`Can't punch in without a project name. Try: 'punch in [project]'`);
  }

  const current = puncher.currentSession();

  if (current) {
    const label = getLabelFor(current.project);
    return console.log(`You're already punched in on ${label}! Punch out first.`);
  } else {
    const time = datefmt.time(Date.now());
    const label = getLabelFor(project);
    puncher.punchIn(project);
    console.log(`Punched in on ${label} at ${time}.`);
    if (autoSync) {
      syncer.sync();
    }
  }
}

async function cmdOut() {
  // End a session.
  const current = puncher.currentSession();

  if (current) {
    const comment = params.join(' '); // Join the rest of the params into a sentence.
    const label = getLabelFor(current.project);
    const time = datefmt.time(Date.now());
    const duration = Date.now() - current.in;
    const pay = duration / 1000 / 60 / 60 * getRateFor(current.project);

    puncher.punchOut(comment);
    console.log(`Punched out on ${label} at ${time}. Worked for ${durationfmt(duration)} and earned \$${pay.toFixed(2)}.`);
    if (autoSync) {
      syncer.sync();
    }
  } else {
    console.log(`You're not punched in!`);
  }
}

function cmdRewind() {
  const current = puncher.currentSession();
  const [amount] = params;

  if (current) {
    puncher.rewind(amount);
    console.log(`Rewound by ${amount} on current ${getLabelFor(current.project)} session.`);
    if (autoSync) {
      syncer.sync();
    }
  } else {
    console.log('You\'re not currently punched in. Do you want to apply this rewind to the previous session?');
    console.log('[NOT IMPLEMENTED] Get user input (y/n)');
  }
}

function cmdCreate() {
  const [project, rawTimeIn, rawTimeOut, comment] = params;
  
  let timeIn, timeOut;
  try {
    timeIn = moment(rawTimeIn, 'MM-DD-YYYY@hh:mmA');
    timeOut = moment(rawTimeOut, 'MM-DD-YYYY@hh:mmA');
  } catch (err) {
    console.log('Please enter dates formatted as \'mm-dd-yyyy@hours:minutesAM\'');
  }

  if (!timeIn.isValid() || !timeOut.isValid()) {
    return console.log('Please enter dates formatted as \'mm-dd-yyyy@hours:minutesAM\'');
  }

  const proj = config.projects.find(p => p.alias === project);
  const duration = timeOut - timeIn;
  let pay;
  if (proj && proj.hourlyRate) {
    pay = '$' + (duration / 3600000 * proj.hourlyRate).toFixed(2);
  } else {
    pay = 'N/A';
  }

  let str = '';

  str += `   Project: ${getLabelFor(project)}\n`;
  str += `   Time In: ${timeIn.format('dddd, MMM Do YYYY [@] h:mma')}\n`;
  str += `  Time Out: ${timeOut.format('dddd, MMM Do YYYY [@] h:mma')}\n`;
  str += `  Duration: ${durationfmt(duration)}\n`;
  str += `       Pay: ${pay}\n`;

  if (comment) {
    str += `   Comment: ${comment}\n\n`;
  }

  str += '\nCreate this punch?';

  if (confirm(str)) {
    puncher.createPunch(project, timeIn.valueOf(), timeOut.valueOf(), comment);
    console.log('Punch created');
  } else {
    console.log('Punch not created');
  }
}

function cmdPurge() {
  const [project] = params;

  const { found, time, days } = puncher.purgeProject(project);
  const label = getLabelFor(project);

  if (found === 0) {
    return console.log(`Project '${label}' has no entries.`);
  }

  if (confirm(`Purge ${found} entries over ${days} days with a total time of ${durationfmt(time)} for project '${label}'?`)) {
    puncher.purgeProject(project, false);
    console.log(`Purged project ${label}`);
  } else {
    console.log('Your entries are safe.');
  }
}

function cmdNow() {
  const current = puncher.currentSession();
  if (current) {
    const duration = Date.now() - current.in;
    const pay = duration / 1000 / 60 / 60 * getRateFor(current.project);
    const punchedIn = datefmt.time(current.in);
    console.log(`You punched in on ${getLabelFor(current.project)} at ${punchedIn} and have been working for ${durationfmt(duration)} (\$${pay.toFixed(2)}).`);
  } else {
    console.log('No current session.');
  }
}

function cmdProjects() {
  console.log('[NOT IMPLEMENTED] List all projects from config file');
}

function cmdReport() {
  let when = (params.length === 0)
    ? 'today'
    : params.join(' ').toLowerCase();
  let date = new Date();

  switch (when) {
  case 'today':
    puncher.reportForDay(date);
    break;
  case 'yesterday':
    date.setDate(date.getDate() - 1);
    puncher.reportForDay(date);
    break;
  case 'last week':
  case 'week':
  case 'this week':
    console.log('Weekly report not implemented yet');
    break;
  case 'month':
  case 'this month':
    puncher.reportForMonth(date);
    break;
  case 'last month':
    date.setMonth(date.getMonth() - 1);
    puncher.reportForMonth(date);
    break;
  default:
    console.log(`Unknown time: ${when}`);
    break;
  }
}

function cmdInvoice() {
  // punch invoice project start_date end_date format output
  let [projectName, startDate, endDate, output] = params;
  const project = config.projects.find(p => p.alias === projectName);
  if (!project) {
    return console.log(`Can't invoice for '${alias}'. Make sure the project is in your config file.`);
  }

  projectName = project.name;
  startDate = moment(startDate, 'MM-DD-YYYY');
  endDate = moment(endDate, 'MM-DD-YYYY');
  
  let format;
  let ext = path.extname(output);

  switch (ext.toLowerCase()) {
    case '.pdf':
      format = 'PDF';
      break;
    case '.html':
      format = 'HTML';
      break;
    case '.txt':
      return console.log('Plaintext invoices are not yet supported. Use PDF.');
    default:
      return console.log(`Can't export to file with an extension of ${ext}`);
  }

  let str = '\n';
  
  str += `       Project: ${project.name || alias}\n`;
  str += `    Start Date: ${startDate.format('dddd, MMM Do YYYY')}\n`;
  str += `      End Date: ${endDate.format('dddd, MMM Do YYYY')}\n`;
  str += `Invoice Format: ${format}\n`;
  str += `     Output To: ${resolvePath(output)}\n`

  console.log(str);

  let response;
  
  if (confirm('Create invoice?')) {
    const data = {
      startDate,
      endDate,
      punches: puncher
        .getPunchesForPeriod(startDate.toDate(), endDate.toDate())
        .filter(p => p.project === project.alias),
      project,
      user: config.user,
      output: {
        path: resolvePath(output),
      }
    };

    invoicer
      .create(data, format);
  }
}

function cmdSync() {
  syncer.sync();
}

function cmdHelp() {
  console.log('[NOT IMPLEMENTED] Show help');
}