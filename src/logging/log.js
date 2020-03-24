const { descendingBy } = require("../utils/sort-factories");
const isSameDay = require("date-fns/isSameDay");
const addDays = require("date-fns/addDays");

/**
 * Summarize punch stats per project.
 *
 * @param {*} config
 * @param {*} punches
 * @param {*} interval
 */
function summarize(config, punches, interval) {
  const projects = {};

  for (let i = 0; i < punches.length; i++) {
    const punch = punches[i];
    const name = punch.project;
    const project = config.projects[name];

    if (!projects[name]) {
      projects[name] = {
        name: project ? project.name : name,
        pay: 0,
        time: 0,
        punches: []
      };
    }

    projects[name].pay += punch.payWithinInterval(interval);
    projects[name].time += punch.durationWithinInterval(interval);
    projects[name].punches.push(punch);
  }

  const projectArray = [];

  for (const alias in projects) {
    projectArray.push({
      alias,
      isPaid: !!(config.projects[alias] && config.projects[alias].hourlyRate),
      ...projects[alias]
    });
  }

  return projectArray.sort(descendingBy("time"));
}

module.exports = function Logger(config, Punch) {
  const messageFor = require("../utils/message-for");
  const printDay = require("./log-day");
  const printYear = require("./log-year");
  const printPeriod = require("./log-period");
  const heatmap = require("../utils/heatmap");

  return {
    async forInterval(interval, args = {}) {
      let { project, object, tag } = args;

      const now = Date.now();
      let punches;

      if (interval.unit === "week") {
        interval.start = addDays(interval.start, 1);
        interval.end = addDays(interval.end, 1);
      }

      if (interval.start > new Date()) {
        return console.log(messageFor("future-punch-log"));
      }

      punches = await Punch.select(p => {
        // Reject if start date is out of the interval's range
        if (!((p.out || now) >= interval.start && p.in <= interval.end)) {
          return false;
        }
        if (project && p.project !== project) {
          return false;
        }
        if (object && !p.hasCommentWithObject(object)) {
          return false;
        }
        if (tag && !p.hasCommentWithTag(tag)) {
          return false;
        }
        return true;
      });

      if (punches.length === 0) {
        // Figure out what to say if there are no results
        if (Object.keys(args).length > 0) {
          return console.log(messageFor("no-sessions-with-criteria"));
        } else {
          if (isSameDay(interval.start, new Date())) {
            return console.log(messageFor("no-sessions-today"));
          } else if (isSameDay(interval.start, addDays(new Date(), -1))) {
            return console.log(messageFor("no-sessions-yesterday"));
          } else {
            return console.log(messageFor("no-sessions"));
          }
        }
      }

      const logData = {
        config,
        punches,
        date: interval.start,
        project,
        summary: summarize(config, punches, interval),
        interval
      };

      switch (interval.unit) {
        case "year":
          // Shows a higher level summary
          printYear(logData, summarize);
          break;
        case "month":
          printPeriod(logData);
          // TODO: Print month heatmap.
          // const hmap = heatmap.month(interval.start, punches, config)
          // console.log(hmap + '\n')
          break;
        case "week":
          const { longestProjectName } = printPeriod(logData);
          const hmap = heatmap.week(punches, config, {
            labelPadding: longestProjectName + 3
          });
          console.log(hmap + "\n");
          break;
        case "day":
          await printDay(logData);
          break;
        default:
          // Catchall for custom intervals
          printPeriod(logData);
          break;
      }
    },
    _summarize: summarize
  };
};
