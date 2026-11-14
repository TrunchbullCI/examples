// Differential fuzz targets for deep-equal. Each input is a pair of values
// built from the grader's seeded generator: one value and a copy of it with
// zero or more small mutations, compared loosely or strictly.
function sharedFunction() {}
function otherFunction() {}
class Point {
  constructor(x) {
    this.x = x
  }
}

const PRIMITIVES = [0, -0, 1, 3, -1, 1.5, NaN, Infinity, -Infinity, "", "0", "3", "-000", "1.5", " 3 ", "abc", "true", true, false, null, undefined, 3n, 0n]
const KEYS = ["a", "b", "c", "0", "1", "length", "x y"]

function primitive(random) {
  return random.pick(PRIMITIVES)
}

function plainValue(random, depth) {
  const roll = random.int(0, 11)
  if (depth <= 0 || roll <= 4) return primitive(random)
  if (roll <= 7) return random.array(0, 4, () => plainValue(random, depth - 1))
  if (roll === 8) return random.pick([sharedFunction, otherFunction])
  const object = roll === 9 && random.bool(0.4) ? Object.create(null) : roll === 10 && random.bool(0.3) ? new Point(primitive(random)) : {}
  for (let index = random.int(0, 3); index > 0; index -= 1) object[random.pick(KEYS)] = plainValue(random, depth - 1)
  return object
}

function looseTwin(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "string" && value !== "" && !Number.isNaN(Number(value))) return Number(value)
  if (value === null) return undefined
  if (value === undefined) return null
  if (value === 0) return -0
  if (value === true) return 1
  if (value === false) return ""
  return value
}

function copy(value, random, mutate, seen = new Map()) {
  if (value === null || typeof value !== "object") return mutate && random.bool(0.15) ? looseTwin(value) : value
  if (seen.has(value)) return seen.get(value)
  const result = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value))
  seen.set(value, result)
  const keys = Object.keys(value)
  const ordered = mutate && random.bool(0.3) ? keys.slice().reverse() : keys
  for (const key of ordered) result[key] = copy(value[key], random, mutate, seen)
  if (Array.isArray(value)) result.length = value.length
  if (mutate && random.bool(0.12)) {
    const key = random.pick(Array.isArray(result) ? ["a", "0", "1", "x y"] : KEYS)
    if (Object.prototype.hasOwnProperty.call(result, key)) delete result[key]
    else result[key] = primitive(random)
  }
  if (mutate && random.bool(0.05)) Object.setPrototypeOf(result, Array.isArray(value) ? Object.prototype : random.pick([null, Point.prototype, Object.prototype]))
  return result
}

function withCycle(random) {
  const a = { name: random.pick(["x", "y"]) }
  a.self = a
  if (random.bool()) {
    a.list = [a, 1]
  }
  return a
}

function options(random) {
  return random.pick([undefined, undefined, { strict: true }, { strict: true }, { strict: false }, {}])
}

function argumentsOf() {
  return arguments
}

function special(random) {
  const roll = random.int(0, 9)
  if (roll === 0) return random.pick([new Date(0), new Date(86400000), new Date(Number.NaN), new Date(1387585278000)])
  if (roll === 1) return random.pick([/abc/, /abc/g, /abc/gi, /ab+c/, new RegExp("a/b"), /abc/y])
  if (roll === 2) return random.pick([new Error("xyz"), new TypeError("xyz"), new Error("zyx"), new RangeError("")])
  if (roll === 3) return random.pick([Object(1), Object(2), Object("a"), Object("ab"), Object(true), Object(false), Object(3n), Object(Symbol.iterator)])
  if (roll === 4) return random.pick([argumentsOf(1, 2, 3), argumentsOf(), argumentsOf("a")])
  if (roll === 5) {
    const tagged = { a: 1 }
    Object.defineProperty(tagged, Symbol.toStringTag, { value: random.pick(["Date", "Array", "Thing"]) })
    return tagged
  }
  if (roll === 6) return random.pick([[1, 2, 3], { 0: 1, 1: 2, 2: 3, length: 3 }, { message: "xyz" }, {}])
  return plainValue(random, 2)
}

