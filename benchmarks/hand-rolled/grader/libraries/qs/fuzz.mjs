// Differential fuzz targets for qs. Inputs come only from the grader's
// seeded generator; the custom decoders, encoders, filters and sorters
// below are fixed, deterministic functions picked by that generator.
const NAMES = ["a", "b", "foo", "x y", "0", "1", "12", "é", "__proto__", "toString", "hasOwnProperty", "constructor", "length", "a.b", ""]
const WORDS = ["", "b", "c", "bar", "1", "0", "x y", "a,b", "a,b,c", ",", "true", "null", "é", "☺", "~*()!'", "a=b", "[]", "&#9786;", "&#10003;"]
const RAW_VALUES = ["", "b", "c+d", "a%20b", "%E2%98%BA", "%C3%A9", "%E9", "%", "%zz", "%u2603", "a,b", "1,2,3", "%2C", "a%2Cb,c", "%26%239786%3B", "&#9786;", "x=y", "[1]", "%5B%5D", "+"]

function pickWeighted(random, entries) {
  let total = 0
  for (const [weight] of entries) total += weight
  let roll = random.next() * total
  for (const [weight, value] of entries) {
    roll -= weight
    if (roll < 0) return value
  }
  return entries[entries.length - 1][1]
}

function segment(random, { dots, encoded, indexMax }) {
  const kind = random.int(0, 9)
  const open = encoded && random.bool(0.3) ? random.pick(["%5B", "%5b"]) : "["
  const close = encoded && random.bool(0.3) ? random.pick(["%5D", "%5d"]) : "]"
  if (kind <= 2) return open + random.pick(NAMES.filter(Boolean)) + close
  if (kind <= 4) return open + close
  if (kind <= 6) return open + random.int(0, indexMax) + close
  if (kind === 7 && dots) return "." + random.pick(["b", "c", "x", "0", "1"])
  if (kind === 7) return open + random.pick(["-1", "01", "1.5", " 1", "2x"]) + close
  if (kind === 8) return random.pick(["[", "]", "[[]", "[a[b]]", "[]]", "[a.b]", "%2E", "%252E", "]x", "[b]extra"])
  return open + random.pick(["b", "c"]) + close
}

function queryKey(random, options) {
  const base = random.bool(0.85) ? random.pick(NAMES) : random.pick(["[a]", "[]", "]", "[0]"])
  const depth = pickWeighted(random, [[3, 0], [4, 1], [3, 2], [2, 3], [1, random.int(4, 8)]])
  let key = base
  for (let index = 0; index < depth; index += 1) key += segment(random, options)
  return key
}

function queryString(random, { dots = true, encoded = true, indexMax = 25, rawValues = true, maxParams = 7, repeatKeys = 0.35 } = {}) {
  const count = pickWeighted(random, [[1, 0], [4, 1], [5, random.int(2, 4)], [3, random.int(5, maxParams)]])
  const keys = []
  const parts = []
  for (let index = 0; index < count; index += 1) {
    const key = keys.length && random.bool(repeatKeys) ? random.pick(keys) : queryKey(random, { dots, encoded, indexMax })
    keys.push(key)
    const shape = random.int(0, 9)
    if (shape === 0) parts.push(key)
    else if (shape === 1) parts.push(key + "=")
    else parts.push(key + "=" + (rawValues && random.bool(0.4) ? random.pick(RAW_VALUES) : encodeURIComponent(random.pick(WORDS)).replace(/%2C/g, random.bool(0.7) ? "," : "%2C")))
  }
  if (random.bool(0.05)) parts.push("")
  return parts.join("&")
}

