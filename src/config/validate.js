const is = require("@schwingbat/is");

const projectColors = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
];

is.define("hexColor", (value) => {
  return typeof value === "string" && /^#?[0-9A-F]{6}$/i.test(value);
});

is.define("projectColor", (value) => {
  return (
    typeof value === "string" &&
    (projectColors.includes(value.toLowerCase()) || is.hexColor(value))
  );
});

function makeError(message, key = null) {
  return {
    type: "error",
    key,
    message: key ? `[${key}] ${message}` : message,
  };
}

function makeWarning(message, key = null) {
  return {
    type: "warning",
    key,
    message: key ? `[${key}] ${message}` : message,
  };
}

function validateRequiredKeys(keys, obj, keyPrefix = null) {
  const errors = [];

  for (const key of keys) {
    if (!(key in obj)) {
      errors.push(
        makeError(`'${key}' is required but is not present.`, keyPrefix)
      );
    }
  }

  return errors;
}

/**
 * Prepend a/an to the type name based on its vowelosity.
 */
function a(typeName) {
  if (["a", "e", "i", "o", "u"].includes(typeName[0].toLowerCase())) {
    return `an ${typeName}`;
  } else {
    return `a ${typeName}`;
  }
}

/**
 * Validate a config file and return any errors found.
 */
module.exports = function (config) {
  const errors = [];

  errors.push(...validateRequiredKeys(["user", "projects"], config));

  if (errors.length === 0) {
    // Store clients and projects for later validation
    // because we need to cross-reference to make sure
    // projects do not reference a nonexistent client.
    let clients;
    let projects;

    for (const key in config) {
      switch (key) {
        case "user":
          errors.push(...validateUser(config[key]));
          break;
        case "clients":
          errors.push(...validateClients(config[key]));
          clients = config[key];
          break;
        case "projects":
          // Validate later once we have a clients reference.
          projects = config[key];
          break;
        case "sync":
          errors.push(...validateSync(config[key]));
          break;
        case "invoice":
          errors.push(...validateInvoice(config[key]));
          break;
        case "server":
          errors.push(...validateServer(config[key]));
          break;
        case "display":
          errors.push(...validateDisplay(config[key]));
          break;
        case "storageType":
          errors.push(...validateStorageType(config[key]));
          break;
        default:
          errors.push(makeWarning(`'${key}' is not a valid top level key.`));
          break;
      }
    }

    errors.push(...validateProjects(projects, clients));
  }

  return {
    valid: errors.filter((err) => err.type === "error").length === 0,
    errors,
  };
};

function validateUser(user) {
  const errors = [];

  errors.push(...validateRequiredKeys(["name"], user, "user"));

  const prefix = "user";

  for (const key in user) {
    const type = is.what(user[key]);

    switch (key) {
      case "name":
        if (type !== "string") {
          errors.push(
            makeError(`'${key}' must be a string but is ${a(type)}.`, prefix)
          );
        }
        break;
      case "company":
        if (type !== "string") {
          errors.push(
            makeError(`'${key}' must be a string but is ${a(type)}.`, prefix)
          );
        }
        break;
      case "address":
        if (type !== "string") {
          errors.push(
            makeError(`'${key}' must be a string but is ${a(type)}.`, prefix)
          );
        }
        break;
      default:
        errors.push(makeWarning(`'${key}' is not a valid key.`, prefix));
        break;
    }
  }

  return errors;
}

function validateClientObject(value, prefix) {
  const errors = [];

  for (const key in value) {
    const type = is.what(value[key]);

    switch (key) {
      case "contact":
        if (type !== "string") {
          errors.push(
            makeError(`'${key}' must be a string but is ${a(type)}.`, prefix)
          );
        }
        break;
      case "company":
        if (type !== "string") {
          errors.push(
            makeError(`'${key}' must be a string but is ${a(type)}.`, prefix)
          );
        }
        break;
      case "address":
        if (type !== "string") {
          errors.push(
            makeError(`'${key}' must be a string but is ${a(type)}.`, prefix)
          );
        }
        break;
      default:
        errors.push(makeWarning(`'${key}' is not a valid key.`, prefix));
        break;
    }
  }

  return errors;
}