function specialTwin(value, random) {
  if (value instanceof Date) return random.bool(0.6) ? new Date(value.getTime()) : new Date(value.getTime() + random.pick([1, -1000]))
  if (value instanceof RegExp) {
    if (random.bool(0.6)) {
      const twin = new RegExp(value.source, value.flags)
      if (random.bool(0.2)) twin.lastIndex = 3
      return twin
    }
    return new RegExp(value.source, value.flags === "g" ? "i" : "g")
  }
  if (value instanceof Error) {
    if (random.bool(0.6)) {
      const twin = new value.constructor(value.message)
      if (random.bool(0.2)) twin.code = 10
      return twin
    }
    return new Error(value.message + "!")
  }
  if (random.bool(0.3)) return special(random)
  if (value && typeof value === "object" && Object.prototype.toString.call(value) === "[object Arguments]") return random.bool() ? argumentsOf(...value) : [...value]
  if (value && typeof value === "object" && typeof value.valueOf === "function" && value !== value.valueOf()) {
    const inner = value.valueOf()
    return random.pick([Object(inner), inner, Object(inner === 1 ? 2 : inner)])
  }
  return copy(value, random, true)
}

function collectionMember(random, depth) {
  const roll = random.int(0, 9)
  if (roll <= 5 || depth <= 0) return random.pick([1, 2, "1", "2", "x", 0, -0, NaN, null, undefined, true, "true", 1n])
  if (roll <= 7) return random.pick([{ a: 1 }, { a: "1" }, [1], ["1"], { b: [2] }])
  return collection(random, depth - 1)
}

function collection(random, depth) {
  const size = random.int(0, 4)
  if (random.bool()) return new Set(Array.from({ length: size }, () => collectionMember(random, depth)))
  return new Map(Array.from({ length: size }, () => [collectionMember(random, depth), collectionMember(random, depth)]))
}

function collectionTwin(value, random) {
  if (random.bool(0.1)) return collection(random, 1)
  const twinMember = (member) => {
    if (member instanceof Map || member instanceof Set) return collectionTwin(member, random)
    if (random.bool(0.2)) return looseTwin(member)
    if (member && typeof member === "object") return copy(member, random, random.bool(0.3))
    return member
  }
  if (value instanceof Set) {
    const items = [...value].map(twinMember)
    if (random.bool(0.3)) items.reverse()
    if (random.bool(0.1)) items.push(collectionMember(random, 0))
    if (random.bool(0.1)) items.pop()
    return new Set(items)
  }
  const entries = [...value].map(([key, item]) => [random.bool(0.6) ? key : twinMember(key), twinMember(item)])
  if (random.bool(0.3)) entries.reverse()
  if (random.bool(0.1)) entries.push([collectionMember(random, 0), collectionMember(random, 0)])
  return new Map(entries)
}

const TYPED = ["Int8Array", "Uint8Array", "Uint8ClampedArray", "Int16Array", "Uint16Array", "Int32Array", "Uint32Array", "Float32Array", "Float64Array", "BigInt64Array", "BigUint64Array"]

function binary(random) {
  const roll = random.int(0, 9)
  const bytes = random.array(0, 6, () => random.int(0, 255))
  if (roll <= 4) {
    const name = random.pick(TYPED)
    const big = name.startsWith("Big")
    const items = bytes.map((byte) => (big ? BigInt(byte) : name.startsWith("Float") && random.bool(0.3) ? random.pick([NaN, -0, 0, 0.5]) : byte - (name.startsWith("Int") ? 128 : 0)))
    return new globalThis[name](items)
  }
  if (roll <= 6) return Buffer.from(bytes)
  if (roll === 7) return new Uint8Array(bytes).buffer
  if (roll === 8) {
    const shared = new SharedArrayBuffer(bytes.length)
    new Uint8Array(shared).set(bytes)
    return shared
  }
  return random.bool() ? [new Uint8Array(bytes)] : { data: new Uint8Array(bytes) }
}

