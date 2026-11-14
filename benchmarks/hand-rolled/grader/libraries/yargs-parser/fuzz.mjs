// Differential fuzz targets for yargs-parser. Inputs are argv arrays (and
// some argv strings) built from option tokens, values and positionals, with
// parser options drawn from the keys the argv uses.
const LETTERS = ["a", "b", "c", "f", "n", "v", "x", "z"]
const WORDS = ["apple", "banana", "cat", "hello world", "x=y", "a/b", "", "null", "yes", "--literal", "'single'", '"double"', "tab\there"]
const NUMBERS = ["0", "1", "-1", "42", "3.14", ".5", "-.5", "-0.25", "1e3", "-2e-2", "0x1f", "010", "0.5", "+5", "9007199254740993", "12abc", "1.", "NaN", "Infinity"]
const PATHS = ["a/../b", "./x//y/", "/usr/local/../bin", "c", "../up/./down"]

function pick(random, items) {
  return random.pick(items)
}

function some(random, items, max) {
  const chosen = []
  for (let count = random.int(0, max); count > 0; count -= 1) {
    const item = pick(random, items)
    if (!chosen.includes(item)) chosen.push(item)
  }
  return chosen
}

function value(random) {
  const roll = random.next()
  if (roll < 0.45) return pick(random, WORDS)
  if (roll < 0.85) return pick(random, NUMBERS)
  return pick(random, ["true", "false", "-", "-5", "-x", "--y"])
}

// Builds one or more argv tokens for an option named key.
function optionTokens(random, key, negation = "no-") {
  const long = key.length > 1 || random.bool(0.3)
  const dash = long ? "--" : "-"
  const roll = random.next()
  if (roll < 0.3) return [dash + key]
  if (roll < 0.55) return [dash + key, value(random)]
  if (roll < 0.75) return [dash + key + "=" + value(random)]
  if (roll < 0.85) return ["--" + negation + key]
  if (roll < 0.92) return [dash + key, value(random), value(random)]
  return [dash + key, pick(random, ["true", "false"])]
}

function shortGroup(random) {
  const letters = some(random, LETTERS, 4).join("") || "a"
  const roll = random.next()
  if (roll < 0.4) return ["-" + letters]
  if (roll < 0.6) return ["-" + letters + pick(random, ["5", "12", "-3", "1.5", "=v", "=", "/path", "-", ".x"])]
  if (roll < 0.8) return ["-" + letters, value(random)]
  return ["-" + letters + "=" + value(random)]
}

function argvFor(random, keys, extra = () => null) {
  const args = []
  for (let count = random.int(0, 9); count > 0; count -= 1) {
    const roll = random.next()
    const special = extra(random)
    if (special) args.push(...special)
    else if (roll < 0.5) args.push(...optionTokens(random, pick(random, keys)))
    else if (roll < 0.65) args.push(...shortGroup(random))
    else if (roll < 0.85) args.push(value(random))
    else args.push(pick(random, ["--", "-", "---", "---x", "--=x", "-0", "-9"]))
  }
  if (random.bool(0.05)) args.push(random.int(0, 9), random.bool(0.5))
  return args
}

function aliasOption(random, keys) {
  const alias = {}
  for (const key of some(random, keys, 3)) {
    const others = some(random, keys.concat(["alias-one", "aliasTwo", "k"]), 2).filter((other) => other !== key)
    if (others.length) alias[key] = others.length === 1 && random.bool(0.5) ? others[0] : others
  }
  return alias
}

function defaultOption(random, keys) {
  const defaults = {}
  for (const key of some(random, keys, 3)) {
    defaults[key] = pick(random, [true, false, 0, 7, "text", "", null, undefined, [], ["x", 1], { nested: true }])
  }
  return defaults
}

function maybe(random, probability, make) {
  return random.bool(probability) ? make() : undefined
}

function clean(options) {
  for (const key of Object.keys(options)) if (options[key] === undefined) delete options[key]
  return options
}

const COERCIONS = [
  (input) => (Array.isArray(input) ? input.length : typeof input),
  (input) => String(input).toUpperCase(),
  (input) => ({ wrapped: input }),
  (input) => Number(input) * 2,
  () => {
    throw new Error("coerce failed")
  },
]

const CONFIG_FLAGS = [
  "boolean-negation",
  "camel-case-expansion",
  "dot-notation",
  "duplicate-arguments-array",
  "flatten-duplicate-arrays",
  "greedy-arrays",
  "halt-at-non-option",
  "nargs-eats-options",
  "parse-numbers",
  "parse-positional-numbers",
  "populate--",
  "set-placeholder-key",
  "short-option-groups",
  "strip-aliased",
  "strip-dashed",
  "unknown-options-as-args",
]

