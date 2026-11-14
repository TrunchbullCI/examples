`qs` is a query string parsing and stringifying library with support for
nesting and arrays and some added security. `parse` turns a query string into
a nested object (`"foo[bar]=baz"` becomes `{ foo: { bar: "baz" } }`), and
`stringify` turns a nested object back into a query string.

## API

```ts
export type Format = "RFC1738" | "RFC3986" | "WHATWG"
export type DefaultDecoder = (str: string, defaultDecoder?: unknown, charset?: string) => string
export type DefaultEncoder = (str: unknown, defaultEncoder?: unknown, charset?: string, type?: "key" | "value", format?: Format) => string

export interface ParseOptions {
  allowDots?: boolean
  allowEmptyArrays?: boolean
  allowPrototypes?: boolean
  allowSparse?: boolean
  arrayLimit?: number
  charset?: "utf-8" | "iso-8859-1"
  charsetSentinel?: boolean
  comma?: boolean
  decodeDotInKeys?: boolean
  decoder?: (str: string, defaultDecoder: DefaultDecoder, charset: string, type: "key" | "value") => unknown
  delimiter?: string | RegExp
  depth?: number | false
  duplicates?: "combine" | "first" | "last"
  ignoreQueryPrefix?: boolean
  interpretNumericEntities?: boolean
  parameterLimit?: number
  parseArrays?: boolean
  plainObjects?: boolean
  strictDepth?: boolean
  strictMerge?: boolean
  strictNullHandling?: boolean
  throwOnLimitExceeded?: boolean
}

export interface StringifyOptions {
  addQueryPrefix?: boolean
  allowDots?: boolean
  allowEmptyArrays?: boolean
  arrayFormat?: "indices" | "brackets" | "repeat" | "comma"
  charset?: "utf-8" | "iso-8859-1"
  charsetSentinel?: boolean
  commaRoundTrip?: boolean
  delimiter?: string
  depth?: number
  encode?: boolean
  encodeDotInKeys?: boolean
  encoder?: (str: unknown, defaultEncoder: DefaultEncoder, charset: string, type: "key" | "value", format: Format) => string
  encodeValuesOnly?: boolean
  filter?: Array<string | number> | ((prefix: string, value: any) => any)
  format?: Format
  indices?: boolean
  serializeDate?: (date: Date) => string
  skipNulls?: boolean
  sort?: (a: string, b: string) => number
  strictNullHandling?: boolean
}

export const formats: {
  default: "RFC3986"
  RFC1738: "RFC1738"
  RFC3986: "RFC3986"
  WHATWG: "WHATWG"
  formatters: Record<Format, (value: string) => string>
}

export function parse(str: string | Record<string, unknown> | null | undefined, options?: ParseOptions): Record<string, unknown>
export function stringify(object: unknown, options?: StringifyOptions): string
```

The module has three named exports: `parse`, `stringify` and `formats`.

## Parsing

### Defaults

`allowDots: false`, `allowEmptyArrays: false`, `allowPrototypes: false`,
`allowSparse: false`, `arrayLimit: 20`, `charset: "utf-8"`,
`charsetSentinel: false`, `comma: false`, `decodeDotInKeys: false`,
`delimiter: "&"`, `depth: 5`, `duplicates: "combine"`,
`ignoreQueryPrefix: false`, `interpretNumericEntities: false`,
`parameterLimit: 1000`, `parseArrays: true`, `plainObjects: false`,
`strictDepth: false`, `strictMerge: true`, `strictNullHandling: false`,
`throwOnLimitExceeded: false`. Most options of the wrong type (for example a
string `depth` or a numeric `delimiter`) fall back to their defaults, except
for the validated options listed under Errors. `depth` accepts a
number or `false` (same as `0`). The options object is never mutated.

### Splitting and decoding

- `""`, `null` and `undefined` parse to an empty object. All values are
  strings: `"a=15&b=true"` gives `{ a: "15", b: "true" }`.
- With `ignoreQueryPrefix` one leading `?` is removed; otherwise it is part
  of the first key.
- Before splitting, every `%5B`/`%5D` (any case) in the whole string becomes
  a literal `[`/`]`. The string is then split on `delimiter` (a string or a
  `RegExp`). Only the first `parameterLimit` parts are used (`Infinity`
  means no limit); with `throwOnLimitExceeded` more parts throw instead.
- With `charsetSentinel`, the first part that starts with `utf8=` is removed
  from the output and switches the charset: `utf8=%E2%9C%93` (a utf-8 "✓")
  selects `utf-8` and `utf8=%26%2310003%3B` (the numeric entity
  `&#10003;`, which browsers send from iso-8859-1 forms) selects
  `iso-8859-1`, whatever `charset` says; any other value leaves the charset
  unchanged. It applies to parts before and after it.