function binaryTwin(value, random) {
  const roll = random.int(0, 9)
  if (roll === 0) return binary(random)
  const mutateBytes = (array) => {
    if (array.length > 0 && random.bool(0.35)) {
      const index = random.int(0, array.length - 1)
      array[index] = typeof array[index] === "bigint" ? array[index] + 1n : array[index] === 0 ? -0 : array[index] + 1
    }
    return array
  }
  if (value instanceof ArrayBuffer) {
    const twin = Uint8Array.from(new Uint8Array(value))
    mutateBytes(twin)
    return random.bool(0.1) ? new Uint8Array(twin) : twin.buffer
  }
  if (typeof SharedArrayBuffer === "function" && value instanceof SharedArrayBuffer) {
    const shared = new SharedArrayBuffer(value.byteLength + (random.bool(0.1) ? 1 : 0))
    new Uint8Array(shared).set(mutateBytes(Uint8Array.from(new Uint8Array(value))))
    return shared
  }
  if (Buffer.isBuffer(value)) {
    if (roll <= 3) return new Uint8Array(value)
    return mutateBytes(Buffer.from(value))
  }
  if (ArrayBuffer.isView(value)) {
    if (roll === 1) {
      const name = random.pick(TYPED.filter((item) => item.startsWith("Big") === value.constructor.name.startsWith("Big")))
      return new globalThis[name](Array.from(value))
    }
    if (roll === 2) return Array.from(value)
    const twin = new value.constructor(value)
    if (value.constructor.name.startsWith("Float") && twin.length > 0 && random.bool(0.4)) {
      const index = random.int(0, twin.length - 1)
      twin[index] = Object.is(twin[index], -0) ? 0 : twin[index] === 0 ? -0 : twin[index]
      return twin
    }
    return mutateBytes(twin)
  }
  if (Array.isArray(value)) return [binaryTwin(value[0], random)]
  return { data: binaryTwin(value.data, random) }
}

export default {
  targets: {
    values: {
      count: 320,
      input(random) {
        const roll = random.int(0, 19)
        if (roll === 0) {
          const a = withCycle(random)
          const b = random.bool(0.7) ? withCycle(random) : { name: a.name, self: { name: a.name } }
          return { a, b, opts: options(random) }
        }
        if (roll === 1) return { a: primitive(random), b: primitive(random), opts: options(random) }
        const a = plainValue(random, 3)
        const b = random.bool(0.15) ? plainValue(random, 3) : copy(a, random, random.bool(0.75))
        return random.bool() ? { a, b, opts: options(random) } : { a: b, b: a, opts: options(random) }
      },
      run: (api, input) => api.default(input.a, input.b, input.opts),
    },
    special: {
      count: 220,
      input(random) {
        const a = special(random)
        const b = specialTwin(a, random)
        return random.bool() ? { a, b, opts: options(random) } : { a: b, b: a, opts: options(random) }
      },
      run: (api, input) => api.default(input.a, input.b, input.opts),
    },
    collections: {
      count: 300,
      input(random) {
        const a = collection(random, 2)
        let b = collectionTwin(a, random)
        if (random.bool(0.05)) b = random.pick([new WeakMap(), new WeakSet(), {}, []])
        if (random.bool(0.05)) return { a: random.pick([new WeakMap(), new WeakSet()]), b: random.pick([new WeakMap(), new WeakSet()]), opts: options(random) }
        return random.bool() ? { a, b, opts: options(random) } : { a: b, b: a, opts: options(random) }
      },
      run: (api, input) => api.default(input.a, input.b, input.opts),
    },
    binary: {
      count: 300,
      input(random) {
        const a = binary(random)
        const b = binaryTwin(a, random)
        return random.bool() ? { a, b, opts: options(random) } : { a: b, b: a, opts: options(random) }
      },
      run: (api, input) => api.default(input.a, input.b, input.opts),
    },
  },
}
