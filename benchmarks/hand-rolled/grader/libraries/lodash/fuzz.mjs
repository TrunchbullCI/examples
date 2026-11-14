// Differential fuzz targets for lodash's debounce, throttle and cloneDeep.
// setup() replaces the timer and clock globals with a virtual clock before
// the module under test is imported, so timing scenarios run instantly and
// identically in the reference and submission processes.
const BASE_TIME = 1_700_000_000_000
const TIMEOUT_MAX = 2 ** 31 - 1

const clock = { now: BASE_TIME, seq: 0, nextId: 1, timers: new Map() }

class FakeTimeout {
  constructor(id) {
    this.id = id
  }
  ref() {
    return this
  }
  unref() {
    return this
  }
  hasRef() {
    return true
  }
  refresh() {
    const timer = clock.timers.get(this.id)
    if (timer) {
      timer.at = clock.now + timer.delay
      timer.seq = clock.seq++
    }
    return this
  }
  [Symbol.toPrimitive]() {
    return this.id
  }
}

function schedule(callback, delay, args, repeat) {
  if (typeof callback !== "function") throw new TypeError('The "callback" argument must be of type function.')
  let after = Number(delay)
  if (!(after >= 1 && after <= TIMEOUT_MAX)) after = 1
  const id = clock.nextId++
  clock.timers.set(id, { id, at: clock.now + after, delay: after, seq: clock.seq++, callback, args, repeat })
  return new FakeTimeout(id)
}

function cancel(handle) {
  if (handle == null) return
  const id = typeof handle === "object" ? handle.id : Number(handle)
  clock.timers.delete(id)
}

// Runs every timer due up to now + ms in order of due time, then of creation.
function advance(ms) {
  const target = clock.now + ms
  for (;;) {
    let next = null
    for (const timer of clock.timers.values()) {
      if (timer.at <= target && (next === null || timer.at < next.at || (timer.at === next.at && timer.seq < next.seq))) next = timer
    }
    if (next === null) break
    clock.now = Math.max(clock.now, next.at)
    if (next.repeat) {
      next.at = clock.now + next.delay
      next.seq = clock.seq++
    } else {
      clock.timers.delete(next.id)
    }
    next.callback(...next.args)
  }
  clock.now = target
}

function resetClock(offset) {
  clock.timers.clear()
  clock.now = BASE_TIME + offset
}

function installFakeTimers() {
  const RealDate = globalThis.Date
  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(clock.now)
      else super(...args)
    }
    static now() {
      return clock.now
    }
  }
  Object.defineProperty(FakeDate, "name", { value: "Date" })
  globalThis.Date = FakeDate
  globalThis.setTimeout = (callback, delay, ...args) => schedule(callback, delay, args, false)
  globalThis.setInterval = (callback, delay, ...args) => schedule(callback, delay, args, true)
  globalThis.clearTimeout = cancel
  globalThis.clearInterval = cancel
  globalThis.performance.now = () => clock.now - BASE_TIME
}

const CONTEXTS = [undefined, { name: "first" }, { name: "second" }]
// lodash.js is sloppy-mode code, so a call without a receiver reaches func
// with globalThis where an ES module passes undefined; both read "unbound".
const label = (value) => (value === undefined || value === globalThis ? "unbound" : (value?.name ?? typeof value))

function timingInput(random, kind) {
  if (random.bool(0.06)) {
    return { kind, func: random.pick([null, undefined, 42, "fn", {}, [() => 1]]), wait: 10, options: undefined, ops: [] }
  }
  const wait = random.bool(0.1)
    ? random.pick([undefined, null, -10, "30", "abc", Number.NaN, true, 2.9e9])
    : random.pick([0, 1, 5, 10, 16, 20, 32, 50, 64, 100, 250])
  const numericWait = Number.isFinite(Number(wait)) ? Math.max(0, Number(wait)) : 0
  const flag = () => random.pick([true, false, true, false, 1, 0, "", "yes", undefined])
  let options
  const shape = random.int(0, 9)
  if (shape === 0) options = undefined
  else if (shape === 1) options = random.pick([{}, 5, "leading", null, true])
  else {
    options = {}
    if (random.bool(0.5)) options.leading = flag()
    if (random.bool(0.5)) options.trailing = flag()
    if (kind === "debounce" && random.bool(0.5)) {
      options.maxWait = random.bool(0.15)
        ? random.pick([undefined, 0, -5, "40", Number.NaN])
        : random.int(0, Math.max(1, Math.round(Math.min(numericWait, 400) * 3)))
    }
  }
  const span = Math.min(Math.max(numericWait, 4), 400)
  const ops = random.array(4, 24, () => {
    const roll = random.next()
    if (roll < 0.45) return { op: "call", arg: random.int(0, 99), context: random.int(0, 2) }
    if (roll < 0.8) return { op: "advance", ms: Math.max(0, random.pick([0, 1, random.int(0, span), random.int(0, span * 2 + 2), span, span - 1, span + 1])) }
    if (roll < 0.86) return { op: "cancel" }
    if (roll < 0.94) return { op: "flush" }
    return { op: "reentrant", arg: random.int(0, 99) }
  })
  return { kind, func: "spy", wait, options, ops, start: random.int(0, 1000) }
}

