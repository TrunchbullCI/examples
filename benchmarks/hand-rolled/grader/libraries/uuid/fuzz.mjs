// Differential fuzz targets for uuid. Inputs come only from the grader's
// seeded generator. Generators always receive explicit random bytes (or an
// rng returning them) and timestamps, so the outputs are deterministic.
const DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
const URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
const NIL = "00000000-0000-0000-0000-000000000000"
const MAX = "ffffffff-ffff-ffff-ffff-ffffffffffff"
const GREGORIAN_OFFSET = 12219292800000
const NAMES = [
  "", "hello", "hello.example.com", "http://example.com/hello", "https://www.w3.org/", "Hello, World!",
  "a", " ", "user@example.com", "ñandú", "日本語", "😀 emoji", "tab\tnew\nline", "\u0000", "x".repeat(200),
]

function bytes(random, length) {
  return Uint8Array.from({ length }, () => random.int(0, 255))
}

function hex(random, length) {
  return random.string("0123456789abcdef", length, length)
}

function casing(random, text) {
  const shape = random.int(0, 5)
  if (shape === 0) return text.toUpperCase()
  if (shape === 1) return [...text].map((char) => (random.bool() ? char.toUpperCase() : char)).join("")
  return text
}

function uuidText(random) {
  const shape = random.int(0, 19)
  if (shape === 0) return casing(random, NIL)
  if (shape === 1) return casing(random, MAX)
  const version = random.pick("12345678")
  const variant = random.pick("89ab")
  return casing(random, `${hex(random, 8)}-${hex(random, 4)}-${version}${hex(random, 3)}-${variant}${hex(random, 3)}-${hex(random, 12)}`)
}

function invalidText(random) {
  const valid = uuidText(random)
  const shape = random.int(0, 11)
  if (shape === 0) return valid.slice(0, 14) + random.pick("09abcdef") + valid.slice(15)
  if (shape === 1) return valid.slice(0, 19) + random.pick("01234567cdef") + valid.slice(20)
  if (shape === 2) return valid.replace(/-/g, "")
  if (shape === 3) return valid + random.pick([" ", "\n", "0", "-"])
  if (shape === 4) return random.pick([" ", "{", "urn:uuid:"]) + valid
  if (shape === 5) return valid.slice(0, random.int(0, 35))
  if (shape === 6) {
    const index = random.pick([0, 9, 20, 35])
    return valid.slice(0, index) + random.pick("gxz_ ") + valid.slice(index + 1)
  }
  if (shape === 7) return valid.replace(/-/g, random.pick(["_", ":", " "]))
  if (shape === 8) {
    const index = random.pick([0, 5, 10, 20, 30, 35].filter((i) => ![8, 13, 14, 18, 23].includes(i)))
    return NIL.slice(0, index) + random.pick("1248") + NIL.slice(index + 1)
  }
  if (shape === 9) return random.pick(["", "invalid uuid", "zyxwvuts-rqpo-nmlk-jihg-fedcba000000", "00000000-0000-0000-0000-00000000000"])
  return random.string("0123456789abcdef-", 36, 36)
}

function nonString(random) {
  return random.pick([undefined, null, 0, 123, true, {}, [], new Date(0), /re/, new Uint8Array(16), new String(NIL), Symbol("uuid")])
}

function bigInteger(random, max) {
  return Math.min(max, random.int(0, Math.floor(max / 2 ** 32)) * 2 ** 32 + random.int(0, 2 ** 32 - 1))
}

function v1Msecs(random) {
  const shape = random.int(0, 9)
  if (shape === 0) return random.pick([0, -GREGORIAN_OFFSET, 1321645585614, 0x17f22e279b0, 0x133b891f705, 1320105600000])
  if (shape === 1) return random.int(-GREGORIAN_OFFSET, 0)
  if (shape === 2) return bigInteger(random, 2 ** 46)
  if (shape === 3) return 1321645585614 + random.int(-2, 2) * 429497
  return random.int(1_000_000_000_000, 4_102_444_800_000)
}

function target(random, sizes) {
  const shape = random.int(0, 9)
  if (shape <= 4) return {}
  const size = random.pick(sizes)
  const buffer = bytes(random, size)
  if (shape === 5) return { buffer }
  if (shape === 6) return { buffer, offset: 0 }
  if (shape <= 8) return { buffer, offset: random.int(0, size - 16) }
  return { buffer, offset: random.pick([-1, size - 15, size, 100]) }
}

function randomSource(random, options) {
  const length = random.bool(0.92) ? random.pick([16, 16, 16, 20]) : random.int(0, 15)
  const values = bytes(random, length)
  if (random.bool(0.7)) options.random = values
  else options.rng = () => values
}