function validateClients(clients) {
  const errors = [];

  if (!is.object(clients)) {
    errors.push(
      makeError(`'clients' must be an object but is ${a(is.what(clients))}.`)
    );
    return errors;
  }

  const keys = Object.keys(clients);

  for (let i = 0; i < keys.length; i++) {
    const value = clients[keys[i]];
    const valueType = is.what(value);

    if (valueType !== "object") {
      errors.push(
        makeError(
          `'${keys[i]}' must be an object but is ${a(valueType)}.`,
          "clients"
        )
      );
      continue;
    }

    const prefix = `clients.${keys[i]}`;

    errors.push(...validateClientObject(clients[keys[i]], prefix));
  }

  return errors;
}

function validateProjectInvoicePeriod(period, prefix) {
  const errors = [];

  errors.push(...validateRequiredKeys(["schedule"], period, prefix));

  if (errors.length === 0) {
    const schedules = ["monthly"];

    switch (period.schedule) {
      case "monthly":
        for (const key of ["endDate"]) {
          if (!(key in period)) {
            errors.push(
              makeError(
                `'${key}' must be present when schedule is '${period.schedule}'.`,
                prefix
              )
            );
          }
        }

        for (const key in period) {
          const type = is.what(period[key]);

          switch (key) {
            case "endDate":
              if (type === "string") {
                if (!["first", "last"].includes(period[key].toLowerCase())) {
                  errors.push(
                    makeError(
                      `'${key}' must be a date number, 'first', or 'last' but is '${period[key]}'.`,
                      prefix
                    )
                  );
                }
              } else if (type !== "number") {
                errors.push(
                  makeError(
                    `'${key}' must be a date number, 'first', or 'last' but is '${period[key]}'.`,
                    prefix
                  )
                );
              }
              break;
            case "schedule":
              break;
            default:
              errors.push(
                makeWarning(
                  `'${key}' is not a valid key when schedule is '${period.schedule}'.`,
                  prefix
                )
              );
          }
        }
        break;
      default:
        errors.push(
          makeError(
            `'schedule' must be one of (${schedules.join(", ")}) but is '${
              period.schedule
            }'.`,
            prefix
          )
        );
        break;
    }
  }

  return errors;
}

