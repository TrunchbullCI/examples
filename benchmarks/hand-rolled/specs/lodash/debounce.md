Implement lodash's `debounce`: `debounce(func, wait, options)` creates a
debounced function that delays invoking `func` until `wait` milliseconds
have elapsed since the last time the debounced function was called, with
`leading`, `trailing` and `maxWait` options and `cancel` / `flush`
methods. The behaviour must match lodash 4 exactly.

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
```

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

```ts
const save = debounce(() => persist(), 250, { maxWait: 1000 })
save(); save(); save() // persist runs once, 250 ms after the last call
save.flush() // run a pending call now
save.cancel() // drop a pending call

const click = debounce(sendMail, 300, { leading: true, trailing: false })
click() // sends at once; further clicks within 300 ms are ignored
```