function gregorianInput(random) {
  const options = { msecs: v1Msecs(random) }
  const explicit = random.int(0, 9) === 0
  if (explicit) {
    options.clockseq = random.int(0, 0x3fff)
    options.node = bytes(random, 6)
  } else {
    randomSource(random, options)
    if (random.bool(0.3)) options.clockseq = random.pick([0, 0x3fff, random.int(0, 0x3fff)])
    if (random.bool(0.3)) options.node = bytes(random, 6)
  }
  if (random.bool(0.5)) options.nsecs = random.pick([0, 9999, 4383, 4384, random.int(0, 9999)])
  return { options, ...target(random, [16, 32]) }
}

const callWithTarget = (fn, input) => (input.buffer ? fn(input.options, input.buffer, input.offset) : fn(input.options))

export default {
  targets: {
    v1: {
      count: 200,
      input: gregorianInput,
      run: (api, input) => callWithTarget(api.v1, input),
    },
    v6: {
      count: 150,
      input: gregorianInput,
      run: (api, input) => callWithTarget(api.v6, input),
    },
    v7: {
      count: 200,
      input(random) {
        const shape = random.int(0, 9)
        const msecs = shape === 0
          ? random.pick([0, 0x17f22e279b0, 2 ** 48 - 1, 1])
          : shape <= 3 ? bigInteger(random, 2 ** 48 - 1) : random.int(1_600_000_000_000, 2_000_000_000_000)
        const options = { msecs }
        randomSource(random, options)
        if (random.bool(0.5)) options.seq = random.pick([0, 0xffffffff, 0x6fffffff, 0x12345, random.int(0, 0xffffffff), random.int(0, 0xffffffff)])
        return { options, ...target(random, [16, 32]) }
      },
      run: (api, input) => callWithTarget(api.v7, input),
    },
    v4: {
      count: 150,
      input(random) {
        const options = {}
        randomSource(random, options)
        return { options, ...target(random, [16, 32]) }
      },
      run: (api, input) => callWithTarget(api.v4, input),
    },
    v35: {
      count: 250,
      input(random) {
        const version = random.pick([3, 5])
        const value = random.bool(0.75)
          ? random.bool(0.6) ? random.pick(NAMES) : random.string("abcdefghijklmnopqrstuvwxyz0123456789.-/:éß€ ", 0, 24)
          : bytes(random, random.int(0, 40))
        const shape = random.int(0, 19)
        let namespace
        if (shape <= 4) namespace = casing(random, DNS)
        else if (shape <= 7) namespace = casing(random, URL)
        else if (shape <= 12) namespace = uuidText(random)
        else if (shape <= 15) namespace = bytes(random, 16)
        else if (shape <= 17) namespace = invalidText(random)
        else if (shape === 18) namespace = bytes(random, random.pick([0, 15, 17, 32]))
        else namespace = undefined
        return { version, value, namespace, ...target(random, [16, 19, 32]) }
      },
      run(api, input) {
        const fn = input.version === 3 ? api.v3 : api.v5
        return input.buffer ? fn(input.value, input.namespace, input.buffer, input.offset) : fn(input.value, input.namespace)
      },
    },
    parse: {
      count: 200,
      input(random) {
        const shape = random.int(0, 19)
        if (shape <= 12) return uuidText(random)
        if (shape <= 18) return invalidText(random)
        return nonString(random)
      },
      run: (api, input) => api.parse(input),
    },
    stringify: {
      count: 200,
      input(random) {
        const length = random.pick([16, 16, 16, 17, 20, 32])
        const offset = random.bool(0.4) ? undefined : random.int(0, length - 16)
        const values = bytes(random, length)
        const start = offset ?? 0
        const shape = random.int(0, 19)
        if (shape <= 12) {
          values[start + 6] = (values[start + 6] & 0x0f) | (random.int(1, 8) << 4)
          values[start + 8] = (values[start + 8] & 0x3f) | 0x80
        } else if (shape <= 14) {
          values.fill(random.pick([0, 255]), start, start + 16)
        } else if (shape === 15) {
          return { values: bytes(random, random.int(0, 15)), offset }
        } else if (shape === 16) {
          return { values, offset: random.pick([length - 15, length, -1]) }
        }
        return { values, offset }
      },
      run: (api, input) => (input.offset === undefined ? api.stringify(input.values) : api.stringify(input.values, input.offset)),
    },
    validate: {
      count: 200,
      input(random) {
        const shape = random.int(0, 19)
        if (shape <= 8) return uuidText(random)
        if (shape <= 16) return invalidText(random)
        return nonString(random)
      },
      run: (api, input) => api.validate(input),
    },
    version: {
      count: 150,
      input(random) {
        const shape = random.int(0, 9)
        if (shape <= 5) return uuidText(random)
        if (shape <= 8) return invalidText(random)
        return nonString(random)
      },
      run: (api, input) => api.version(input),
    },
    convert: {
      count: 150,
      input(random) {
        const direction = random.pick(["v1ToV6", "v6ToV1"])
        const shape = random.int(0, 19)
        if (shape <= 11) return { direction, value: uuidText(random) }
        if (shape <= 14) return { direction, value: invalidText(random) }
        return { direction, value: bytes(random, 16) }
      },
      run: (api, input) => api[input.direction](input.value),
    },
  },
}
