// Serializes a value so that two values print the same exactly when the
// grader considers them the same output. Thrown errors are compared by
// constructor name and message.
export function canonical(value) {
  const seen = new Map()
  const walk = (input) => {
    if (input === null) return "null"
    switch (typeof input) {
      case "undefined":
        return "undefined"
      case "number":
        if (Object.is(input, -0)) return "-0"
        return Number.isNaN(input) ? "NaN" : String(input)
      case "bigint":
        return `${input}n`
      case "string":
        return JSON.stringify(input)
      case "boolean":
        return String(input)
      case "symbol":
        return `Symbol(${input.description ?? ""})`
      case "function":
        return `[Function${input.name ? ` ${input.name}` : ""}]`
    }
    if (seen.has(input)) return `[Circular #${seen.get(input)}]`
    seen.set(input, seen.size)
    const tag = Object.prototype.toString.call(input).slice(8, -1)
    if (input instanceof Error) return `${input.constructor?.name ?? "Error"}(${JSON.stringify(input.message)})`
    if (input instanceof Date) return `Date(${Number.isNaN(input.getTime()) ? "Invalid" : input.toISOString()})`
    if (input instanceof RegExp) return `RegExp(${String(input)})`
    if (ArrayBuffer.isView(input)) return `${tag}[${Array.from(input instanceof DataView ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength) : input, (item) => walk(item)).join(",")}]`
    if (input instanceof ArrayBuffer) return `ArrayBuffer[${Array.from(new Uint8Array(input)).join(",")}]`
    if (input instanceof Map) return `Map{${[...input].map(([key, item]) => `${walk(key)}=>${walk(item)}`).join(",")}}`
    if (input instanceof Set) return `Set{${[...input].map((item) => walk(item)).join(",")}}`
    if (Array.isArray(input)) {
      const items = []
      for (let index = 0; index < input.length; index += 1) items.push(index in input ? walk(input[index]) : "<hole>")
      const extra = Object.keys(input).filter((key) => !/^\d+$/.test(key))
      return `[${items.join(",")}${extra.length ? `|${extra.map((key) => `${JSON.stringify(key)}:${walk(input[key])}`).join(",")}` : ""}]`
    }
    const prototype = Object.getPrototypeOf(input)
    const kind = prototype === null ? "null-proto" : prototype === Object.prototype ? "" : (prototype.constructor?.name ?? tag)
    const keys = Reflect.ownKeys(input).filter((key) => Object.prototype.propertyIsEnumerable.call(input, key))
    const body = keys
      .map((key) => `${typeof key === "symbol" ? walk(key) : JSON.stringify(key)}:${walk(input[key])}`)
      .join(",")
    return `${kind}{${body}}`
  }
  return walk(value)
}

export function canonicalOutcome(run) {
  try {
    return { value: canonical(run()) }
  } catch (error) {
    return { thrown: thrownName(error) }
  }
}

export function thrownName(error) {
  if (error instanceof Error) return `${error.constructor?.name ?? "Error"}: ${error.message}`
  return `non-error: ${canonical(error)}`
}
