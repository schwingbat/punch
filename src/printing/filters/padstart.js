/**
 * Pads the beginning of a string with spaces (or other character)
 * to meet a minimum length.
 *
 * @param {string} value - An input string.
 * @param {number} length - Minimum length of the output string.
 * @param {string} char - Character to pad with. Defaults to space.
 */
module.exports = env => {
  env.addFilter("padstart", (value, length = 1, char = " ") => {
    while (value.length < length) {
      value = char + value;
    }

    return value;
  });
};
