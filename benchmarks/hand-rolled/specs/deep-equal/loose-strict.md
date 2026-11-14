Implement the core of `deep-equal`: `deepEqual(a, b, opts)` compares two
values recursively and returns whether they are equal, loosely by default
(like Node's `assert.deepEqual`) or strictly with `{ strict: true }` (like
`assert.deepStrictEqual`). This feature covers primitives, plain objects,
class instances, null-prototype objects, arrays, functions and circular
structures.

```ts
export default function deepEqual(a: unknown, b: unknown, opts?: { strict?: boolean }): boolean
```

- Identical values are equal: `===` in loose mode, `Object.is` in strict
  mode. So `NaN` equals `NaN` only in strict mode, and `0` and `-0` are
  equal only in loose mode.
- A primitive never equals an object (`3` and `[3]` differ, as do `true`
  and `[]`).
- When neither value is an object (or one of them is `null`/`undefined`),
  loose mode compares with `==` (`"3" == 3`, `null == undefined`,
  `false == "-000"`) and strict mode with `Object.is`. Two distinct
  functions are never equal; a function never equals a plain object.
- Two objects must have the same `typeof` and the same
  `Object.prototype.toString` tag, and both or neither must be arrays.
- In strict mode they must also have the same `[[Prototype]]`; in loose mode
  the prototypes are ignored (`{}` equals an instance of an empty class).
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
- `deepEqual` never throws.

```ts
deepEqual({ a: [2, 3], b: [4] }, { b: [4], a: [2, 3] }) // true
deepEqual([{ a: 3 }, { b: 4 }], [{ a: "3" }, { b: "4" }]) // true
deepEqual([{ a: 3 }, { b: 4 }], [{ a: "3" }, { b: "4" }], { strict: true }) // false
deepEqual([], {}) // false
deepEqual(null, undefined) // true
deepEqual(null, undefined, { strict: true }) // false
```
