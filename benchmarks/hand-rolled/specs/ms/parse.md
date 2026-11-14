Implement the string-parsing half of `ms`: `ms(value)` converts a
human-readable duration string to milliseconds.

```ts
export default function ms(value: string): number
```

- A string is a number, optionally followed by spaces and a unit. The number
  may be negative, may have a decimal part and may start with `.`.
- Units are case-insensitive: `years`, `year`, `yrs`, `yr`, `y`;
  `weeks`, `week`, `w`; `days`, `day`, `d`; `hours`, `hour`, `hrs`,
  `hr`, `h`; `minutes`, `minute`, `mins`, `min`, `m`; `seconds`,
  `second`, `secs`, `sec`, `s`; `milliseconds`, `millisecond`, `msecs`,
  `msec`, `ms`. No unit means milliseconds.
- A year is 365.25 days and a week is 7 days.
- A string that does not match, or is longer than 100 characters, returns
  `undefined`.
- An empty string throws `Error` with the message
  `val is not a non-empty string or a valid number. val=""`.

```ts
ms("2 days") // 172800000
ms("1.5h") // 5400000
ms("-.5 hr") // -1800000
ms("100") // 100
```
