// Differential fuzz targets for clsx. Inputs come only from the grader's
// seeded generator.
const TOKENS = [
  "foo", "bar", "baz", "btn", "btn-primary", "text-sm", "md:flex", "-foo", "--bar", "a", "b", "c",
  "hello world", " x ", "  ", "\t", "é", "😀", "push", "pop", "length", "constructor", "toString", "0", "1", "10", "2",
]
const NUMBERS = [0, -0, 1, -1, 2, 12, 0.1, 0.5, -2.5, 1e21, 1e-7, NaN, Infinity, -Infinity]
const PROPERTY_VALUES = [true, false, 0, -0, 1, -1, "", " ", "x", null, undefined, NaN, Infinity, [], [0], {}, () => 0, 0n, 1n]

function token(random) {
  return random.bool(0.1) ? random.string("abcxyz-_:0123456789 ", 1, 8) : random.pick(TOKENS)
}

function scalar(random) {
  const shape = random.int(0, 9)
  if (shape <= 4) return token(random)
  if (shape <= 6) return random.pick(NUMBERS)
  return random.pick([true, false, null, undefined, "", () => "fn"])
}

function nested(random, depth, leaf) {
  return random.array(0, 4, () => (depth > 0 && random.bool(0.3) ? nested(random, depth - 1, leaf) : leaf(random)))
}

function dictionary(random) {
  const object = {}
  for (const key of random.array(0, 5, () => (random.bool(0.2) ? String(random.int(0, 20)) : token(random)))) {
    object[key] = random.pick(PROPERTY_VALUES)
  }
  const shape = random.int(0, 11)
  if (shape === 0) {
    const inherited = Object.create(object)
    inherited[token(random)] = random.pick(PROPERTY_VALUES)
    return inherited
  }
  if (shape === 1) return Object.assign(Object.create(null), object)
  return object
}

function exotic(random) {
  return random.pick([
    0n, 1n, Symbol("cls"), new Date(0), new Map([["a", 1]]), new Set(["a"]), new Number(1), new String("ab"),
    new Boolean(false), /re/, new (class Box { constructor() { this.box = 1 } })(),
  ])
}

function any(random, depth) {
  const shape = random.int(0, 9)
  if (shape <= 3) return scalar(random)
  if (shape <= 5) return dictionary(random)
  if (shape === 6) return exotic(random)
  return depth > 0 ? random.array(0, 4, () => any(random, depth - 1)) : scalar(random)
}

export default {
  targets: {
    arrays: {
      count: 200,
      input(random) {
        return random.array(0, 5, () => (random.bool(0.5) ? scalar(random) : nested(random, 3, scalar)))
      },
      run: (api, input) => api.default(...input),
    },
    objects: {
      count: 200,
      input(random) {
        return random.array(0, 5, () => (random.bool(0.6) ? dictionary(random) : random.pick([token(random), token(random), null, undefined, false, true, 0, ""])))
      },
      run: (api, input) => api.default(...input),
    },
    mixed: {
      count: 250,
      input(random) {
        return random.array(0, 6, () => any(random, 3))
      },
      run: (api, input) => api.clsx(...input),
    },
  },
}
