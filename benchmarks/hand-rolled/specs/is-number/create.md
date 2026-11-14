`is-number` returns `true` when a value is a finite number, or a string
that reads as one. It smooths out JavaScript's casting edge cases: `+[]`,
`+""` and `+"   "` are all `0`, and `typeof NaN` is `"number"`.

## API

```ts
export default function isNumber(num: unknown): boolean
```

The module has a single default export, `isNumber`. It never throws.

## Behaviour

- A value of type `number` is a number when it is finite: `NaN`,
  `Infinity` and `-Infinity` are not.
- A value of type `string` is a number when it is not empty after trimming
  whitespace (`String.prototype.trim`) and converting it with the unary
  `+` operator gives a finite number. This accepts surrounding whitespace,
  signs, decimals, exponents and the `0x`, `0b` and `0o` prefixes
  exactly as JavaScript's number conversion does.
- Every other value is `false`, including `null`, `undefined`, booleans,
  bigints, arrays, plain objects, dates, functions, and boxed `Number` or
  `String` objects.

## Examples

```ts
isNumber(5e3) // true
isNumber(0xff) // true
isNumber(-1.1) // true
isNumber("-1.1") // true
isNumber("012") // true
isNumber("0xff") // true
isNumber("   56\r\n  ") // true
isNumber(Infinity) // false
isNumber(NaN) // false
isNumber("") // false
isNumber("   ") // false
isNumber("foo") // false
isNumber([1]) // false
isNumber(null) // false
```
