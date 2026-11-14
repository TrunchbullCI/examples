Hand-roll three of lodash's most used helpers: `debounce` and `throttle`,
which rate-limit a function, and `cloneDeep`, which deep-copies a value.
Write them as one module with three named exports and no dependencies; the
behaviour must match lodash 4 exactly, edge cases included.

## API

```ts
export interface DebounceSettings {
  leading?: boolean
  maxWait?: number
  trailing?: boolean
}

export interface ThrottleSettings {
  leading?: boolean
  trailing?: boolean
}

export interface DebouncedFunc<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T> | undefined
  cancel(): void
  flush(): ReturnType<T> | undefined
}

export function debounce<T extends (...args: any[]) => any>(func: T, wait?: number, options?: DebounceSettings): DebouncedFunc<T>
export function throttle<T extends (...args: any[]) => any>(func: T, wait?: number, options?: ThrottleSettings): DebouncedFunc<T>
export function cloneDeep<T>(value: T): T
```

## debounce(func, wait = 0, options = {})

Creates a debounced function that delays invoking `func` until `wait`
milliseconds have elapsed since the last time the debounced function was
called. The debounced function has a `cancel` method to cancel a delayed
invocation and a `flush` method to invoke it immediately. `options`
choose whether `func` is invoked on the leading and/or trailing edge of the
`wait` timeout, and `maxWait` bounds how long it may be delayed.

- `func` must be a function; anything else throws `TypeError` with the
  message `Expected a function` when `debounce` is called.
- `wait` is converted with `Number` (`"30"` is 30); `NaN` and a missing
  `wait` mean 0.
- `options` is only read when it is an object (or a function). `leading`
  defaults to `false` and `trailing` to `true`; both are read as booleans
  (`!!value`), and a `trailing` key that is present but `undefined` means
  `false`. When the key `maxWait` is present (even with the value
  `undefined`), the maximum delay is `Math.max(Number(maxWait) || 0, wait)`.
- Time comes from `Date.now()` and the timer from `setTimeout` /
  `clearTimeout`, read when they are called.
- A call records its arguments and `this` and the time of the call. When
  nothing is pending, the call starts the `wait` timer and, with
  `leading`, invokes `func` at once (the leading edge).
- When the timer fires, `func` is invoked with the most recent arguments and
  `this` if `wait` milliseconds have passed since the last call (the
  trailing edge); otherwise the timer is restarted for the remaining time
  (with `maxWait`, the smaller of the remaining wait and the remaining
  `maxWait`). A clock that has gone backwards counts as the trailing edge.
- The trailing invocation happens only when `trailing` is enabled and the
  function was called since the last invocation, so with both `leading`
  and `trailing` a single call invokes `func` once, on the leading edge.
- With `maxWait`, `func` is never delayed more than `maxWait` milliseconds
  after its last invocation: a call made when `maxWait` has elapsed (while a
  timer is pending) restarts the `wait` timer and invokes `func`
  immediately.
- Every call returns the result of the most recent invocation of `func`
  (`undefined` before the first one), or the new result when the call
  itself invoked `func`.
- `cancel()` clears the timer and forgets the pending arguments and the
  call history, so the next call behaves like a first call.
- `flush()` returns the last result when no timer is pending; otherwise it
  ends the wait now: it clears the pending state, invokes `func` if a
  trailing call is due, and returns the latest result.
- A call made from inside `func` is recorded like any other call.

## throttle(func, wait = 0, options = {})

Creates a throttled function that invokes `func` at most once every
`wait` milliseconds, with the same `cancel` and `flush` methods.

- `throttle(func, wait, options)` behaves exactly like
  `debounce(func, wait, { leading, maxWait: wait, trailing })`: it invokes
  `func` at most once per `wait` milliseconds, on the leading edge and,
  if the throttled function was called again during the wait, on the
  trailing edge.
- `leading` and `trailing` both default to `true`; a key that is present
  is read as a boolean (`!!value`). `options` is only read when it is an
  object (or a function).
- `func` must be a function; anything else throws `TypeError` with the
  message `Expected a function`.

## cloneDeep(value)

Recursively clones `value`, loosely following the structured clone
algorithm.

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

## Examples

```ts
const save = debounce(() => persist(), 250, { maxWait: 1000 })
save(); save(); save() // persist runs once, 250 ms after the last call
save.flush() // run a pending call now
save.cancel() // drop a pending call

const click = debounce(sendMail, 300, { leading: true, trailing: false })
click() // sends at once; further clicks within 300 ms are ignored
```

```ts
const onScroll = throttle(updatePosition, 100)
const onResize = throttle(relayout, 100, { trailing: false })

const original = { list: [1, { a: 2 }], when: new Date(0), byId: new Map([[1, { id: 1 }]]) }
const copy = cloneDeep(original)
copy.list[1] === original.list[1] // false
copy.when.getTime() // 0

const cyclic: any = { name: "root" }
cyclic.self = cyclic
const clone = cloneDeep(cyclic)
clone.self === clone // true

cloneDeep(() => 1) // {}
cloneDeep({ handler: Math.max }).handler === Math.max // true
```