function runTiming(api, input) {
  resetClock(input.start ?? 0)
  const log = []
  let wrapped
  let reenter = 0
  const func =
    input.func === "spy"
      ? function (...args) {
          log.push(["invoke", clock.now - BASE_TIME, label(this), args])
          if (reenter > 0) {
            reenter -= 1
            log.push(["nested", wrapped.call(this, args.length ? args[0] + 1 : 0)])
          }
          return args.length ? "result:" + args[0] : "result"
        }
      : input.func
  wrapped = api[input.kind](func, input.wait, input.options)
  log.push(["created", typeof wrapped, typeof wrapped.cancel, typeof wrapped.flush])
  for (const step of input.ops) {
    const at = clock.now - BASE_TIME
    if (step.op === "call") log.push(["call", at, wrapped.call(CONTEXTS[step.context], step.arg)])
    else if (step.op === "advance") advance(step.ms)
    else if (step.op === "cancel") log.push(["cancel", at, wrapped.cancel()])
    else if (step.op === "flush") log.push(["flush", at, wrapped.flush()])
    else {
      reenter = 1
      log.push(["call", at, wrapped(step.arg)])
      reenter = 0
    }
  }
  advance(5000)
  log.push(["drained", clock.now - BASE_TIME, clock.timers.size])
  wrapped.cancel()
  return log
}

// Values for cloneDeep: every kind lodash clones, keeps or replaces, nested
// with shared and circular references.
class Point {
  constructor(x, y) {
    this.x = x
    this.y = y
  }
}
class Shape extends Point {}
function Legacy(value) {
  this.value = value
}
Legacy.prototype.inherited = true
const SYMBOLS = [Symbol("alpha"), Symbol("beta")]

function primitive(random) {
  return random.pick([
    () => random.int(-1000, 1000),
    () => random.pick([0, -0, 1.5, Number.NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER]),
    () => random.string("abcxyz _-", 0, 8),
    () => random.bool(),
    () => null,
    () => undefined,
    () => BigInt(random.int(-50, 50)),
    () => random.pick(SYMBOLS),
  ])()
}

function typedArray(random) {
  const Ctor = random.pick([Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array])
  const length = random.int(0, 4)
  const offset = random.int(0, 2) * Ctor.BYTES_PER_ELEMENT
  const buffer = new ArrayBuffer(offset + (length + random.int(0, 2)) * Ctor.BYTES_PER_ELEMENT)
  const view = new Ctor(buffer, offset, length)
  for (let index = 0; index < length; index += 1) view[index] = Ctor === BigInt64Array ? BigInt(random.int(-9, 9)) : random.int(-300, 300)
  if (random.bool(0.15)) view.extra = random.int(0, 9)
  return view
}

