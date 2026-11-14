Implement the formatting half of `ms`: `ms(value, options)` turns a number
of milliseconds into a short or written-out duration.

```ts
export default function ms(value: number, options?: { long: boolean }): string
```

- Short format picks the largest unit among day (`d`), hour (`h`), minute
  (`m`) and second (`s`) whose size is at most the absolute value, and
  rounds with `Math.round`: `ms(60000)` is `"1m"`, `ms(-3 * 60000)` is
  `"-3m"`. Values below one second are printed as is with `ms`:
  `"500ms"`.
- With a truthy `long` option the units are written out: `day`, `hour`,
  `minute`, `second`, or `ms` after a space (`"500 ms"`). The unit is
  plural when the absolute value is at least 1.5 units:
  `ms(60000, { long: true })` is `"1 minute"`, `ms(90000, { long: true })`
  is `"2 minutes"`.
- A non-finite number throws `Error` with the message
  `val is not a non-empty string or a valid number. val=` followed by
  `JSON.stringify(value)`.

```ts
ms(1000) // "1s"
ms(10 * 60 * 60 * 1000) // "10h"
ms(234234234, { long: true }) // "3 days"
```