function validateProjects(projects, clients) {
  const errors = [];

  if (!is.object(projects)) {
    errors.push(
      makeError(`'projects' must be an object but is ${a(is.what(projects))}.`)
    );
    return errors;
  }

  const keys = Object.keys(projects);

  for (let i = 0; i < keys.length; i++) {
    const value = projects[keys[i]];
    const valueType = is.what(value);

    if (valueType !== "object") {
      errors.push(
        makeError(
          `'${keys[i]}' must be an object but is ${a(valueType)}.`,
          "projects"
        )
      );
      continue;
    }

    const prefix = `projects.${keys[i]}`;

    for (const key in value) {
      const type = is.what(value[key]);

      switch (key) {
        case "name":
          if (type !== "string") {
            errors.push(
              makeError(`'${key}' must be a string but is ${a(type)}.`, prefix)
            );
          }
          break;
        case "description":
          if (type !== "string") {
            errors.push(
              makeError(`'${key}' must be a string but is ${a(type)}.`, prefix)
            );
          }
          break;
        case "hourlyRate":
          if (type !== "number") {
            errors.push(
              makeError(`'${key}' must be a number but is ${a(type)}.`, prefix)
            );
          } else {
            if (!("client" in value)) {
              errors.push(
                makeWarning(
                  `'${key}' is set but the project has no client.`,
                  prefix
                )
              );
            }
          }
          break;
        case "color":
          if (type !== "string") {
            errors.push(
              makeError(`'${key}' must be a string but is ${a(type)}.`, prefix)
            );
          } else {
            if (!is.projectColor(value[key])) {
              const validColors = `${projectColors.join(", ")} or #hex value`;

              errors.push(
                makeError(
                  `'${key}' must be a valid color (${validColors}) but is '${value[key]}'.`,
                  prefix
                )
              );
            }
          }
          break;
        case "client":
          if (type === "string") {
            if (!(value[key] in clients)) {
              errors.push(
                makeError(
                  `'${key}' refers to a client that is not in the 'clients' section: '${value[key]}'.`,
                  prefix
                )
              );
            }
          } else if (type === "object") {
            errors.push(
              ...validateClientObject(value[key], `${prefix}.${key}`)
            );
          } else {
            errors.push(
              makeError(
                `'${key}' must be a string or object but is ${a(type)}.`,
                prefix
              )
            );
          }

          break;
        case "businessHours":
          if (type !== "array") {
            errors.push(
              makeError(`'${key}' must be an array but is ${a(type)}.`, prefix)
            );
          } else {
            if (value[key].length !== 2) {
              errors.push(
                makeError(
                  `'${key}' must have a length of 2 but has a length of ${value[key].length}.`,
                  prefix
                )
              );
            }

            if (!is.number(value[key][0])) {
              errors.push(
                makeError(
                  `'${key}[0]' must be a number but is ${a(
                    is.what(value[key][0])
                  )}.`,
                  prefix
                )
              );
            }

            if (!is.number(value[key][1])) {
              errors.push(
                makeError(
                  `'${key}[1]' must be a number but is ${a(
                    is.what(value[key][1])
                  )}.`,
                  prefix
                )
              );
            }
          }
          break;
        case "businessDays":
          if (type !== "array") {
            errors.push(
              makeError(`'${key}' must be an array but is ${a(type)}.`, prefix)
            );
          } else {
            const nums = [0, 1, 2, 3, 4, 5, 6];
            const strs = [
              "mon",
              "tue",
              "wed",
              "thu",
              "fri",
              "sat",
              "sun",
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
              "sunday",
            ];

            for (let v = 0; v < value[key].length; v++) {
              const val = value[key][v];
              const type = is.what(val);

              let isValid = true;

              switch (type) {
                case "string":
                  if (!strs.includes(val.toLowerCase())) {
                    isValid = false;
                  }
                  break;
                case "number":
                  if (!nums.includes(val)) {
                    isValid = false;
                  }
                  break;
                default:
                  isValid = false;
                  break;
              }

              if (!isValid) {
                errors.push(
                  makeError(
                    `'${key}[${v}]' must be one of (${nums.join(
                      ", "
                    )}) or (${strs.join(", ")}) but is '${val}'.`,
                    prefix
                  )
                );
              }
            }
          }
          break;
        case "invoicePeriod":
          if (type !== "object") {
            errors.push(
              makeError(`'${key}' must be an object but is ${a(type)}.`, prefix)
            );
          } else {
            errors.push(
              ...validateProjectInvoicePeriod(
                value[key],
                prefix + ".invoicePeriod"
              )
            );
          }
          break;
        case "targetHours":
          if (type !== "number") {
            errors.push(
              makeError(`'${key}' must be a number but is ${a(type)}.`, prefix)
            );
          }
          break;
        default:
          errors.push(makeWarning(`'${key}' is not a valid key.`, prefix));
          break;
      }
    }
  }

  return errors;
}

