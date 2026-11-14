`ms` converts between human-readable time strings and milliseconds. Given a
string it returns the number of milliseconds; given a number of milliseconds it
returns a short (or, with `{ long: true }`, a written-out) duration.

## API

```ts
export default function ms(value: string): number
export default function ms(value: number, options?: { long: boolean }): string
```

The module has a single default export, `ms`.

## Parsing strings

- A string is a number, optionally followed by spaces and a unit. The number
  may be negative, may have a decimal part and may start with `.`
  (`".5ms"`, `"-.5h"`).
- Units are case-insensitive: `years`, `year`, `yrs`, `yr`, `y`;
  `weeks`, `week`, `w`; `days`, `day`, `d`; `hours`, `hour`, `hrs`,
  `hr`, `h`; `minutes`, `minute`, `mins`, `min`, `m`; `seconds`,
  `second`, `secs`, `sec`, `s`; `milliseconds`, `millisecond`, `msecs`,
  `msec`, `ms`. A string with no unit is milliseconds.
- A year is 365.25 days and a week is 7 days.
- A string that does not match, or that is longer than 100 characters,
  returns `undefined` (the published types still say `number`); for
  example `ms("☃")` is `undefined`, so `isNaN(ms("☃"))` is true.

## Formatting numbers

- Short format picks the largest unit among day (`d`), hour (`h`), minute
  (`m`) and second (`s`) whose size is at most the absolute value, and
  rounds with `Math.round`: `ms(60000)` is `"1m"`, `ms(-3 * 60000)` is
  `"-3m"`. Values below one second are printed as is with `ms`:
  `ms(500)` is `"500ms"`.
- Long format uses the same units written out (`day`, `hour`, `minute`,
  `second`, or `ms` with a space: `"500 ms"`). The unit is plural when the
  absolute value is at least 1.5 units: `ms(60000, { long: true })` is
  `"1 minute"`, `ms(90000, { long: true })` is `"2 minutes"`.

## Errors

Any other input (an empty string, a non-finite number, or anything that is
not a string or number) throws `Error` with the message
`val is not a non-empty string or a valid number. val=` followed by
`JSON.stringify(value)`.

## Examples

```ts
ms("2 days") // 172800000
ms("1d") // 86400000
ms("2.5 hrs") // 9000000
ms("1y") // 31557600000
ms("100") // 100
ms("-3 days") // -259200000
ms(60000) // "1m"
ms(2 * 60000, { long: true }) // "2 minutes"
ms(ms("10 hours"), { long: true }) // "10 hours"
```