- Each part is split into key and value at the `=` of its first `]=`, or,
  if it has none, at its first `=`. A part without `=` gets the value `""`
  (`null` with `strictNullHandling`). Empty parts and empty keys are skipped.
- Keys and values are decoded by `decoder(text, defaultDecoder, charset,
  "key" | "value")`. The default decoder turns `+` into a space, then in
  utf-8 applies `decodeURIComponent`, returning the text (with `+` already
  replaced) unchanged if that throws; in iso-8859-1 it decodes each `%XX`
  byte as one Latin-1 character and leaves `%uXXXX` alone. A decoder that
  returns `null` for a key drops that parameter.
- With `comma: true`, a raw value containing `,` is split on commas before
  decoding, so a percent-encoded `%2C` stays a comma inside one element:
  `"a=b,c"` gives `{ a: ["b", "c"] }`. Repeated plain keys flatten into one
  array (`"a=b,c&a=d"` gives `["b", "c", "d"]`); after a key ending in `[]`
  (or an index) each comma group stays together as one nested array element
  (`"a[]=b,c&a[]=d"` gives `[["b", "c"], "d"]`).
- With `interpretNumericEntities` and the iso-8859-1 charset, numeric
  entities such as `&#9786;` in values become the character (code points
  above U+FFFF become a surrogate pair). Keys are not affected.
- Repeated identical keys (compared after decoding) follow `duplicates`:
  `"combine"` collects the values into an array, `"first"` keeps the first
  and `"last"` the last. Keys ending in `[]` always combine.

### Keys and nesting

- `"a[b][c]=d"` creates nested objects. The text before the first `[` is the
  top-level key; each following balanced bracket group (brackets inside a
  group are kept literally, as in `"a[b[c]]"`) is one more level. Text after
  a group and before the next `[` is dropped (`"a[b]x=c"` gives
  `{ a: { b: "c" } }`). An unterminated group keeps the rest of the key,
  from its `[`, as one literal segment (`"a[bc=v"` gives
  `{ a: { "[bc": "v" } }`). A key that starts with `[` has no top-level
  segment of its own, so `"[foo]=bar"` gives `{ foo: "bar" }`.
- At most `depth` bracket groups are split off; the rest of the key, from
  the next `[`, becomes one literal key (with `depth: 1`,
  `"a[b][c][d]=e"` gives `{ a: { b: { "[c][d]": "e" } } }`). With
  `strictDepth` that case throws instead. `depth: 0` or less (or `false`) never
  splits keys; it only strips one pair of brackets that wraps the whole key.
- `allowDots` also accepts dot notation: a `.` outside brackets that is
  followed by something other than `.` or `[` turns the text up to the next
  `.` or `[` into a bracket group (`"a.b.c=d"` is `"a[b][c]=d"`; dots
  inside brackets are untouched). `decodeDotInKeys` implies `allowDots`
  (unless `allowDots` is given) and turns `%2E` (any case) inside each key
  segment into `.`; because keys are percent-decoded first, a literal dot
  must arrive double-encoded: `"name%252Eobj.first=John"` gives
  `{ "name.obj": { first: "John" } }`.
- Unless `plainObjects` or `allowPrototypes` is set, a parameter whose
  top-level key or bracket content names a property of `Object.prototype`
  (`toString`, `hasOwnProperty`, `__proto__`, ...) is ignored entirely.
  A `__proto__` segment is never assigned, even when allowed.
- With `plainObjects` the result and every object inside it are created with
  a `null` prototype.

### Arrays

- `[]` appends: `"a[]=b&a[]=c"` gives `{ a: ["b", "c"] }`. With
  `allowEmptyArrays`, `"a[]="` (or `"a[]"` with `strictNullHandling`)
  gives an empty array.
- `[n]` creates an array when `n` is written as a canonical non-negative
  integer and `n < arrayLimit`; indices are ordered and the array is
  compacted, so `"a[1]=c&a[0]=b"` gives `["b", "c"]` and `"a[1]=b&a[15]=c"`
  gives `["b", "c"]`. `allowSparse` keeps the holes instead. An index of
  `arrayLimit` or more makes an object with that key (`"a[100]=b"` gives
  `{ a: { "100": "b" } }`); with `throwOnLimitExceeded` it throws. A top-level
  key is never an index (`"0=a"` gives `{ "0": "a" }`).
- `parseArrays: false` makes `[]` and `[n]` produce objects (`"a[]=b"` gives
  `{ a: { "0": "b" } }`); duplicate plain keys may still combine into arrays.
- `arrayLimit` is the most elements any array may hold. An array that would
  grow beyond it (by `[]`, combining duplicates, comma splitting or merging)
  becomes an object keyed by index that keeps every element, and later values
  appended to it take the next index. With `throwOnLimitExceeded` any of
  these throws instead, including a comma value with more than `arrayLimit`
  elements. Holes are not counted as elements.