function validateSyncService(service, prefix) {
  const errors = [];

  errors.push(...validateRequiredKeys(["type"], service, prefix));

  if (!is.string(service.type)) {
  }

  if (errors.length === 0) {
    const serviceType = service.type.toLowerCase();

    switch (serviceType) {
      case "s3":
        for (const key in service) {
          const type = is.what(service[key]);

          switch (key) {
            // Standard fields
            case "enabled":
              if (type !== "boolean") {
                errors.push(
                  makeError(
                    `'${key}' must be a boolean but is ${a(type)}.`,
                    prefix
                  )
                );
              }
              break;
            case "name":
              if (type !== "string") {
                errors.push(
                  makeError(
                    `'${key}' must be a string but is ${a(type)}.`,
                    prefix
                  )
                );
              }
              break;
            case "type":
              break;

            // S3 fields
            case "bucket":
              if (type !== "string") {
                errors.push(
                  makeError(
                    `'${key}' must be a string but is ${a(type)}.`,
                    prefix
                  )
                );
              }
              break;
            case "region":
              if (type !== "string") {
                errors.push(
                  makeError(
                    `'${key}' must be a string but is ${a(type)}.`,
                    prefix
                  )
                );
              }
              break;
            case "credentials":
              if (type !== "string") {
                errors.push(
                  makeError(
                    `'${key}' must be a string but is ${a(type)}.`,
                    prefix
                  )
                );
              }
              break;

            default:
              errors.push(
                makeWarning(
                  `'${key}' is not a valid key when 'type' is '${service.type}'.`,
                  prefix
                )
              );
              break;
          }
        }
        break;

      case "punch-remote":
        for (const key in service) {
          const type = is.what(service[key]);

          switch (key) {
            // Standard fields
            case "enabled":
              if (type !== "boolean") {
                errors.push(
                  makeError(
                    `'${key}' must be a boolean but is ${a(type)}.`,
                    prefix
                  )
                );
              }
              break;
            case "name":
              if (type !== "string") {
                errors.push(
                  makeError(
                    `'${key}' must be a string but is ${a(type)}.`,
                    prefix
                  )
                );
              }
              break;
            case "type":
              break;

            // punch-remote fields
            case "url":
              if (type !== "string") {
                errors.push(
                  makeError(
                    `'${key}' must be a string but is ${a(type)}.`,
                    prefix
                  )
                );
              }
              break;
            case "credentials":
              if (type !== "string") {
                errors.push(
                  makeError(
                    `'${key}' must be a string but is ${a(type)}.`,
                    prefix
                  )
                );
              }
              break;

            default:
              errors.push(
                makeWarning(
                  `'${key}' is not a valid key when 'type' is '${service.type}'.`,
                  prefix
                )
              );
              break;
          }
        }
        break;

      default:
        errors.push(
          `'type' must be one of (s3, punch-remote) but is '${serviceType}'.`,
          prefix
        );
        break;
    }
  }

  return errors;
}

function validateSync(sync) {
  const errors = [];

  for (const key in sync) {
    const prefix = `sync`;
    const type = is.what(sync[key]);

    switch (key) {
      case "autoSync":
        if (type !== "boolean") {
          errors.push(
            makeError(`'${key}' must be a boolean but is ${a(type)}.`, prefix)
          );
        }
        break;
      case "services":
        if (type !== "array") {
          errors.push(
            makeError(`'${key}' must be an array but is ${a(type)}.`, prefix)
          );
        } else {
          for (let i = 0; i < sync[key].length; i++) {
            const p = `${prefix}.${key}[${i}]`;
            const v = sync[key][i];

            errors.push(...validateSyncService(v, p));
          }
        }
        break;
      default:
        errors.push(makeWarning(`'${key}' is not a valid key.`, prefix));
        break;
    }
  }

  return errors;
}

function validateInvoice(invoice) {
  const errors = [];

  for (const key in invoice) {
    const prefix = `invoice`;
    const type = is.what(invoice[key]);

    switch (key) {
      case "dateFormat":
        if (type !== "string") {
          errors.push(
            makeError(`'${key}' must be a string but is ${a(type)}.`, prefix)
          );
        }
        break;
      case "timeFormat":
        if (type !== "string") {
          errors.push(
            makeError(`'${key}' must be a string but is ${a(type)}.`, prefix)
          );
        }
        break;
      default:
        errors.push(makeWarning(`'${key}' is not a valid key.`, prefix));
        break;
    }
  }

  return errors;
}