const decoders = {
  upperValues: function upperValues(str, defaultDecoder, charset, type) {
    const decoded = defaultDecoder(str, defaultDecoder, charset)
    return type === "value" ? decoded.toUpperCase() : decoded
  },
  numbers: function numbers(str, defaultDecoder, charset) {
    if (str !== "" && !Number.isNaN(Number(str))) return Number(str)
    return defaultDecoder(str, defaultDecoder, charset)
  },
  nullKeyB: function nullKeyB(str, defaultDecoder, charset, type) {
    if (type === "key" && str === "b") return null
    return defaultDecoder(str, defaultDecoder, charset)
  },
  raw: function raw(str) {
    return str
  },
}

function parseOptions(random) {
  const options = {}
  const set = (name, value) => {
    options[name] = value
  }
  const pool = [
    () => set("allowDots", random.bool()),
    () => set("allowEmptyArrays", random.bool()),
    () => set("allowPrototypes", random.bool()),
    () => set("allowSparse", random.bool()),
    () => set("arrayLimit", random.pick([-1, 0, 1, 2, 3, 5, 20, 100])),
    () => set("charset", random.pick(["utf-8", "iso-8859-1"])),
    () => set("charsetSentinel", random.bool()),
    () => set("comma", random.bool()),
    () => set("decodeDotInKeys", random.bool()),
    () => set("decoder", decoders[random.pick(Object.keys(decoders))]),
    () => set("delimiter", random.pick(["&", ";", /[;&]/, ","])),
    () => set("depth", random.pick([0, 1, 2, 5, false, 10])),
    () => set("duplicates", random.pick(["combine", "first", "last"])),
    () => set("ignoreQueryPrefix", random.bool()),
    () => set("interpretNumericEntities", random.bool()),
    () => set("parameterLimit", random.pick([1, 2, 3, 1000, Infinity])),
    () => set("parseArrays", random.bool()),
    () => set("plainObjects", random.bool()),
    () => set("strictDepth", random.bool()),
    () => set("strictMerge", random.bool()),
    () => set("strictNullHandling", random.bool()),
    () => set("throwOnLimitExceeded", random.bool()),
  ]
  const count = pickWeighted(random, [[2, 0], [4, 1], [4, 2], [3, 3], [2, random.int(4, 7)]])
  for (let index = 0; index < count; index += 1) random.pick(pool)()
  if (options.decodeDotInKeys === true && options.allowDots === false) delete options.allowDots
  return options
}

function parseTarget(random) {
  const options = parseOptions(random)
  const roll = random.int(0, 19)
  if (roll === 0) return { str: random.pick(["", null, undefined]), options }
  if (roll === 2) return random.pick(INVALID.filter((item) => item.fn === "parse"))
  if (roll === 1) {
    const object = {}
    for (let index = random.int(1, 4); index > 0; index -= 1) object[queryKey(random, { dots: true, encoded: false, indexMax: 25 })] = random.pick(["x", "a,b", "", null, ["p", "q"], { n: "1" }])
    return { str: object, options }
  }
  let str = queryString(random)
  if (options.delimiter && options.delimiter !== "&") str = str.replace(/&/g, typeof options.delimiter === "string" ? options.delimiter : random.pick([";", "&"]))
  if (random.bool(0.15)) str = "?" + str
  if (options.charsetSentinel || random.bool(0.05)) str = random.pick(["utf8=%E2%9C%93&", "utf8=%26%2310003%3B&", "utf8=x&", ""]) + str
  return { str, options }
}

const DATE_A = new Date(Date.UTC(2020, 1, 29, 12, 30, 15, 7))
const DATE_B = new Date(0)
const STRINGS = ["", "b", "a b", "a+b", "é", "☺", "💩", "\uD83D", "\uDCA9x", "~*()!'", "a,b", "a.b", "[x]", "%", "&=?#", "line\nbreak", "ÿ", "Ā", "0"]

function scalar(random, { dates = true, bigints = true } = {}) {
  const kind = random.int(0, 15)
  if (kind <= 6) return random.pick(STRINGS)
  if (kind <= 8) return random.pick([0, 1, -1, 1.5, 1e21, NaN, Infinity, -0])
  if (kind === 9) return random.bool()
  if (kind === 10) return null
  if (kind === 11) return undefined
  if (kind === 12 && dates) return random.pick([DATE_A, DATE_B])
  if (kind === 13 && bigints) return random.pick([0n, 12345678901234567890n])
  return random.pick(STRINGS)
}

