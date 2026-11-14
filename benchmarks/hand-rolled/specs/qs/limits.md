Implement the limits of `qs.parse`: `parse(str, options)` turns a query
string into a nested object (`"a[b]=c"` becomes `{ a: { b: "c" } }`) while
bounding how deep keys nest, how many parameters are read and how large
arrays may grow, either silently or by throwing.

```ts
export interface ParseOptions {
  allowSparse?: boolean
  arrayLimit?: number
  depth?: number | false
  parameterLimit?: number
  parseArrays?: boolean
  strictDepth?: boolean
  strictNullHandling?: boolean
  throwOnLimitExceeded?: boolean
}

export function parse(str: string | null | undefined, options?: ParseOptions): Record<string, unknown>
```

The module exports `parse`. Defaults: `allowSparse: false`, `arrayLimit: 20`,
`depth: 5`, `parameterLimit: 1000`, `parseArrays: true`, `strictDepth: false`,
`strictNullHandling: false`, `throwOnLimitExceeded: false`. Numeric options
that are not numbers fall back to their defaults; `depth` also accepts
`false` (same as `0`).

## Parsing

- `""`, `null` and `undefined` parse to an empty object. Values are always
  strings (or `null`, see below).
- Before splitting, every `%5B`/`%5D` (any case) in the whole string becomes
  a literal `[`/`]`. The string is split on `&`. Only the first `parameterLimit` parts are used (`Infinity` means no
  limit).
- Each part is split into key and value at the `=` of its first `]=`, or,
  if it has none, at its first `=`. A part without `=` gets the value `""`
  (`null` with `strictNullHandling`). Empty parts and empty keys are skipped.
- Keys and values are decoded by turning `+` into a space and then applying
  `decodeURIComponent`; if that throws, the text (with `+` replaced) is
  used as it is.
- Repeated identical keys (after decoding) are combined into an array of
  their values (`"a=b&a=c"` gives `{ a: ["b", "c"] }`).
- Keys nest with square brackets: the text before the first `[` is the
  top-level key and each following balanced bracket group is one more level.
  Text between groups is dropped, an unterminated group keeps the rest of the
  key (from its `[`) as one literal segment, and a key starting with `[` has
  no top-level segment of its own (`"[a]=b"` gives `{ a: "b" }`).
- A parameter whose top-level key or bracket content names a property of
  `Object.prototype` (`toString`, `__proto__`, ...) is ignored.
- `[]` appends to an array and `[n]` (a canonical non-negative integer)
  places a value at index `n`. Arrays are compacted (`"a[1]=b&a[15]=c"` gives
  `{ a: ["b", "c"] }`) unless `allowSparse` keeps the holes.
  `parseArrays: false` makes `[]` and `[n]` produce objects keyed by index
  (`"a[]=b"` gives `{ a: { "0": "b" } }`). A top-level key is never an index.
- Parameters merge in order: objects key by key; arrays index by index (two
  objects at the same index merge, anything else is appended); an array mixed
  with an object becomes an object keyed by index; a plain value mixed with an
  array or object is prepended or appended (`"a=b&a[]=c"` gives
  `["b", "c"]`); an object and a plain value under one key are wrapped in an
  array in arrival order (`"a[b]=c&a=d"` gives `{ a: [{ b: "c" }, "d"] }`),
  and further plain values are appended to that container.

## Depth

- At most `depth` bracket groups are split off a key; the rest of the key,
  from the next `[`, becomes one literal key. With `depth: 1`,
  `"a[b][c][d]=e"` gives `{ a: { b: { "[c][d]": "e" } } }`.
- `depth: 0` or less (or `false`) never splits keys; it only strips one pair of
  brackets that wraps the whole key, and `strictDepth` never throws then.
- With `strictDepth`, a key with more bracket groups than `depth` throws
  `RangeError`: `Input depth exceeded depth option of N and strictDepth is true`.
  A key with exactly `depth` groups is fine.

## Parameters

- Parts beyond `parameterLimit` are ignored. With `throwOnLimitExceeded`,
  more than `parameterLimit` parts throw `RangeError`:
  `Parameter limit exceeded. Only N parameters allowed.` (`parameter` when N
  is 1). `Infinity` never throws.

## Arrays

- `arrayLimit` is the most elements any array may hold. An index `[n]` with
  `n >= arrayLimit` makes an object with that key instead
  (`"a[100]=b"` gives `{ a: { "100": "b" } }` by default). An array that
  would grow beyond `arrayLimit` elements, by `[]`, by combining duplicate
  keys or by merging, becomes an object keyed by index that keeps every
  element, and values appended to it later take the next index. Holes are not
  counted as elements. A zero or negative `arrayLimit` therefore turns every
  array into an object.
- With `throwOnLimitExceeded`, each of those cases throws `RangeError`
  instead: `Array limit exceeded. Only N elements allowed in an array.`
  (`element` when N is 1). Plain values and objects are never affected.
- `throwOnLimitExceeded` that is not a boolean throws `TypeError`:
  `\`throwOnLimitExceeded\` option must be a boolean`

```ts
parse("a=b&c=d", { parameterLimit: 1 }) // { a: "b" }
parse("a=1&b=2&c=3&d=4", { parameterLimit: 3, throwOnLimitExceeded: true }) // throws RangeError "Parameter limit exceeded. Only 3 parameters allowed."
parse("a[1]=b", { arrayLimit: 0 }) // { a: { "1": "b" } }
parse("a[]=1&a[]=2&a[]=3", { arrayLimit: 2 }) // { a: { "0": "1", "1": "2", "2": "3" } }
parse("a[b][c][d]=e", { depth: 1, strictDepth: true }) // throws RangeError "Input depth exceeded depth option of 1 and strictDepth is true"
```