function validateServer(server) {
  const errors = [];

  for (const key in server) {
    const prefix = `server`;
    const type = is.what(server[key]);

    switch (key) {
      case "auth":
        if (type !== "object") {
          errors.push(
            makeError(`'${key}' must be an object but is ${a(type)}.`, prefix)
          );
        } else {
          for (const k in server[key]) {
            const p = `${prefix}.${key}`;
            const v = server[key][k];
            const t = is.what(v);

            switch (k) {
              case "authTokens":
                if (t !== "array") {
                  errors.push(
                    makeError(`'${k}' must be an array but is ${a(t)}.`, p)
                  );
                } else {
                  for (let ti = 0; ti < v.length; ti++) {
                    const token = v[ti];

                    if (!is.string(token)) {
                      errors.push(
                        makeError(
                          `'${k}[${ti}]' must be a string but is ${a(
                            is.what(token)
                          )}.`,
                          p
                        )
                      );
                    }
                  }
                }
                break;
              case "passwordHash":
                if (t !== "string") {
                  errors.push(
                    makeError(`'${k}' must be a string but is ${a(t)}.`),
                    p
                  );
                }
                break;
              default:
                errors.push(makeWarning(`'${k}' is not a valid key.`, p));
                break;
            }
          }
        }
        break;
      default:
        errors.push(makeWarning(`'${key}' is not a valid key.`, prefix));
        break;
    }
  }

  return errors;
}

function validateDisplay(display) {
  const errors = [];

  for (const key in display) {
    const prefix = `display`;
    const type = is.what(display[key]);

    switch (key) {
      case "commentRelativeTimestamps":
        if (type !== "object") {
          errors.push(
            makeError(`'${key}' must be an object but is ${a(type)}.`, prefix)
          );
        } else {
          for (const k in display[key]) {
            const p = `${prefix}.${key}`;
            const v = display[key][k];
            const t = is.what(v);

            switch (k) {
              case "enabled":
                if (t !== "boolean") {
                  errors.push(
                    makeError(`'${k}' must be a boolean but is ${a(t)}.`, p)
                  );
                }
                break;
              case "fromPreviousComment":
                if (t !== "boolean") {
                  errors.push(
                    makeError(`'${k}' must be a boolean but is ${a(t)}.`, p)
                  );
                }
                break;
              default:
                errors.push(makeWarning(`'${k}' is not a valid key.`, p));
                break;
            }
          }
        }
        break;
      case "dateFormat":
        if (type !== "string") {
          errors.push(
            makeError(`'${key}' must be a string but is ${a(type)}.`, prefix)
          );
        }
        break;
      case "timeFormat":
        if (type !== "string") {
          errors.push(
            makeError(`'${key}' must be a string but is ${a(type)}.`, prefix)
          );
        }
        break;
      case "timeZone":
        if (type !== "string") {
          errors.push(
            makeError(`'${key}' must be a string but is ${a(type)}.`, prefix)
          );
        }
        break;
      case "showCommentIndices":
        if (type !== "boolean") {
          errors.push(
            makeError(`'${key}' must be a boolean but is ${a(type)}.`, prefix)
          );
        }
        break;
      case "showDayGraphics":
        if (type !== "boolean") {
          errors.push(
            makeError(`'${key}' must be a boolean but is ${a(type)}.`, prefix)
          );
        }
        break;
      case "showPunchIDs":
        if (type !== "boolean") {
          errors.push(
            makeError(`'${key}' must be a boolean but is ${a(type)}.`, prefix)
          );
        }
        break;
      case "textColors":
        if (type !== "boolean") {
          errors.push(
            makeError(`'${key}' must be a boolean but is ${a(type)}.`, prefix)
          );
        }
        break;
      case "use24HourTime":
        if (type !== "boolean") {
          errors.push(
            makeError(`'${key}' must be a boolean but is ${a(type)}.`, prefix)
          );
        }
        break;
      case "wordWrapWidth":
        if (type !== "number") {
          errors.push(
            makeError(`'${key}' must be a number but is ${a(type)}.`, prefix)
          );
        } else {
          if (display[key] % 1 !== 0) {
            errors.push(
              makeError(
                `'${key}' must be an integer but is not evenly divisible by 1.`,
                prefix
              )
            );
          }
        }
        break;
      default:
        errors.push(makeWarning(`'${key}' is not a valid key.`, prefix));
        break;
    }
  }

  return errors;
}

function validateStorageType(storageType) {
  const storageTypes = ["ledger", "sqlite"];

  const errors = [];

  if (typeof storageType !== "string" || !storageTypes.includes(storageType)) {
    return errors.push(
      makeError(`'storageType' must be one of: ${storageTypes.join(", ")}`)
    );
  }

  return errors;
}
