// TODO: Figure out a better place for this stuff.
// A lot of this is printing specific

const allPunchedIn = async ({ config, Punch }) => {
  const names = Object.keys(config.projects);
  const punchedIn = [];

  for (let i = 0; i < names.length; i++) {
    if ((await Punch.current(names[i])).length > 0) {
      punchedIn.push(names[i]);
    }
  }

  return punchedIn;
};

const confirm = question => {
  let response;

  while (!["y", "n", "yes", "no"].includes(response)) {
    response = require("readline-sync")
      .question(`${question} [y/n] `)
      .toLowerCase()
      .trim();

    if (response === "y" || response === "yes") {
      return true;
    } else if (response === "n" || response === "no") {
      return false;
    } else {
      console.log("Please enter: y, n, yes or no.");
    }
  }
};

const confirmAdjustedTime = (config, date, template = "Set time to $?") => {
  const moment = require("moment-timezone");
  const { timeFormat, dateFormat } = config.display;

  const time = moment(date);

  let stringFmt = timeFormat;

  if (!time.isSame(new Date(), "day")) {
    stringFmt += ` on ${dateFormat}`;
  }

  return confirm(template.replace("$", time.format(stringFmt)));
};

module.exports = {
  allPunchedIn,
  confirm,
  confirmAdjustedTime
};