function configuration(random, flags, probability = 0.4) {
  if (!random.bool(probability)) return undefined
  const result = {}
  for (const flag of some(random, flags, 3)) result[flag] = flag === "negation-prefix" ? pick(random, ["no-", "not-", "quux", "without-"]) : random.bool(0.5)
  return result
}

// Every option and configuration flag of the documented subset.
function fullInput(random) {
  const keys = some(random, ["a", "b", "f", "n", "v", "foo", "bar", "foo-bar", "fooBar", "list", "x.y", "count", "__proto__", "toString"], 6)
  if (keys.length === 0) keys.push("foo")
  const arrayKeys = some(random, keys, 2)
  const options = clean({
    alias: maybe(random, 0.4, () => aliasOption(random, keys)),
    array: maybe(random, 0.3, () => (random.bool(0.6) ? arrayKeys : arrayKeys.map((key) => ({ key, [pick(random, ["boolean", "number", "string"])]: true })))),
    boolean: maybe(random, 0.4, () => some(random, keys, 2)),
    coerce: maybe(random, 0.15, () => Object.fromEntries(some(random, keys, 2).map((key) => [key, pick(random, COERCIONS)]))),
    count: maybe(random, 0.2, () => some(random, ["v", "count", "b"], 2)),
    default: maybe(random, 0.35, () => defaultOption(random, keys)),
    narg: maybe(random, 0.25, () => Object.fromEntries(some(random, keys, 2).map((key) => [key, pick(random, [0, 1, 2, 3, Number.NaN])]))),
    normalize: maybe(random, 0.2, () => ["path"]),
    number: maybe(random, 0.25, () => some(random, keys, 2)),
    string: maybe(random, 0.25, () => some(random, keys, 2)),
    configuration: configuration(random, [...CONFIG_FLAGS, "negation-prefix"], 0.5),
  })
  // A normalize key is given at most once, with a string: upstream's
  // normalize accessor throws when one is set twice or gets a non-string.
  let path = false
  const args = argvFor(random, keys, (r) => {
    if (!path && r.bool(0.12)) {
      path = true
      return r.bool(0.5) ? ["--path", pick(r, PATHS)] : ["--path=" + pick(r, PATHS)]
    }
    return r.bool(0.05) ? ["-vvv"] : null
  })
  return { args, options }
}

// Key order is not part of the contract (upstream tests compare with deep
// equality), so outputs are compared with object keys sorted.
function sortKeys(value, seen = new Map()) {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) return seen.get(value)
  if (Array.isArray(value)) {
    const copy = []
    seen.set(value, copy)
    for (const item of value) copy.push(sortKeys(item, seen))
    return copy
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return value
  const copy = prototype === null ? Object.create(null) : {}
  seen.set(value, copy)
  for (const key of Object.keys(value).sort()) {
    Object.defineProperty(copy, key, { value: sortKeys(value[key], seen), enumerable: true, writable: true, configurable: true })
  }
  return copy
}

const call = (api, input) => sortKeys(api.default(input.args, input.options))