function value(random, depth, settings) {
  if (depth <= 0 || random.bool(0.45)) return scalar(random, settings)
  if (random.bool(0.5)) {
    const array = random.array(0, 4, () => value(random, depth - 1, settings))
    if (random.bool(0.08) && array.length > 0) delete array[0]
    return array
  }
  const object = {}
  for (let index = random.int(0, 3); index > 0; index -= 1) object[random.pick(["a", "b", "c d", "é", "x.y", "0", "1", "[k]"])] = value(random, depth - 1, settings)
  return object
}

function rootObject(random, settings) {
  const object = {}
  for (let index = random.int(0, 4); index > 0; index -= 1) object[random.pick(["a", "b", "c", "a b", "é", "a.b", "0", "", "~"])] = value(random, 3, settings)
  return object
}

const encoders = {
  upper: function upper(str, defaultEncoder, charset, type, format) {
    const encoded = defaultEncoder(str, defaultEncoder, charset, type, format)
    return type === "key" ? encoded.toUpperCase() : encoded
  },
  tagged: function tagged(str, defaultEncoder, charset, type) {
    return type + ":" + String(str).length
  },
}
const sorters = {
  alpha: function alpha(a, b) {
    return a < b ? -1 : a > b ? 1 : 0
  },
  reverse: function reverse(a, b) {
    return a < b ? 1 : a > b ? -1 : 0
  },
}
const filters = {
  dropB: function dropB(prefix, value) {
    return prefix === "b" ? undefined : value
  },
  stamp: function stamp(prefix, value) {
    return value instanceof Date ? value.getTime() : value
  },
}

function stringifyOptions(random) {
  const options = {}
  const set = (name, value) => {
    options[name] = value
  }
  const pool = [
    () => set("addQueryPrefix", random.bool()),
    () => set("allowDots", random.bool()),
    () => set("allowEmptyArrays", random.bool()),
    () => set("arrayFormat", random.pick(["indices", "brackets", "repeat", "comma"])),
    () => set("arrayFormat", random.pick(["indices", "brackets", "repeat", "comma"])),
    () => set("charset", random.pick(["utf-8", "iso-8859-1"])),
    () => set("charsetSentinel", random.bool()),
    () => set("commaRoundTrip", random.bool()),
    () => set("delimiter", random.pick(["&", ";"])),
    () => set("depth", random.pick([0, 1, 2, 5])),
    () => set("encode", random.bool()),
    () => set("encodeDotInKeys", random.bool()),
    () => set("encoder", encoders[random.pick(Object.keys(encoders))]),
    () => set("encodeValuesOnly", random.bool()),
    () => set("filter", random.bool() ? filters[random.pick(Object.keys(filters))] : random.pick([["a", "b"], ["a", 0, 1], ["c", "a"]])),
    () => set("format", random.pick(["RFC1738", "RFC3986", "WHATWG"])),
    () => set("indices", random.bool()),
    () => set("serializeDate", function serializeDate(date) {
      return String(date.getTime())
    }),
    () => set("skipNulls", random.bool()),
    () => set("sort", sorters[random.pick(Object.keys(sorters))]),
    () => set("strictNullHandling", random.bool()),
  ]
  const count = pickWeighted(random, [[2, 0], [4, 1], [4, 2], [3, 3], [2, random.int(4, 6)]])
  for (let index = 0; index < count; index += 1) random.pick(pool)()
  return options
}

