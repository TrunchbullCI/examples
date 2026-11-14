Implement the nesting and array formats of `qs.stringify`:
`stringify(object, options)` turns a nested object into a query string,
writing nested objects with brackets (or dots) and arrays in one of four
formats.

```ts
export interface StringifyOptions {
  allowDots?: boolean
  allowEmptyArrays?: boolean
  arrayFormat?: "indices" | "brackets" | "repeat" | "comma"
  commaRoundTrip?: boolean
  encode?: boolean
  encodeValuesOnly?: boolean
  indices?: boolean
  skipNulls?: boolean
  strictNullHandling?: boolean
}

export function stringify(object: unknown, options?: StringifyOptions): string
```

The module exports `stringify`. Defaults: `allowDots: false`,
`allowEmptyArrays: false`, `arrayFormat: "indices"`, `commaRoundTrip: false`,
`encode: true`, `encodeValuesOnly: false`, `skipNulls: false`,
`strictNullHandling: false`. The options object is never mutated.

## Values

- A non-object (or `null`) input gives `""`. Keys are visited in
  `Object.keys` order at every level; inherited properties are skipped.
- Strings, numbers and booleans are written as `key=value`. Dates are written
  with `toISOString()`.
- `null` is written as `key=` (as `key` alone with `strictNullHandling`);
  `skipNulls` omits it. `undefined` is always omitted.
- Objects and arrays recurse; one with nothing to write (`{}`, `[]`,
  `[{}]`) produces nothing. With `allowEmptyArrays` an empty array (with no
  other own keys) is written as the key followed by a literal `[]` and no
  `=`.
- A cyclic reference throws `RangeError`: `Cyclic object value`. The same
  object appearing twice without a cycle is fine.
- Parts are joined with `&`.

## Arrays and objects

- `arrayFormat`: `"indices"` writes `a[0]=b&a[1]=c`, `"brackets"` writes
  `a[]=b&a[]=c`, `"repeat"` writes `a=b&a=c` and `"comma"` writes `a=b,c`.
  Nested arrays repeat the pattern (`a[0][0]=b`, `a[][]=b`). Without
  `arrayFormat`, `indices: false` selects `"repeat"` and `indices: true`
  selects `"indices"`. Only the four own format names are recognised.
- `"comma"` joins the array into one value (dates as ISO strings, `null` and
  `undefined` as empty elements, nested objects and arrays coerced to
  strings) and writes nothing for an empty array. If the joined value is
  empty it is treated as `null`. With `commaRoundTrip`, a single-element
  array gets a `[]` suffix on its key so it parses back as an array.
- Objects use brackets (`a[b][c]=d`), or dots with `allowDots` (`a.b.c=d`);
  array indices always use brackets.

## Encoding

- With `encode` (the default), keys and values are percent-encoded;
  `encodeValuesOnly` leaves keys as they are and `encode: false` turns
  encoding off.
- Encoding writes the UTF-8 bytes of every character as `%XX` (uppercase
  hex) except `A-Z a-z 0-9 - . _ ~`. A lone surrogate is encoded as U+FFFD
  (`%EF%BF%BD`). Numbers and booleans are converted with `String` first.
- In `"comma"` format with `encodeValuesOnly`, each element is encoded on
  its own and the separating commas stay literal; otherwise the joined string
  is encoded as a whole (commas become `%2C`).

## Errors

- `allowEmptyArrays` that is not a boolean throws `TypeError`:
  `\`allowEmptyArrays\` option can only be \`true\` or \`false\`, when provided`
- A `commaRoundTrip` key that is present with a non-boolean value throws
  `TypeError`: `\`commaRoundTrip\` must be a boolean, or absent`

```ts
stringify({ a: { b: "c" } }) // "a%5Bb%5D=c"
stringify({ a: ["b", "c"] }, { encode: false }) // "a[0]=b&a[1]=c"
stringify({ a: ["b", "c"] }, { arrayFormat: "brackets", encode: false }) // "a[]=b&a[]=c"
stringify({ a: ["b", "c"] }, { indices: false }) // "a=b&a=c"
stringify({ a: ["b", "c"] }, { arrayFormat: "comma" }) // "a=b%2Cc"
stringify({ a: ["b"] }, { arrayFormat: "comma", commaRoundTrip: true, encode: false }) // "a[]=b"
stringify({ a: { b: { c: "d" } } }, { allowDots: true }) // "a.b.c=d"
stringify({ foo: [], bar: "baz" }, { allowEmptyArrays: true }) // "foo[]&bar=baz"
stringify({ a: null, b: "" }, { strictNullHandling: true }) // "a&b="
```