export default {
  targets: {
    parse: {
      count: 280,
      input: fullInput,
      run: call,
    },
    stringInput: {
      count: 150,
      input(random) {
        const { args, options } = fullInput(random)
        const quoted = args.map((arg) => {
          const text = String(arg)
          if (random.bool(0.15)) return '"' + text + '"'
          if (random.bool(0.1)) return "'" + text.replace(/'/g, "") + "'"
          return text.replace(/["']/g, "")
        })
        const extra = random.bool(0.3) ? ' --quoted "a b  c" --single=' + "'x y'" : ""
        return { args: "  " + quoted.join(" ".repeat(random.int(1, 2))) + extra + " ", options }
      },
      run: call,
    },
    detailed: {
      count: 150,
      input: fullInput,
      run(api, input) {
        const result = api.default.detailed(input.args, input.options)
        const aliases = Object.fromEntries(Object.entries(result.aliases).map(([key, list]) => [key, [...list].sort()]))
        return sortKeys({ argv: result.argv, error: result.error, aliases, newAliases: result.newAliases, defaulted: result.defaulted })
      },
    },
    helpers: {
      count: 150,
      input(random) {
        const helper = pick(random, ["camelCase", "decamelize", "looksLikeNumber"])
        if (helper === "looksLikeNumber") return { helper, args: [random.bool(0.1) ? pick(random, [null, undefined, 5, -0.5]) : random.bool(0.5) ? pick(random, NUMBERS) : random.string("0123456789.-+exX abf", 0, 6)] }
        const text = random.bool(0.4)
          ? pick(random, ["foo-bar", "--foo-bar", "FOO_BAR", "fooBar", "foo_bar-baz", "-a-b-", "NODE_ENV", "a", "Already", "x--y", "camel-Case", "ÀB-ç"])
          : random.string("abAB-_ xZ1", 0, 10)
        return { helper, args: helper === "decamelize" && random.bool(0.5) ? [text, pick(random, ["_", ".", "--"])] : [text] }
      },
      run: (api, input) => api.default[input.helper](...input.args),
    },
    dotNotation: {
      count: 220,
      input(random) {
        const keys = some(random, ["a.b", "a.b.c", "foo.bar", "foo.bar-baz", "x.y", "a", "foo", "x", "__proto__.p", "a.__proto__", "toString.x"], 5)
        if (keys.length === 0) keys.push("a.b")
        const heads = [...new Set(keys.map((key) => key.split(".")[0]))]
        const options = clean({
          alias: maybe(random, 0.4, () => aliasOption(random, keys.concat(heads))),
          default: maybe(random, 0.35, () => defaultOption(random, keys)),
          boolean: maybe(random, 0.2, () => some(random, keys, 2)),
          number: maybe(random, 0.15, () => some(random, keys, 2)),
          string: maybe(random, 0.2, () => some(random, keys, 2)),
          configuration: maybe(random, 0.3, () => ({ "dot-notation": random.bool(0.5) })),
        })
        const args = argvFor(random, keys, (r) => (r.bool(0.15) ? ["-" + pick(r, ["x.y", "a.b", "f.g.h"]) + pick(r, ["", "=3", "=v w"]), value(r)] : null))
        return { args, options }
      },
      run: call,
    },
    booleans: {
      count: 220,
      input(random) {
        const keys = some(random, ["a", "b", "v", "0", "flag", "dry-run", "dryRun", "no-cache", "force", "my-long-flag", "verbose"], 5)
        if (keys.length === 0) keys.push("flag")
        const prefix = random.bool(0.2) ? pick(random, ["not-", "quux", "without-"]) : "no-"
        const options = clean({
          alias: maybe(random, 0.4, () => aliasOption(random, keys)),
          boolean: maybe(random, 0.7, () => some(random, keys, 3)),
          default: maybe(random, 0.35, () => defaultOption(random, keys)),
          string: maybe(random, 0.1, () => some(random, keys, 1)),
          number: maybe(random, 0.1, () => some(random, keys, 1)),
          configuration: maybe(random, 0.45, () =>
            clean({
              "boolean-negation": maybe(random, 0.5, () => random.bool(0.5)),
              "camel-case-expansion": maybe(random, 0.5, () => random.bool(0.5)),
              "negation-prefix": prefix === "no-" ? undefined : prefix,
            })
          ),
        })
        const args = argvFor(random, keys, (r) => (r.bool(0.25) ? optionTokens(r, pick(r, keys), prefix) : null))
        return { args, options }
      },
      run: call,
    },
    arrays: {
      count: 240,
      input(random) {
        const keys = some(random, ["a", "f", "x", "foo", "bar", "list", "my-list", "myList", "1", "items"], 5)
        if (keys.length === 0) keys.push("list")
        const arrayKeys = some(random, keys, 3)
        const options = clean({
          array: maybe(random, 0.7, () => (random.bool(0.6) ? arrayKeys : arrayKeys.map((key) => (random.bool(0.3) ? { key } : { key, [pick(random, ["boolean", "number", "string"])]: true })))),
          narg: maybe(random, 0.4, () => Object.fromEntries(some(random, keys, 2).map((key) => [key, pick(random, [0, 1, 2, 3, Number.NaN])]))),
          alias: maybe(random, 0.25, () => aliasOption(random, keys)),
          default: maybe(random, 0.25, () => defaultOption(random, keys)),
          boolean: maybe(random, 0.15, () => some(random, keys, 1)),
          number: maybe(random, 0.15, () => some(random, keys, 1)),
          string: maybe(random, 0.1, () => some(random, keys, 1)),
          configuration: configuration(random, ["duplicate-arguments-array", "flatten-duplicate-arrays", "greedy-arrays", "nargs-eats-options"], 0.5),
        })
        const args = argvFor(random, keys, (r) => (r.bool(0.3) ? optionTokens(r, pick(r, keys)).concat(r.bool(0.5) ? [value(r), value(r)] : []) : null))
        return { args, options }
      },
      run(api, input) {
        const result = api.default.detailed(input.args, input.options)
        return sortKeys({ argv: result.argv, error: result.error })
      },
    },
  },
}