### Merging

Parameters are merged into the result in order:

- Objects merge key by key, recursively. Arrays merge index by index; when
  both hold an object at the same index those objects merge, otherwise the
  new item is appended at the end.
- Mixing an array with an object turns the array into an object keyed by index
  (`"a[0]=b&a[b]=c"` gives `{ a: { "0": "b", b: "c" } }`). Mixing a plain
  value with an array or object prepends or appends it (`"a=b&a[]=c"` gives
  `["b", "c"]`).
- When a key holds both an object and a plain value, `strictMerge` (the
  default) wraps them in an array in arrival order (`"a[b]=c&a=d"` gives
  `{ a: [{ b: "c" }, "d"] }`; further plain values are appended to that
  container); with `strictMerge: false` the plain value becomes a key set to
  `true` (`{ a: { b: "c", d: true } }`).

### Object input

A non-string `str` is treated as already-split key/value pairs: each own key
is parsed as a key, values are used as they are (not decoded; `comma` still
splits string values), and the input and its nested arrays and plain objects
are copied, never mutated.

## Stringifying

### Defaults

`addQueryPrefix: false`, `allowDots: false`, `allowEmptyArrays: false`,
`arrayFormat: "indices"`, `charset: "utf-8"`, `charsetSentinel: false`,
`commaRoundTrip: false`, `delimiter: "&"`, `depth: Infinity`, `encode: true`,
`encodeDotInKeys: false`, `encodeValuesOnly: false`, `format: "RFC3986"`,
`serializeDate` uses `Date.prototype.toISOString`, `skipNulls: false`,
`strictNullHandling: false`. Most options of the wrong type fall back to
their defaults, except for the validated options listed under Errors.

### Values

- A non-object (or `null`) input gives `""`. Keys are visited in
  `Object.keys` order (inherited properties are skipped), sorted with
  `sort` when given, at every level.
- Strings, numbers, booleans, bigints, symbols (as `Symbol(description)`)
  and Node `Buffer`s are written as `key=value`.
- Dates are passed through `serializeDate`.
- `null` is written as `key=` (as `key` alone with `strictNullHandling`);
  `skipNulls` omits it. `undefined` is always omitted.
- Objects and arrays recurse; one with nothing to write (`{}`, `[]`,
  `[{}]`) produces nothing. With `allowEmptyArrays` an empty array (with no
  other own keys) is written as the key followed by a literal `[]` and no
  `=`.
- A cyclic reference throws; the same object appearing twice without a cycle
  is fine. With a finite `depth`, values nested more than `depth` levels
  below the top-level keys throw (with `depth: 2`, `{ a: { b: { c: "d" } } }`
  is allowed and `{ a: { b: { c: { d: "e" } } } }` throws).
- `filter` as a function is called as `filter(prefix, value)` for the input
  itself (with prefix `""`) and for every value, and its return value is used
  instead (`undefined` omits the key). As an array it lists the keys and
  indices to write, in that order, at every level; the caller's array is not
  reordered.

### Arrays and objects

- `arrayFormat`: `"indices"` writes `a[0]=b&a[1]=c`, `"brackets"` writes
  `a[]=b&a[]=c`, `"repeat"` writes `a=b&a=c` and `"comma"` writes `a=b,c`.
  Without `arrayFormat`, `indices: false` selects `"repeat"` and
  `indices: true` selects `"indices"`. Only the four own format names are
  recognised.
- `"comma"` joins the array into one value (dates serialized, `null` as an
  empty element, nested objects coerced to strings) and writes nothing for an
  empty array. If the joined value is empty it is treated as `null`. With
  `commaRoundTrip`, a single-element array gets a `[]` suffix on its key so
  it parses back as an array. With `encodeValuesOnly` each element is
  encoded on its own and the separating commas stay literal; otherwise the
  joined string is encoded as a whole.
- Nested objects use brackets (`a[b][c]=d`), or dots with `allowDots`
  (`a.b.c=d`). `encodeDotInKeys` implies `allowDots` (unless `allowDots` is
  given) and writes literal dots in keys as `%2E` (then encoded again to
  `%252E` unless `encodeValuesOnly`): top-level keys always, nested keys only
  when `allowDots` is true.

### Encoding

- With `encode` (the default), keys and values are encoded with
  `encoder(value, defaultEncoder, charset, "key" | "value", format)`;
  `encodeValuesOnly` leaves keys as they are, and `encode: false` turns all
  encoding off (`encoder` is then not called).
- The default encoder percent-encodes the UTF-8 bytes of every character
  except `A-Z a-z 0-9 - . _ ~`. `RFC1738` also leaves `(` and `)`
  unencoded; `WHATWG` also leaves `*` unencoded but encodes `~`. A lone
  surrogate is encoded as U+FFFD (`%EF%BF%BD`). Non-string values are
  converted with `String` first.
