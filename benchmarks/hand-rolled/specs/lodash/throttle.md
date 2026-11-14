Implement lodash's `throttle`: `throttle(func, wait, options)` creates a
throttled function that invokes `func` at most once every `wait`
milliseconds, with `leading` and `trailing` options and `cancel` /
`flush` methods. The behaviour must match lodash 4 exactly.

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

export function throttle<T extends (...args: any[]) => any>(func: T, wait?: number, options?: ThrottleSettings): DebouncedFunc<T>
```

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

lodash builds `throttle` on its `debounce` (with `maxWait` equal to `wait`), whose rules apply:

- `wait` is converted with `Number` (`"30"` is 30); `NaN` and a missing
  `wait` mean 0.
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

```ts
const onScroll = throttle(updatePosition, 100)
onScroll() // updatePosition runs now
onScroll() // and once more 100 ms later, with the latest arguments
const onResize = throttle(relayout, 100, { trailing: false })
onScroll.cancel()
```