function arrayOptions(random) {
  const options = {}
  const pool = [
    () => (options.arrayFormat = random.pick(["indices", "brackets", "repeat", "comma"])),
    () => (options.arrayFormat = random.pick(["indices", "brackets", "repeat", "comma"])),
    () => (options.indices = random.bool()),
    () => (options.commaRoundTrip = random.bool()),
    () => (options.allowEmptyArrays = random.bool()),
    () => (options.allowDots = random.bool()),
    () => (options.encode = random.bool()),
    () => (options.encodeValuesOnly = random.bool()),
    () => (options.skipNulls = random.bool()),
    () => (options.strictNullHandling = random.bool()),
  ]
  const count = pickWeighted(random, [[1, 0], [3, 1], [4, 2], [3, 3], [1, random.int(4, 6)]])
  for (let index = 0; index < count; index += 1) random.pick(pool)()
  return options
}

function nestedOptions(random) {
  const options = {}
  const pool = [
    () => (options.allowDots = random.bool()),
    () => (options.decodeDotInKeys = random.bool()),
    () => (options.depth = random.pick([0, 1, 2, 3, 5, false])),
    () => (options.allowPrototypes = random.bool()),
    () => (options.plainObjects = random.bool()),
    () => (options.parseArrays = random.bool()),
    () => (options.allowSparse = random.bool()),
    () => (options.allowEmptyArrays = random.bool()),
    () => (options.strictNullHandling = random.bool()),
    () => (options.strictMerge = random.bool()),
  ]
  const count = pickWeighted(random, [[2, 0], [4, 1], [4, 2], [2, 3]])
  for (let index = 0; index < count; index += 1) random.pick(pool)()
  if (options.decodeDotInKeys === true && options.allowDots === false) delete options.allowDots
  return options
}

function limitsOptions(random) {
  const options = {}
  const pool = [
    () => (options.depth = random.pick([0, 1, 2, 3, 5, false])),
    () => (options.strictDepth = random.bool()),
    () => (options.arrayLimit = random.pick([-1, 0, 1, 2, 3, 5, 20])),
    () => (options.arrayLimit = random.pick([0, 1, 2, 3])),
    () => (options.parameterLimit = random.pick([1, 2, 3, 5, Infinity])),
    () => (options.throwOnLimitExceeded = random.bool(0.6)),
    () => (options.allowSparse = random.bool()),
    () => (options.strictNullHandling = random.bool()),
    () => (options.parseArrays = random.bool(0.2)),
  ]
  const count = pickWeighted(random, [[1, 1], [4, 2], [4, 3], [2, 4]])
  for (let index = 0; index < count; index += 1) random.pick(pool)()
  if (random.bool(0.45)) options.throwOnLimitExceeded = true
  return options
}

const INVALID = [
  { fn: "parse", str: "a=b", options: { charset: "utf8" } },
  { fn: "parse", str: "a=b", options: { decoder: "nope" } },
  { fn: "parse", str: "a=b", options: { decoder: null } },
  { fn: "parse", str: "a=b", options: { duplicates: "merge" } },
  { fn: "parse", str: "a=b", options: { allowEmptyArrays: "yes" } },
  { fn: "parse", str: "a=b", options: { decodeDotInKeys: 1 } },
  { fn: "parse", str: "a=b", options: { throwOnLimitExceeded: "true" } },
  { fn: "parse", str: "a=b", options: { depth: "3" } },
  { fn: "parse", str: "a[b]=c", options: { depth: -1 } },
  { fn: "parse", str: "a=b;c=d", options: { delimiter: 5 } },
  { fn: "parse", str: "a=b&c=d", options: { parameterLimit: 0, throwOnLimitExceeded: true } },
  { fn: "parse", str: "a[]=b", options: { arrayLimit: "3" } },
  { fn: "parse", str: 42, options: undefined },
  { fn: "stringify", obj: { a: "b" }, options: { charset: "latin1" } },
  { fn: "stringify", obj: { a: "b" }, options: { encoder: "nope" } },
  { fn: "stringify", obj: { a: "b" }, options: { encoder: null } },
  { fn: "stringify", obj: { a: "b" }, options: { format: "RFC2396" } },
  { fn: "stringify", obj: { a: "b" }, options: { format: "toString" } },
  { fn: "stringify", obj: { a: "b" }, options: { allowEmptyArrays: 0 } },
  { fn: "stringify", obj: { a: "b" }, options: { encodeDotInKeys: "x" } },
  { fn: "stringify", obj: { a: [1] }, options: { commaRoundTrip: null, arrayFormat: "comma" } },
  { fn: "stringify", obj: { a: [1] }, options: { arrayFormat: "toString" } },
  { fn: "stringify", obj: { a: [1, 2] }, options: { arrayFormat: "nope", indices: false } },
  { fn: "stringify", obj: { a: { b: { c: "d" } } }, options: { depth: 1 } },
  { fn: "stringify", obj: "a=b", options: undefined },
  { fn: "stringify", obj: 12, options: undefined },
  { fn: "stringify", obj: null, options: undefined },
  { fn: "stringify", obj: ["x", "y"], options: undefined },
  { fn: "stringify", obj: { a: "b" }, options: { filter: "a" } },
  { fn: "stringify", obj: { a: "b", c: null }, options: { delimiter: undefined, skipNulls: "yes" } },
]