- With `charset: "iso-8859-1"`, the default encoder uses `escape`, characters
  outside Latin-1 become percent-encoded numeric entities (`☺` becomes
  `%26%239786%3B`) and `+` becomes `%2B`, in every format.
- After encoding, the format's formatter is applied to each key and value:
  `RFC1738` and `WHATWG` turn `%20` into `+`, `RFC3986` changes nothing.
- The parts are joined with `delimiter`. `addQueryPrefix` prepends `?`, and
  `charsetSentinel` prepends `utf8=%E2%9C%93` (`utf8=%26%2310003%3B` for
  iso-8859-1) and the delimiter. An empty result is `""` with no prefix.

## formats

`formats.RFC1738`, `formats.RFC3986` and `formats.WHATWG` are the format
names, `formats.default` is `"RFC3986"`, and `formats.formatters` maps each
name to its formatter (`RFC1738` and `WHATWG` replace `%20` with `+`,
`RFC3986` returns its input).

## Errors

`parse` throws `TypeError` with these messages:

- `allowEmptyArrays` not a boolean: `\`allowEmptyArrays\` option can only be \`true\` or \`false\`, when provided`
- `decodeDotInKeys` not a boolean: `\`decodeDotInKeys\` option can only be \`true\` or \`false\`, when provided`
- `decoder` not a function, `null` or `undefined`: `Decoder has to be a function.`
- other `charset` values: `The charset option must be either utf-8, iso-8859-1, or undefined`
- `throwOnLimitExceeded` not a boolean: `\`throwOnLimitExceeded\` option must be a boolean`
- other `duplicates` values: `The duplicates option must be either combine, first, or last`

and `RangeError` with:

- `Parameter limit exceeded. Only N parameters allowed.` (`parameter` when N is 1)
- `Array limit exceeded. Only N elements allowed in an array.` (`element` when N is 1)
- `Input depth exceeded depth option of N and strictDepth is true`

`stringify` throws `TypeError` with the same `allowEmptyArrays` and `charset`
messages, `\`encodeDotInKeys\` option can only be \`true\` or \`false\`, when provided`,
`Encoder has to be a function.`, `Unknown format option provided.` and
`\`commaRoundTrip\` must be a boolean, or absent` (when the key is present
with a non-boolean value), and `RangeError` with `Cyclic object value` or
`Input depth exceeded depth option of N`.

## Examples

```ts
parse("a=c") // { a: "c" }
parse("foo[bar][baz]=foobarbaz") // { foo: { bar: { baz: "foobarbaz" } } }
parse("a%5Bb%5D=c") // { a: { b: "c" } }
parse("a[b][c][d][e][f][g][h][i]=j") // { a: { b: { c: { d: { e: { f: { "[g][h][i]": "j" } } } } } } }
parse("a=b&c=d", { parameterLimit: 1 }) // { a: "b" }
parse("a=b;c=d,e=f", { delimiter: /[;,]/ }) // { a: "b", c: "d", e: "f" }
parse("a[]=b&a[]=c") // { a: ["b", "c"] }
parse("a[1]=2&a[3]=5", { allowSparse: true }) // { a: [, "2", , "5"] }
parse("a[0]=b&a[b]=c") // { a: { "0": "b", b: "c" } }
parse("foo=bar&foo=baz", { duplicates: "last" }) // { foo: "baz" }
parse("a=%A7", { charset: "iso-8859-1" }) // { a: "§" }
parse("a&b=", { strictNullHandling: true }) // { a: null, b: "" }

stringify({ a: { b: "c" } }) // "a%5Bb%5D=c"
stringify({ a: { b: "c" } }, { encode: false }) // "a[b]=c"
stringify({ a: "b", c: ["d", "e=f"] }, { encodeValuesOnly: true }) // "a=b&c[0]=d&c[1]=e%3Df"
stringify({ a: ["b", "c"] }, { arrayFormat: "brackets", encode: false }) // "a[]=b&a[]=c"
stringify({ a: ["b", "c"] }, { arrayFormat: "comma", encode: false }) // "a=b,c"
stringify({ a: { b: { c: "d" } } }, { allowDots: true }) // "a.b.c=d"
stringify({ a: null, b: undefined }) // "a="
stringify({ a: "b c" }, { format: "RFC1738" }) // "a=b+c"
stringify({ a: "b c~*()" }, { format: "WHATWG" }) // "a=b+c%7E*%28%29"
stringify({ a: "☺" }, { charset: "iso-8859-1" }) // "a=%26%239786%3B"
stringify({ a: "☺" }, { charsetSentinel: true }) // "utf8=%E2%9C%93&a=%E2%98%BA"
stringify({ a: "b", c: "d" }, { addQueryPrefix: true }) // "?a=b&c=d"
```
