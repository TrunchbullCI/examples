Implement the non-string half of `is-number`: `isNumber(value)` reports
whether a value is a finite number.

```ts
export default function isNumber(num: unknown): boolean
```

The module has a single default export, `isNumber`. Only non-string inputs
are graded.

- A value of type `number` is a number when it is finite: `NaN`,
  `Infinity` and `-Infinity` are not; `0`, `-0`, `Number.MAX_VALUE`
  and `Number.MIN_VALUE` are.
- Every other non-string value is `false`, whatever it would convert to:
  `null`, `undefined`, booleans, bigints, symbols, arrays (even `[1]`),
  plain objects, dates, regular expressions, functions, and boxed `Number`
  objects. It never throws.

```ts
isNumber(0xff) // true
isNumber(-1.1) // true
isNumber(Math.PI) // true
isNumber(NaN) // false
isNumber(-Infinity) // false
isNumber(true) // false
isNumber([1]) // false
isNumber(new Date()) // false
```
