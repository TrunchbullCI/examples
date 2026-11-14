Implement the nested-key half of `qs.parse`: `parse(str, options)` turns a
query string into a nested object by reading square brackets (and, if asked,
dots) in keys: `"foo[bar]=baz"` becomes `{ foo: { bar: "baz" } }`.

```ts
export interface ParseOptions {
  allowDots?: boolean
  allowEmptyArrays?: boolean
  allowPrototypes?: boolean
  allowSparse?: boolean
  decodeDotInKeys?: boolean
  depth?: number | false
  parseArrays?: boolean
  plainObjects?: boolean
  strictMerge?: boolean
  strictNullHandling?: boolean
}

export function parse(str: string | null | undefined, options?: ParseOptions): Record<string, unknown>
```

The module exports `parse`. Defaults: `allowDots: false`,
`allowEmptyArrays: false`, `allowPrototypes: false`, `allowSparse: false`,
`decodeDotInKeys: false`, `depth: 5`, `parseArrays: true`,
`plainObjects: false`, `strictMerge: true`, `strictNullHandling: false`.
The options object is never mutated.

## Splitting and decoding

- `""`, `null` and `undefined` parse to an empty object. Values are always
  strings (or `null`, see below).
- Before splitting, every `%5B`/`%5D` (any case) in the whole string becomes
  a literal `[`/`]`. The string is split on `&`, and only the first 1000 parts are used.
- Each part is split into key and value at the `=` of its first `]=`, or,
  if it has none, at its first `=`. A part without `=` gets the value `""`
  (`null` with `strictNullHandling`). Empty parts and empty keys are skipped.
- Keys and values are decoded by turning `+` into a space and then applying
  `decodeURIComponent`; if that throws, the text (with `+` replaced) is
  used as it is.
- Repeated identical keys (after decoding) are combined into an array of
  their values (`"a=b&a=c"` gives `{ a: ["b", "c"] }`).

## Keys and nesting

- The text before the first `[` is the top-level key; each following balanced
  bracket group (brackets inside a group are kept literally, as in
  `"a[b[c]]"`) is one more level. Text after a group and before the next `[`
  is dropped (`"a[b]x=c"` gives `{ a: { b: "c" } }`). An unterminated group
  keeps the rest of the key, from its `[`, as one literal segment. A key that
  starts with `[` has no top-level segment of its own, so `"[foo]=bar"` gives
  `{ foo: "bar" }`.
- At most `depth` bracket groups are split off; the rest of the key, from
  the next `[`, becomes one literal key: by default
  `"a[b][c][d][e][f][g][h][i]=j"` gives
  `{ a: { b: { c: { d: { e: { f: { "[g][h][i]": "j" } } } } } } }`.
  `depth: 0` or less (or `false`) never splits keys; it only strips one pair of
  brackets that wraps the whole key.
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
  (`toString`, `hasOwnProperty`, `__proto__`, ...) is ignored entirely. A
  `__proto__` segment is never assigned, even when allowed.
- With `plainObjects` the result and every object inside it are created with
  a `null` prototype.

## Arrays

- `[]` appends: `"a[]=b&a[]=c"` gives `{ a: ["b", "c"] }`. With
  `allowEmptyArrays`, `"a[]="` (or `"a[]"` with `strictNullHandling`)
  gives an empty array.
- `[n]` creates an array when `n` is written as a canonical non-negative
  integer below 20; indices are ordered and the array is compacted, so
  `"a[1]=c&a[0]=b"` and `"a[1]=b&a[15]=c"` both give two-element arrays.
  `allowSparse` keeps the holes instead. An index of 20 or more makes an
  object with that key (`"a[100]=b"` gives `{ a: { "100": "b" } }`). A
  top-level key is never an index (`"0=a"` gives `{ "0": "a" }`).
- No array holds more than 20 elements: an array that would grow beyond that
  becomes an object keyed by index that keeps every element.
- `parseArrays: false` makes `[]` and `[n]` produce objects (`"a[]=b"` gives
  `{ a: { "0": "b" } }`); duplicate plain keys still combine into arrays.

## Merging

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

## Errors

- `allowEmptyArrays` that is not a boolean throws `TypeError`:
  `\`allowEmptyArrays\` option can only be \`true\` or \`false\`, when provided`
- `decodeDotInKeys` that is not a boolean throws `TypeError`:
  `\`decodeDotInKeys\` option can only be \`true\` or \`false\`, when provided`

```ts
parse("a[b][c]=d") // { a: { b: { c: "d" } } }
parse("a[b][c]=d", { depth: 1 }) // { a: { b: { "[c]": "d" } } }
parse("a.b=c", { allowDots: true }) // { a: { b: "c" } }
parse("a[][b]=c") // { a: [{ b: "c" }] }
parse("a[hasOwnProperty]=b", { plainObjects: true }) // null-prototype { a: { hasOwnProperty: "b" } }
parse("a[1]=2&a[3]=5", { allowSparse: true }) // { a: [, "2", , "5"] }
parse("foo[]&bar=baz", { allowEmptyArrays: true }) // { foo: [], bar: "baz" }
```