function cyclic(random) {
  const object = { a: { b: "c" } }
  if (random.bool()) object.a.self = object.a
  else object.a.list = [object]
  return object
}

export default {
  targets: {
    parse: {
      count: 380,
      input: (random) => parseTarget(random),
      run: (api, input) => api.parse(input.str, input.options),
    },
    stringify: {
      count: 360,
      input(random) {
        const roll = random.int(0, 29)
        if (roll === 0) return { obj: cyclic(random), options: stringifyOptions(random) }
        if (roll === 1 || roll === 2) return random.pick(INVALID.filter((item) => item.fn === "stringify"))
        return { obj: rootObject(random, {}), options: stringifyOptions(random) }
      },
      run: (api, input) => api.stringify(input.obj, input.options),
    },
    nested: {
      count: 300,
      input(random) {
        const options = nestedOptions(random)
        if (random.int(0, 29) === 0) return { str: random.pick(["", null, undefined]), options }
        return { str: queryString(random, { dots: true, encoded: true, indexMax: 25, rawValues: false, maxParams: 6 }), options }
      },
      run: (api, input) => api.parse(input.str, input.options),
    },
    limits: {
      count: 300,
      input(random) {
        const options = limitsOptions(random)
        const shape = random.int(0, 4)
        let str
        if (shape === 0) {
          const key = random.pick(["a", "a[]", "a[b]", "a[]"])
          str = Array.from({ length: random.int(1, 6) }, (_, index) => key + "=" + index).join("&")
        } else if (shape === 1) {
          str = Array.from({ length: random.int(1, 5) }, () => "a[" + random.int(0, 6) + "]=" + random.pick(["x", "y", ""])).join("&")
        } else if (shape === 2) {
          str = "a" + Array.from({ length: random.int(0, 7) }, () => random.pick(["[b]", "[]", "[0]", "[c]"])).join("") + "=v"
          if (random.bool()) str += "&" + queryKey(random, { dots: false, encoded: false, indexMax: 6 }) + "=w"
        } else {
          str = queryString(random, { dots: false, encoded: false, indexMax: 6, rawValues: false, maxParams: 8, repeatKeys: 0.6 })
        }
        return { str, options }
      },
      run: (api, input) => api.parse(input.str, input.options),
    },
    arrays: {
      count: 300,
      input(random) {
        const object = {}
        for (let index = random.int(1, 3); index > 0; index -= 1) {
          object[random.pick(["a", "b", "c d", "é", "x.y", "0"])] = random.bool(0.7) ? random.array(0, 4, () => value(random, 2, { bigints: false })) : value(random, 3, { bigints: false })
        }
        return { obj: object, options: arrayOptions(random) }
      },
      run: (api, input) => api.stringify(input.obj, input.options),
    },
  },
}