function value(random, depth, pool, top = false) {
  if (depth <= 0 || random.bool(top ? 0.04 : 0.3)) return primitive(random)
  if (pool.length && random.bool(0.12)) return random.pick(pool)
  const child = () => value(random, depth - 1, pool)
  let result
  switch (random.int(0, 27)) {
    case 0:
    case 1:
    case 2:
      result = {}
      pool.push(result)
      for (let index = random.int(0, 4); index > 0; index -= 1) result[random.pick(["a", "b", "c", "key", "1", "0", "constructor", "toString", "valueOf"])] = child()
      if (random.bool(0.15)) result[random.pick(SYMBOLS)] = child()
      if (random.bool(0.1)) Object.defineProperty(result, "hidden", { value: child(), enumerable: false })
      return result
    case 3:
    case 4:
    case 5:
      result = []
      pool.push(result)
      for (let index = random.int(0, 4); index > 0; index -= 1) result.push(child())
      if (random.bool(0.15)) result.length += 2
      if (random.bool(0.1)) result.label = "extra"
      return result
    case 6:
      result = Object.create(null)
      pool.push(result)
      result.a = child()
      return result
    case 7:
      return JSON.parse('{"__proto__": {"polluted": true}, "safe": 1}')
    case 8:
      result = new Map()
      pool.push(result)
      for (let index = random.int(0, 3); index > 0; index -= 1) result.set(random.pick(["k", "m", 1, 2, SYMBOLS[0]]), child())
      if (random.bool(0.1)) result.extra = "map"
      return result
    case 9:
      result = new Set()
      pool.push(result)
      for (let index = random.int(0, 3); index > 0; index -= 1) result.add(child())
      return result
    case 10: {
      const date = new Date(random.bool(0.1) ? Number.NaN : random.int(0, 2_000_000_000_000))
      if (random.bool(0.2)) date.note = "expando"
      return date
    }
    case 11: {
      const regexp = new RegExp(random.pick(["a+", "x|y", "^\\d+$", "[a-c]", "(?<g>z)"]), random.pick(["", "g", "gi", "im", "gmsu", "y", "d"]))
      if (regexp.global || regexp.sticky) regexp.lastIndex = random.int(0, 3)
      if (random.bool(0.2)) regexp.note = "expando"
      return regexp
    }
    case 12:
      return typedArray(random)
    case 13: {
      const buffer = new ArrayBuffer(random.int(0, 6))
      new Uint8Array(buffer).fill(random.int(0, 255))
      return random.bool(0.5) ? buffer : new DataView(buffer, random.int(0, Math.min(2, buffer.byteLength)))
    }
    case 14:
      return Buffer.from(random.string("abc", 0, 5))
    case 15: {
      const boxed = random.pick([Object(random.bool()), Object(random.int(-5, 5)), Object(random.string("ab", 0, 3)), Object(random.pick(SYMBOLS))])
      if (random.bool(0.3)) boxed.note = "expando"
      return boxed
    }
    case 16:
      return random.pick([new Point(random.int(0, 9), child()), new Shape(1, 2), new Legacy(child())])
    case 17:
      return random.pick([function named() {}, () => 1, async function asyncFn() {}, function* generator() {}, class Klass {}, Math.max])
    case 18:
      return random.pick([new Error("boom"), new TypeError("bad"), new RangeError("far")])
    case 19:
      return random.pick([new WeakMap(), new WeakSet(), Promise.resolve(1)])
    case 20:
      return (function () {
        return arguments
      })(child(), child())
    case 21:
      return /b(c)/.exec(random.pick(["abcd", "bc", "xxbcx"]))
    case 22: {
      const object = { self: null, list: [] }
      object.self = object
      object.list.push(object, object.list)
      return object
    }
    case 23:
      result = Object.create({ inherited: child() })
      result.own = child()
      return result
    case 24:
      return Point.prototype
    case 25: {
      const instance = new Legacy(1)
      instance.constructor = random.pick([null, Object, Legacy, "text"])
      return instance
    }
    case 26:
      return Object.defineProperty({ plain: 1 }, "computed", { get: () => "got", enumerable: true })
    default:
      return [child(), child()]
  }
}

// Records, at each object reachable through own enumerable keys, Map values
// and Set entries, whether the copy reuses the original (lodash keeps
// functions, errors and weak collections nested in a cloned value by
// reference), plus RegExp lastIndex and typed-array buffers. (A Buffer's
// backing store comes from Node's shared pool, so it is not compared.)
function identities(original, copy, depth, seen = new Set()) {
  if (depth < 0 || original === null || (typeof original !== "object" && typeof original !== "function")) return null
  if (seen.has(original)) return "seen"
  seen.add(original)
  const entry = { same: original === copy }
  if (copy === null || typeof copy !== "object") return entry
  if (original instanceof RegExp) entry.lastIndex = copy.lastIndex
  if (ArrayBuffer.isView(original) && !Buffer.isBuffer(original)) {
    entry.sharesBuffer = copy.buffer === original.buffer
    entry.byteOffset = copy.byteOffset
    entry.bufferLength = copy.buffer?.byteLength
  }
  const children = []
  if (original instanceof Map && copy instanceof Map) {
    for (const [key, item] of original) children.push(identities(item, copy.get(key), depth - 1, seen))
  } else if (original instanceof Set && copy instanceof Set) {
    const copies = [...copy]
    let index = 0
    for (const item of original) children.push(identities(item, copies[index++], depth - 1, seen))
  } else {
    for (const key of Object.keys(original)) children.push(identities(original[key], copy[key], depth - 1, seen))
  }
  if (children.some((child) => child !== null)) entry.children = children
  return entry
}

export default {
  setup: installFakeTimers,
  targets: {
    debounce: {
      count: 260,
      input: (random) => timingInput(random, "debounce"),
      run: runTiming,
    },
    throttle: {
      count: 220,
      input: (random) => timingInput(random, "throttle"),
      run: runTiming,
    },
    cloneDeep: {
      count: 320,
      input: (random) => value(random, random.int(1, 4), [], true),
      run(api, input) {
        const copy = api.cloneDeep(input)
        return { copy, identities: identities(input, copy, 4) }
      },
    },
  },
}
