const config = require("../config").current();
const moment = require("moment-timezone");
const chalk = require("chalk");
const formatDuration = require("./duration");
const wordWrap = require("@fardog/wordwrap")(0, 80, {
  lengthFn: require("../utils/print-length.js"),
});
const makeColorizer = require("../utils/make-project-colorizer");

/**
 *
 */
module.exports = class PunchFormatter {
  constructor(punch, { date, newline = "\n" } = {}) {
    date = date || punch.in;

    this._punch = punch;
    this._newline = newline;

    this._timespan = {
      start: moment(date).startOf("day").toDate(),
      end: moment(date).endOf("day").toDate(),
    };

    this._maxTimeLength = moment(new Date(2000, 11, 15, 12, 0, 0)).format(
      config.display.timeFormat
    ).length;
  }

  /**
   * Prints a header with summary information.
   *
   * @example
   * new PunchFormatter(punch).header()
   * // 10:30 AM -  1:34 PM   26m [Punch]
   */
  header() {
    const punch = this._punch;
    const timespan = this._timespan;
    const newline = this._newline;
    const maxTimeLength = this._maxTimeLength;

    let str = "";
    let start;
    let end;
    let carryForward = 0;
    let carryBack = 0;

    const dateStart = timespan.start;
    const dateEnd = timespan.end;

    let out = punch.out || new Date();

    if (punch.in < dateStart) {
      carryBack = dateStart.getTime() - punch.in.getTime();
      start = dateStart;
    } else {
      start = punch.in;
    }

    if (out > dateEnd) {
      carryForward = out.getTime() - dateEnd.getTime();
      end = dateEnd;
    } else {
      end = out;
    }

    const midnightString = moment(new Date(2020, 1, 1, 0, 0)).format(
      config.display.timeFormat
    );

    const carryOverValue = midnightString;

    let timeSpan = "";
    if (carryBack) {
      timeSpan += carryOverValue.padStart(maxTimeLength) + " - ";
    } else {
      timeSpan +=
        moment(start)
          .format(config.display.timeFormat)
          .padStart(maxTimeLength) + " - ";
    }
    if (punch.out) {
      if (carryForward) {
        timeSpan += carryOverValue.padStart(maxTimeLength);
      } else {
        timeSpan += moment(end)
          .format(config.display.timeFormat)
          .padStart(maxTimeLength);
      }
    } else {
      timeSpan += "NOW".padStart(maxTimeLength);
    }

    if (punch.out) {
      timeSpan = chalk.cyan(timeSpan);
    } else {
      timeSpan = chalk.bold.green(timeSpan);
    }

    const project = config.projects[punch.project];
    const projectName = project ? project.name : punch.project;
    const colorize = makeColorizer(project);

    const hours =
      punch.durationWithinInterval({ start: dateStart, end: dateEnd }) /
      3600000;

    let time;

    if (hours < 1) {
      time = `${~~(hours * 60)}m`;
    } else {
      time = `${hours.toFixed(1)}h`;
    }

    if (carryBack) {
      let s = "";
      let hrs =
        punch.durationWithinInterval({ start: punch.in, end: dateStart }) /
        3600000;

      s +=
        moment(punch.in)
          .format(config.display.timeFormat)
          .padStart(maxTimeLength) + " - ";
      s += carryOverValue.padEnd(maxTimeLength);
      if (hrs < 1) {
        s += `${~~(hrs * 60)}m`.padStart(6);
      } else {
        s += `${hrs.toFixed(1)}h`.padStart(6);
      }
      s += ` [${projectName}]`;
      s += " (yesterday)";
      str += chalk.grey(s) + newline;
    }

    str += timeSpan;
    str += chalk.blue(time.padStart(6));
    str += chalk.grey(" [") + colorize.bold(projectName) + chalk.grey("]");
    if (punch.rate) {
      str += chalk.grey(` ($${punch.pay().toFixed(2)})`);
    }
    str += newline;

    if (carryForward) {
      let s = "";
      let hrs =
        punch.durationWithinInterval({ start: dateEnd, end: out }) / 3600000;

      s += carryOverValue.padStart(maxTimeLength) + " - ";
      s += moment(out)
        .format(config.display.timeFormat)
        .padStart(maxTimeLength);
      if (hrs < 1) {
        s += `${~~(hrs * 60)}m`.padStart(6);
      } else {
        s += `${hrs.toFixed(1)}h`.padStart(6);
      }
      s += ` [${projectName}]`;
      s += " (tomorrow)";
      s += newline;
      str += chalk.grey(s);
    }

    if (config.display.showPunchIDs) {
      str += "   " + chalk.grey(`ID: ${punch.id}`) + newline;
    }

    return str;
  }

  _formatComment(previousTimestamp, comment, index, newline, style = "normal") {
    const punch = this._punch;
    const maxTimeLength = this._maxTimeLength;
    const symbols = config.symbols;

    let str = "";
    let line = "";
    let wrapPos = 1;

    switch (style) {
      case "add":
        line += chalk.green(`   + `);
        break;
      case "remove":
        line += chalk.red(`   - `);
        break;
      default:
        line += chalk.grey(`   ${symbols.logSessionBullet} `);
        break;
    }
    wrapPos += 5;

    if (config.display.showCommentIndices) {
      const label = `[${index}] `;
      line += chalk.bold(label);
      wrapPos += label.length;
    }

    if (
      config.display.showCommentTimestamps &&
      !config.display.commentRelativeTimestamps.enabled
    ) {
      let timestamp =
        moment(comment.timestamp).format(config.display.timeFormat) + ": ";
      line += timestamp;
      wrapPos += timestamp.length;
    }

    if (config.display.commentRelativeTimestamps.enabled) {
      let diff;

      if (config.display.commentRelativeTimestamps.fromPreviousComment) {
        diff =
          Math.min(punch.out || new Date(), comment.timestamp) -
          previousTimestamp;
      } else {
        diff = Math.min(punch.out || new Date(), comment.timestamp) - punch.in;
      }

      let timestamp = "+" + formatDuration(diff, { resolution: "m" }) + ":";

      // Align to the left accounting for the max width of the user's time format.
      const timeLength = maxTimeLength + 1;
      // if (timestamp.length < timeLength) timestamp = " " + timestamp;

      timestamp = timestamp.padStart(timeLength);

      line += timestamp;
      wrapPos += timestamp.length;
    }

    line = line.padEnd(25, " ");
    // wrapPos = 16;

    const text = wordWrap(comment.toString()).replace(
      "\n",
      "\n".padEnd(wrapPos + 1, " ")
    );

    switch (style) {
      case "add":
        line = chalk.green(line + text);
        break;
      case "remove":
        line = chalk.red(line + text);
        break;
      case "faded":
        line = chalk.cyan(line) + chalk.grey(text);
        break;
      default:
        line = chalk.cyan(line) + text;
        break;
    }

    str += line;

    return str;
  }

  comments({ withCurrentSession = false } = {}) {
    const { _formatComment, _newline } = this;

    let lastTimestamp = this._punch.in;

    const comments = this._punch.comments.map((comment, index) => {
      return {
        id: comment.id,
        format: ({ style } = {}) => {
          const formatted = _formatComment.call(
            this,
            lastTimestamp,
            comment,
            index,
            _newline,
            style
          );

          lastTimestamp = comment.timestamp;

          return formatted;
        },
      };
    });

    // Draw the currently active session as a special comment.
    if (withCurrentSession && this._punch.out == null) {
      comments.push({
        id: null,
        format: () => {
          const currentComment = this._formatComment.call(
            this,
            lastTimestamp,
            {
              timestamp: new Date(),
              toString() {
                return "(current session)";
              },
            },
            "?",
            "\n",
            "faded"
          );

          return currentComment;
        },
      });
    }

    return comments;
  }

  format() {
    return (
      this.header() +
      "\n" +
      this.comments().reduce(
        (str, comment) => str + comment.format() + "\n",
        ""
      )
    );
  }
};
