import { formats, parse, stringify } from "./index.js"

const simple: Record<string, unknown> = parse("a[b]=c&a[d][]=e")
const parsed: Record<string, unknown> = parse("?a.b=1;c[0]=2", {
  allowDots: true,
  allowEmptyArrays: false,
  allowPrototypes: false,
  allowSparse: false,
  arrayLimit: 20,
  charset: "utf-8",
  charsetSentinel: false,
  comma: true,
  delimiter: /[;&]/,
  depth: 5,
  duplicates: "combine",
  ignoreQueryPrefix: true,
  interpretNumericEntities: false,
  parameterLimit: 1000,
  parseArrays: true,
  plainObjects: false,
  strictDepth: false,
  strictMerge: true,
  strictNullHandling: false,
  throwOnLimitExceeded: false,
})
const dotted: Record<string, unknown> = parse("name%252Eobj.first=John", { decodeDotInKeys: true, depth: false })
const decoded: Record<string, unknown> = parse("A=B", {
  decoder: (str, defaultDecoder, charset, type) => (type === "key" ? str.toLowerCase() : defaultDecoder(str, defaultDecoder, charset)),
})
const semiParsed: Record<string, unknown> = parse({ "a[b]": "c" })

const plain: string = stringify({ a: "b", c: ["d", "e"] })
const configured: string = stringify(
  { a: { b: [1, 2] }, d: new Date(0), e: null },
  {
    addQueryPrefix: true,
    allowDots: true,
    allowEmptyArrays: true,
    arrayFormat: "comma",
    charset: "iso-8859-1",
    charsetSentinel: true,
    commaRoundTrip: true,
    delimiter: ";",
    encode: true,
    encodeDotInKeys: true,
    encodeValuesOnly: false,
    format: formats.RFC1738,
    indices: false,
    serializeDate: (date) => String(date.getTime()),
    skipNulls: false,
    sort: (a, b) => a.localeCompare(b),
    strictNullHandling: true,
  }
)
const encoded: string = stringify({ a: "b" }, {
  encoder: (str, defaultEncoder, charset, type) => (type === "key" ? String(str) : defaultEncoder(str, defaultEncoder, charset)),
})
const filtered: string = stringify({ a: "b", c: [1, 2] }, { filter: ["a", "c", 0] })
const mapped: string = stringify({ a: "b" }, { filter: (prefix, value) => (prefix === "a" ? undefined : value), format: "RFC3986" })
const name: string = formats.default
const plus: string = formats.formatters.RFC1738("a%20b")
const kept: string = formats.formatters.RFC3986("a%20b")
const whatwg: string = formats.WHATWG
void [simple, parsed, dotted, decoded, semiParsed, plain, configured, encoded, filtered, mapped, name, plus, kept, whatwg]
