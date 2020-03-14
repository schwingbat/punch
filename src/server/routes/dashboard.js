const route = require("express").Router();
const startOfDay = require("date-fns/startOfDay");
const endOfDay = require("date-fns/endOfDay");
const startOfWeek = require("date-fns/startOfWeek");
const startOfMonth = require("date-fns/startOfMonth");
const endOfMonth = require("date-fns/endOfMonth");
const endOfWeek = require("date-fns/endOfWeek");
const addMonths = require("date-fns/addMonths");
const addWeeks = require("date-fns/addWeeks");
const addDays = require("date-fns/addDays");
const differenceInDays = require("date-fns/differenceInDays");
const differenceInWeeks = require("date-fns/differenceInWeeks");
const { ascendingBy, descendingBy } = require("../../utils/sort-factories");

route.get("/", async function(req, res) {
  const { props } = req;
  const { config, Punch } = props;

  const currentPunches = await Punch.filter(punch => punch.out == null);

  const current = {
    any: currentPunches.length > 0,
    punches: currentPunches.map(punch => {
      return {
        ...punch,
        project: config.projects[punch.project]
      };
    })
  };

  const today = new Date();
  const yesterday = addDays(today, -1);
  const lastWeek = addWeeks(today, -1);
  const lastMonth = addMonths(today, -1);

  const weekOptions = {
    weekStartsOn: 1 // Start on Monday
  };

  const endOfThisWeek = endOfWeek(today, weekOptions);
  const thisWeekIntervalEnd = endOfThisWeek > today ? today : endOfThisWeek;

  const endOfThisMonth = endOfWeek(today, weekOptions);
  const thisMonthIntervalEnd = endOfThisMonth > today ? today : endOfThisMonth;

  const thisWeekInterval = {
    start: startOfWeek(today, weekOptions),
    end: thisWeekIntervalEnd
  };

  const lastWeekInterval = {
    start: startOfWeek(lastWeek, weekOptions),
    end: endOfWeek(lastWeek, weekOptions)
  };

  const thisMonthInterval = {
    start: startOfMonth(today),
    end: thisMonthIntervalEnd
  };

  const summaries = {
    today: await getDaySummary(today, props),
    yesterday: await getDaySummary(yesterday, props),
    thisWeek: await getWeekSummary(thisWeekInterval, props),
    lastWeek: await getWeekSummary(lastWeekInterval, props),
    thisMonth: await getMonthSummary(thisMonthInterval, props)
  };

  res.render("sections/dashboard/index", {
    current,
    summaries
  });
});

module.exports = route;

async function getDaySummary(date, { config, Punch }) {
  const interval = {
    start: startOfDay(date),
    end: endOfDay(date)
  };

  let duration = 0;
  let earnings = 0;

  const punches = await Punch.filter(
    p => p.durationWithinInterval(interval) > 0
  );

  for (const punch of punches) {
    duration += punch.durationWithinInterval(interval);
    earnings += punch.payWithinInterval(interval);
  }

  return {
    punches: punches.sort(ascendingBy("in")),
    duration,
    earnings,
    projects: getProjectsSummary(punches, interval, { config })
  };
}

async function getWeekSummary(interval, { config, Punch }) {
  const punches = await Punch.filter(
    p => p.durationWithinInterval(interval) > 0
  );

  let duration = 0;
  let earnings = 0;

  for (const punch of punches) {
    duration += punch.durationWithinInterval(interval);
    earnings += punch.payWithinInterval(interval);
  }

  const totalDays = differenceInDays(interval.end, interval.start);

  return {
    duration,
    earnings,
    projects: getProjectsSummary(punches, interval, { config }),
    dailyAverage: {
      duration: duration / totalDays,
      earnings: earnings / totalDays
    }
  };
}

async function getMonthSummary(interval, { config, Punch }) {
  const punches = await Punch.filter(
    p => p.durationWithinInterval(interval) > 0
  );

  let duration = 0;
  let earnings = 0;

  for (const punch of punches) {
    duration += punch.durationWithinInterval(interval);
    earnings += punch.payWithinInterval(interval);
  }

  const weeks = differenceInWeeks(interval.end, interval.start) || 1;

  return {
    duration,
    earnings,
    projects: getProjectsSummary(punches, interval, { config }),
    weeklyAverage: {
      duration: duration / weeks,
      earnings: earnings / weeks
    }
  };
}

function getProjectsSummary(punches, interval, { config }) {
  const { projects } = config;

  const totals = {
    duration: 0,
    earnings: 0
  };
  const byProject = {};

  for (const punch of punches) {
    if (!byProject[punch.project]) {
      byProject[punch.project] = {
        duration: 0,
        earnings: 0
      };
    }

    const duration = punch.durationWithinInterval(interval);
    const earnings = punch.payWithinInterval(interval);

    byProject[punch.project].duration += duration;
    byProject[punch.project].earnings += earnings;

    totals.duration += duration;
    totals.earnings += earnings;
  }

  const projectArray = [];

  for (const alias in byProject) {
    const { duration, earnings } = byProject[alias];
    const { name, color } = projects[alias];

    const percentage = (duration / totals.duration) * 100;

    projectArray.push({
      name,
      color: getFallbackColor(color, projects[alias]),
      duration,
      earnings,
      percentage
    });
  }

  return projectArray.sort(descendingBy("percentage"));
}

function getFallbackColor(color, project) {
  if (color) {
    return color;
  } else {
    // TODO: Generate consistent color based on project info.
    return "blue";
  }
}
