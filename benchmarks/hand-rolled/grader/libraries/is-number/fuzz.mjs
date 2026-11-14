// Differential fuzz targets for is-number. Inputs come only from the
// grader's seeded generator.
const NUMBERS = [
  0, -0, 1, -1, 0.1, -0.1, 3.14, 1e21, -1e-7, 0xff, 5e3, 2 ** 53, -(2 ** 53) - 2,
  Number.MAX_VALUE, -Number.MAX_VALUE, Number.MIN_VALUE, Number.EPSILON,
  Math.PI, Math.E, NaN, Infinity, -Infinity, 0 / 0, 1 / 0,
]
const SPACES = [" ", "  ", "\t", "\n", "\r\n", "\v", "\f", "\u00a0", "\ufeff", "\u2003", "\u2028", "\u3000"]
const NOT_SPACES = ["\u200b", "\u180e", "_", "\u0000"]
const WORDS = [
  "", "abc", "3a", "a3", "true", "false", "null", "undefined", "NaN", "Infinity", "-Infinity", "+Infinity",
  "infinity", "1e400", "-1e400", "1n", "1_000", "1,000", "1.2.3", "--1", "+-1", "0x", "0xg", "-0x10", "+0x10",
  "0b102", "0o8", "1e", "e1", ".", "-.", "+", "-", "..1", "1..", "0x1p3", "١٢", "12px", "$5", "1 2", "١",
]

function numeral(random) {
  const shape = random.int(0, 9)
  const sign = random.pick(["", "", "", "-", "+"])
  if (shape === 0) return sign + "0x" + random.string("0123456789abcdefABCDEF", 1, 8)
  if (shape === 1) return "0b" + random.string("01", 1, 16)
  if (shape === 2) return random.pick(["0o", "0O"]) + random.string("01234567", 1, 8)
  if (shape === 3) return sign + random.string("0123456789", 1, 3) + random.pick(["e", "E"]) + random.pick(["", "+", "-"]) + random.int(0, 400)
  if (shape === 4) return sign + "." + random.string("0123456789", 1, 6)
  if (shape === 5) return sign + random.string("0123456789", 1, 6) + "."
  if (shape === 6) return sign + "0".repeat(random.int(1, 4)) + random.string("0123456789", 0, 4)
  if (shape === 7) return sign + random.string("0123456789", 1, 400 > random.int(0, 1000) ? 6 : 330)
  return sign + random.string("0123456789", 1, 8) + "." + random.string("0123456789", 1, 8)
}

function pad(random) {
  return random.bool(0.6) ? "" : random.array(1, 3, () => random.pick(SPACES)).join("")
}

export default {
  targets: {
    strings: {
      count: 300,
      input(random) {
        const shape = random.int(0, 9)
        if (shape === 0) return random.array(0, 4, () => random.pick(SPACES)).join("")
        if (shape === 1) return pad(random) + random.pick(WORDS) + pad(random)
        if (shape === 2) return random.string(" .-+eE0123456789xXabf", 1, 10)
        if (shape === 3) return numeral(random) + random.pick(NOT_SPACES)
        if (shape === 4) return random.pick(NOT_SPACES) + numeral(random)
        if (shape === 5) return String(random.pick(NUMBERS))
        return pad(random) + numeral(random) + pad(random)
      },
      run: (api, input) => api.default(input),
    },
    values: {
      count: 200,
      input(random) {
        const shape = random.int(0, 9)
        if (shape <= 3) return random.pick(NUMBERS)
        if (shape === 4) return random.int(-1e9, 1e9) / random.pick([1, 10, 1000, 7])
        if (shape === 5) return random.float(-1e300, 1e300) * random.pick([1, 1e10, 1e-300])
        return random.pick([
          null, undefined, true, false, 0n, 1n, [], [1], ["1"], [1, 2], {}, { valueOf: 1 },
          new Date(0), new Number(5), new String("5"), /1/, Symbol("1"), () => 1, new Map(), new Uint8Array([1]),
        ])
      },
      run: (api, input) => api.default(input),
    },
  },
}
