Implement `deep-equal`'s comparison of binary data: `deepEqual(a, b, opts)`
returns whether two values are deeply equal, loosely by default or strictly
with `{ strict: true }`, and typed arrays, Node `Buffer`s, `ArrayBuffer`s and
`SharedArrayBuffer`s are compared by content.

```ts
export default function deepEqual(a: unknown, b: unknown, opts?: { strict?: boolean }): boolean
```

General rules, which also apply to containers holding binary values:

- Identical values are equal (`===` loosely, `Object.is` strictly). When
  neither value is an object, loose mode uses `==` and strict mode
  `Object.is`. A primitive never equals an object.
- Objects must have the same `Object.prototype.toString` tag, both or
  neither must be arrays, and in strict mode they must share a
  `[[Prototype]]`. Plain objects and arrays are compared by their own
  enumerable string keys and the values under them.

Binary data (recognised by internal slots, never by `instanceof`,
`constructor` or `Symbol.toStringTag`, so an object that only pretends to be
a typed array is not one):

- Typed arrays (`Int8Array` through `BigUint64Array`, `Float16Array` where
  available) must be the same kind, have the same `length`, and the same
  elements compared with `===` in both modes, so a `NaN` element never
  matches and `0` matches `-0`. No other keys are compared. A typed array
  never equals a plain array with the same numbers.
- Node `Buffer`s are `Uint8Array`s and compare the same way, so a `Buffer`
  equals a `Uint8Array` with the same bytes in loose mode, but not in strict
  mode, where their prototypes differ.
- `ArrayBuffer`s and `SharedArrayBuffer`s must be the same kind, have the
  same real byte length (an own `byteLength` property that lies does not
  count) and the same bytes. An `ArrayBuffer` never equals a view of it.
- `deepEqual` never throws.

```ts
deepEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])) // true
deepEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])) // false
deepEqual(new Uint8Array(4), new Int8Array(4)) // false
deepEqual(new Float64Array([NaN]), new Float64Array([NaN]), { strict: true }) // false
deepEqual(new ArrayBuffer(8), new ArrayBuffer(8)) // true
deepEqual(Buffer.from("ab"), new Uint8Array([97, 98])) // true
```
