// Differential fuzz targets for ms. Each target draws inputs from the
// grader's seeded generator and calls the module under test.
const UNITS = [
  "years", "year", "yrs", "yr", "y",
  "weeks", "week", "w",
  "days", "day", "d",
  "hours", "hour", "hrs", "hr", "h",
  "minutes", "minute", "mins", "min", "m",
  "seconds", "second", "secs", "sec", "s",
  "milliseconds", "millisecond", "msecs", "msec", "ms",
]
const NOISE = ["months", "mo", "hz", "", "dayz", "µs", "ns", "sek", "min.", "H0urs"]

function casing(random, text) {
  return [...text].map((char) => (random.bool(0.3) ? char.toUpperCase() : char)).join("")
}

function numberText(random) {
  const sign = random.bool(0.25) ? "-" : ""
  const whole = random.bool(0.2) ? "" : String(random.int(0, random.pick([9, 99, 9999, 999999])))
  const decimals = random.bool(0.35) ? `.${random.int(0, 999)}` : ""
  return sign + (whole === "" && decimals === "" ? "0" : whole) + decimals
}

export default {
  targets: {
    parse: {
      count: 250,
      input(random) {
        const shape = random.int(0, 9)
        if (shape === 0) return random.string(" -.0123456789abcdhmswy+e", 1, 12)
        if (shape === 1) return "1".repeat(random.int(95, 105)) + "ms"
        if (shape === 2) return `${numberText(random)}${random.pick(NOISE)}`
        const spaces = " ".repeat(random.pick([0, 0, 1, 1, 2, 3]))
        const unit = random.bool(0.1) ? "" : casing(random, random.pick(UNITS))
        const lead = random.bool(0.05) ? " " : ""
        return `${lead}${numberText(random)}${unit ? spaces : ""}${unit}`
      },
      run: (api, input) => api.default(input),
    },
    format: {
      count: 250,
      input(random) {
        const scale = random.pick([1, 1000, 60_000, 3_600_000, 86_400_000, 604_800_000])
        const magnitude = random.pick([0, 0.4, 0.5, 1, 1.49, 1.5, 1.51, 2.5, 23.4, 59.6, 100.5, 1e3])
        const sign = random.bool(0.25) ? -1 : 1
        const value = random.bool(0.2) ? random.int(-2_000_000_000, 2_000_000_000) : sign * Math.round(scale * magnitude * random.float(0.9, 1.1) * 100) / 100
        const options = random.pick([undefined, {}, { long: true }, { long: false }, { long: 1 }])
        return { value, options }
      },
      run: (api, input) => api.default(input.value, input.options),
    },
    invalid: {
      count: 40,
      input(random) {
        return random.pick(["", undefined, null, [], {}, Number.NaN, Infinity, -Infinity, true, false, ["1m"], { long: true }, () => 1, 10n])
      },
      run: (api, input) => api.default(input),
    },
  },
}
