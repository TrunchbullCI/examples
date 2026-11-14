Implement `uuid`'s string helpers: the `NIL` and `MAX` constants,
`parse` and `stringify` between UUID strings and bytes, `validate`, and
`version`.

```ts
export const NIL: string // "00000000-0000-0000-0000-000000000000"
export const MAX: string // "ffffffff-ffff-ffff-ffff-ffffffffffff"
export function parse(uuid: string): Uint8Array
export function stringify(arr: Uint8Array, offset?: number): string
export function validate(uuid: unknown): boolean
export function version(uuid: string): number
```

Write these as named exports of one module.

UUID strings are lowercase on output and have the form
`xxxxxxxx-xxxx-Vxxx-Rxxx-xxxxxxxxxxxx`, where byte `i` of the 16-byte form is
the `i`-th pair of hex digits from the left, `V` is the version and `R` the
variant (`8`, `9`, `a` or `b`).

- `validate(value)` is `true` only for a string of 32 hex digits
  (either case) grouped 8-4-4-4-12 by hyphens, whose version digit (the 15th
  character) is `1` to `8` and whose variant digit (the 20th character) is
  `8`, `9`, `a` or `b`, and also for `NIL` and `MAX` in either case.
  Anything else, including non-strings and strings with surrounding
  whitespace, braces or a `urn:uuid:` prefix, is `false`.
- `version(uuid)` returns the version digit as a number (`0` for `NIL`,
  `15` for `MAX`). `parse(uuid)` returns a new 16-byte `Uint8Array`.
  Both throw `TypeError` with the message `Invalid UUID` when
  `validate(uuid)` is false.
- `stringify(arr, offset = 0)` formats the 16 bytes starting at `offset`
  as a lowercase UUID string. If the result is not valid by `validate`
  (wrong version or variant bits, or fewer than 16 bytes available) it throws
  `TypeError` with the message `Stringified UUID is invalid`.

```ts
NIL // "00000000-0000-0000-0000-000000000000"
MAX // "ffffffff-ffff-ffff-ffff-ffffffffffff"
parse("6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b") // Uint8Array [110, 192, 189, 127, 17, 192, 67, 218, 151, 94, 42, 138, 217, 235, 174, 11]
stringify(Uint8Array.of(0x6e, 0xc0, 0xbd, 0x7f, 0x11, 0xc0, 0x43, 0xda, 0x97, 0x5e, 0x2a, 0x8a, 0xd9, 0xeb, 0xae, 0x0b))
// "6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b"
validate("6EC0BD7F-11C0-43DA-975E-2A8AD9EBAE0B") // true
validate("6ec0bd7f-11c0-93da-975e-2a8ad9ebae0b") // false (version 9)
version("6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b") // 4
version(MAX) // 15
parse("not a uuid") // throws TypeError: Invalid UUID
stringify(new Uint8Array(16).fill(1)) // throws TypeError: Stringified UUID is invalid
```
