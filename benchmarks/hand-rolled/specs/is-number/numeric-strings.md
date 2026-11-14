Implement the string half of `is-number`: `isNumber(value)` reports
whether a string reads as a finite number.

```ts
export default function isNumber(num: unknown): boolean
```

The module has a single default export, `isNumber`. Only string inputs are
graded.

- A string is a number when it is not empty after trimming whitespace
  (`String.prototype.trim`) and converting it with the unary `+` operator
  gives a finite number.
- That accepts surrounding whitespace (including line breaks and Unicode
  spaces that `trim` removes), signs, decimals with or without a leading or
  trailing digit, exponents, and the `0x`, `0b` and `0o` prefixes, exactly
  as JavaScript's number conversion does.
- An empty or all-whitespace string, a string that converts to `NaN`, and a
  string that converts to `Infinity` or `-Infinity` (`"Infinity"`,
  `"1e400"`) are not numbers. It never throws.

```ts
isNumber("10.10") // true
isNumber("5e3") // true
isNumber("0xff") // true
isNumber("   56\r\n  ") // true
isNumber("") // false
isNumber("\r\n\t") // false
isNumber("3a") // false
isNumber("Infinity") // false
```
