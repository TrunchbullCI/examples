Implement `deep-equal`'s comparison of `Map`s and `Set`s:
`deepEqual(a, b, opts)` returns whether two values are deeply equal, loosely
by default or strictly with `{ strict: true }`, and collections are compared
by content following Node's `assert.deepEqual` / `assert.deepStrictEqual`
algorithm.

```ts
export default function deepEqual(a: unknown, b: unknown, opts?: { strict?: boolean }): boolean
```

General rules, which also apply to collection members and values:

- Identical values are equal (`===` loosely, `Object.is` strictly). When
  neither value is an object, loose mode uses `==` and strict mode
  `Object.is`. A primitive never equals an object.
- Objects must have the same `Object.prototype.toString` tag, both or
  neither must be arrays, and in strict mode they must share a
  `[[Prototype]]`. Their own enumerable string keys must match as a set and
  the values under each key must be deep-equal.

Collections (recognised by brand, not by `instanceof`):

- A `Map`, `Set`, `WeakMap` or `WeakSet` only equals a collection of the
  same kind. Weak collections are equal whenever the general checks pass;
  their contents cannot be inspected.
- The sizes must match, and any own enumerable properties on the collection
  objects are compared like object keys.
- Set members are matched one to one, regardless of insertion order. A
  primitive member is first looked up directly in the other set (`NaN`
  finds `NaN`, `0` finds `-0`). Object members, and in loose mode
  primitives whose only counterpart is a loosely equal primitive (`1` and
  `"1"`), are matched against any not-yet-matched deep-equal member of the
  other set. Object members of sets are matched with loose rules even in
  strict mode.
- Map entries with a primitive key are looked up by that key and their values
  compared deeply. Entries with object keys, and in loose mode entries whose
  primitive key only has a loosely equal counterpart, are matched one to one
  against unmatched entries of the other map whose key and value are both
  deep-equal.
- A `Map` never equals a `Set`, even with the same entries. `deepEqual`
  never throws.

```ts
deepEqual(new Set([1, 2]), new Set([2, 1])) // true
deepEqual(new Set([{ a: 1 }]), new Set([{ a: 1 }])) // true
deepEqual(new Set([1]), new Set(["1"])) // true
deepEqual(new Set([1]), new Set(["1"]), { strict: true }) // false
deepEqual(new Map([[{ k: 1 }, "v"]]), new Map([[{ k: 1 }, "v"]])) // true
deepEqual(new Map([["a", 1]]), new Map([["a", 2]])) // false
```
