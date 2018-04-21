const Duration = require('./duration')

const milliseconds = (hours, minutes, seconds) => {
  return (seconds + (minutes * 60) + (hours * 60 * 60)) * 1000
}

describe('Duration', () => {
  describe('initialization', () => {
    it('initializes milliseconds to 0 if no value is given', () => {
      const duration = new Duration()
      expect(duration._ms).toBe(0)
    })

    it('initializes milliseconds to the given value', () => {
      const duration = new Duration(1000)
      expect(duration._ms).toBe(1000)
    })
  })

  describe('totalHours', () => {
    it('returns the total time in hours', () => {
      const duration = new Duration(milliseconds(14, 30, 0))
      expect(duration.totalHours()).toBe(14.5)
    })
  })

  describe('totalMinutes', () => {
    it('returns the total time in minutes', () => {

    })
  })

  describe('totalSeconds', () => {
    it('returns the total time in seconds', () => {

    })
  })

  describe('totalMilliseconds', () => {
    it('returns the total time in milliseconds', () => {

    })
  })

  describe('hours', () => {
    it('returns the hours component of the total time', () => {

    })
  })

  describe('minutes', () => {
    it('returns the minutes component of the total time', () => {

    })
  })

  describe('seconds', () => {
    it('returns the seconds component of the total time', () => {

    })
  })

  describe('milliseconds', () => {
    it('returns the milliseconds component of the total time', () => {
      
    })
  })

  describe('parse', () => {
    it('parses a duration string into a new duration', () => {
      const duration = Duration.parse('5h 27m 16s')
      expect(duration instanceof Duration).toBe(true)
      expect(duration._ms).toBe(milliseconds(5, 27, 16))
    })

    it('parses hours only', () => {
      const duration = Duration.parse('5h')
      expect(duration._ms).toBe(milliseconds(5, 0, 0))
    })

    it('parses minutes only', () => {
      const duration = Duration.parse('15m')
      expect(duration._ms).toBe(milliseconds(0, 15, 0))
    })

    it('parses seconds only', () => {
      const duration = Duration.parse('51s')
      expect(duration._ms).toBe(milliseconds(0, 0, 51))
    })
  })

  describe('toString', () => {
    it('formats milliseconds into a duration string', () => {
      let duration = new Duration(milliseconds(3, 30, 45))
      expect(duration.toString()).toBe('3h 30m 45s')
    })

    it('omits hours if less than one hour', () => {
      let duration = new Duration(milliseconds(0, 26, 15))
      expect(duration.toString()).toBe('26m 15s')
    })

    it('omits minutes if less than one minute', () => {
      let duration = new Duration(milliseconds(0, 0, 58))
      expect(duration.toString()).toBe('58s')
    })

    it('displays minutes even if minutes is 0 when longer than one hour', () => {
      let duration = new Duration(milliseconds(52, 0, 7))
      expect(duration.toString()).toBe('52h 0m 7s')
    })

    it('displays seconds even if seconds is 0 when longer than one minute', () => {
      let duration = new Duration(milliseconds(0, 16, 0))
      expect(duration.toString()).toBe('16m 0s')
    })

    it('uses long hour/minute/second labels when "long" option is passed', () => {
      let duration = new Duration(milliseconds(2, 13, 42))
      let duration2 = new Duration(milliseconds(4, 0, 0))
      expect(duration.toString({ long: true })).toBe('2 hours 13 minutes 42 seconds')
      expect(duration2.toString({ long: true })).toBe('4 hours 0 minutes 0 seconds')
    })
  })
})