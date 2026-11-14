`deep-equal` is Node's `assert.deepEqual()` algorithm as a standalone module.
It compares two values recursively and returns whether they are equal, either
loosely (the default, like `assert.deepEqual`) or strictly (like
`assert.deepStrictEqual`). It is robust against values that lie about their
type: built-in types are recognised by their internal slots (brand checks),
not by `instanceof`, `constructor` or `Symbol.toStringTag`.

## API

```ts
export default function deepEqual(a: unknown, b: unknown, opts?: { strict?: boolean }): boolean
```

The module has a single default export, `deepEqual`. It never throws for any
pair of values.

## Primitives and identity

- Identical values are equal: `===` in loose mode, `Object.is` with
  `{ strict: true }`. So `NaN` equals `NaN` only in strict mode, and `0` and
  `-0` are equal only in loose mode.
- A primitive never equals an object, and a boxed primitive (`Object(1)`,
  `Object("a")`, `Object(true)`, boxed symbols and bigints) only equals a
  boxed primitive of the same kind; it never equals the primitive it wraps or
  a plain object.
- When neither value is an object (or one of them is `null`/`undefined`),
  loose mode compares with `==` (`"3" == 3`, `null == undefined`,
  `"" == 0`) and strict mode with `Object.is`. Two distinct functions are
  never equal.

## Objects

Two objects are equal when all of the following hold, checked in this order:

- Same `typeof` and the same `Object.prototype.toString` tag (so a custom
  `Symbol.toStringTag` makes objects differ).
- Both or neither are `arguments` objects, and both or neither are arrays.
- Both or neither are `instanceof Error`; two errors must also have the same
  `name` and `message`.
- Both or neither are regular expressions; two regular expressions must have
  the same `source` and `flags` (`lastIndex` is ignored).
- Both or neither are `Date`s; two dates must have the same `getTime()`
  (so two invalid dates differ), even if `getTime` was overridden.
- In strict mode, both have the same `[[Prototype]]`.
- Typed arrays must be the same kind (by internal slot, not by prototype or
  tag), have the same `length`, and the same elements compared with `===` in
  both modes (so a `NaN` element never matches, and `0` matches `-0`); no
  other keys are compared. Node `Buffer`s are compared the same way.
- `ArrayBuffer`s and `SharedArrayBuffer`s must be the same kind, have the
  same real byte length (an own `byteLength` property does not count) and
  the same bytes.
- Own enumerable string keys are compared (`Object.keys`): both objects must
  have the same number of keys and the same key names (order does not
  matter), and the values under each key must be deep-equal in the same mode.
  Symbol keys and non-enumerable properties are ignored; getters are invoked.
- Arrays only equal arrays, and an array never equals an array-like object.
  Array holes count as missing keys, so `[, 1]` and `[undefined, 1]` differ,
  and extra non-index properties on an array are compared like any other key.
- Circular structures are supported: the comparison remembers the objects it
  has visited, and when it reaches two objects that were first visited
  together it treats them as equal instead of recursing again.
- Both or neither are `Map`s, `Set`s, `WeakMap`s or `WeakSet`s (by brand).
  Weak collections are equal whenever the checks above pass; their contents
  cannot be inspected.
- Two boxed primitives of the same kind are compared as objects by the rules
  above, not by the value they wrap: `Object("a")` and `Object("b")` differ
  through their index keys, while `Object(1)` and `Object(2)` are equal.

## Maps and Sets

Collections are compared after their keys, following Node's
`assert.deepEqual` / `assert.deepStrictEqual` algorithm:

- The sizes must match.
- Set members are matched one to one. A primitive member is first looked up
  directly in the other set. Object members, and in loose mode primitives
  whose only counterpart is a loosely equal primitive (`1` and `"1"`),
  are matched against any not-yet-matched deep-equal member of the other set.
  Object members of sets are matched with loose rules even in strict mode.
- Map entries with a primitive key are looked up by that key and their values
  compared deeply. Entries with object keys, and in loose mode entries whose
  primitive key only has a loosely equal counterpart, are matched one to one
  against unmatched entries of the other map whose key and value are both
  deep-equal.

## Examples

```ts
deepEqual({ a: [2, 3], b: [4] }, { a: [2, 3], b: [4] }) // true
deepEqual({ x: 5, y: [6] }, { x: 5, y: 6 }) // false
deepEqual({ a: 2, b: "4" }, { a: 2, b: 4 }) // true
deepEqual({ a: 2, b: "4" }, { a: 2, b: 4 }, { strict: true }) // false
deepEqual(new Error("xyz"), new TypeError("xyz")) // false
deepEqual(new Set([1, 2]), new Set([2, 1])) // true
deepEqual(new Map([[1, "a"]]), new Map([["1", "a"]])) // true
deepEqual(new Map([[1, "a"]]), new Map([["1", "a"]]), { strict: true }) // false
deepEqual(new Uint8Array([1, 2]), new Int8Array([1, 2])) // false
```
