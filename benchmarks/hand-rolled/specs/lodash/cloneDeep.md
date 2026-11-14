Implement lodash's `cloneDeep`: `cloneDeep(value)` recursively clones
`value`, loosely following the structured clone algorithm. The behaviour
must match lodash 4 exactly.

```ts
export function cloneDeep<T>(value: T): T
```

- Primitives (including symbols and bigints) are returned as they are.
- Plain objects, `arguments` objects and class instances are copied
  property by property: own enumerable string keys and own enumerable symbol
  keys, read with `value[key]` (getters are read, the copy holds data
  properties). Non-enumerable and inherited properties are not copied. A
  `__proto__` own key is copied as an own property.
- The copy of an object keeps its prototype (`Object.create(proto)`) when
  its `constructor` property is a function and the object is not itself a
  prototype (`value === value.constructor.prototype`); otherwise, and for
  `arguments` objects, the copy is a plain `{}`.
- Arrays are copied with `new value.constructor(length)`, every index is
  assigned (holes become `undefined`), and the `index` and `input`
  properties of a `RegExp#exec` result are copied. Other non-index
  properties of arrays are not copied.
- `Date` and `Boolean` objects are rebuilt with `new Ctor(+value)`,
  `Number` and `String` objects with `new Ctor(value)`, `Symbol`
  objects with `Object(symbol)`, regular expressions with the same source
  and flags and the same `lastIndex`. `Map` values (not keys) and `Set`
  members are cloned into a new `Map` / `Set` in insertion order.
- An `ArrayBuffer` is copied byte for byte. Typed arrays and `DataView`s
  get a copy of their whole underlying buffer and keep their `byteOffset`
  and length. A Node.js `Buffer` is copied with `buffer.slice()`.
- These objects (other than arrays and Buffers) also get their own
  enumerable properties copied, so expando properties on a `Date`, a
  `RegExp`, a boxed primitive, a `Map` or a typed array survive.
- Functions, errors, `WeakMap`s, `WeakSet`s, promises and any other
  object type not listed above cannot be cloned: as the top-level value the
  result is an empty object `{}` (a function's own enumerable properties are
  copied into it), and nested inside a cloned value they are kept by
  reference.
- Circular and shared references are preserved: each source object is
  cloned once and every reference to it points at that one copy.

```ts
const original = { list: [1, { a: 2 }], when: new Date(0), byId: new Map([[1, { id: 1 }]]) }
const copy = cloneDeep(original)
copy.list[1] === original.list[1] // false
copy.byId.get(1) === original.byId.get(1) // false

const cyclic: any = { name: "root" }
cyclic.self = cyclic
const clone = cloneDeep(cyclic)
clone.self === clone // true

cloneDeep(() => 1) // {}
cloneDeep({ handler: Math.max }).handler === Math.max // true
```
