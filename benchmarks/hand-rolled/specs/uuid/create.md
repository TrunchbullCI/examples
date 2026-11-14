`uuid` generates and handles RFC 9562 UUIDs: timestamp-based (v1, v6, v7),
random (v4) and name-based (v3 with MD5, v5 with SHA-1), plus parsing,
formatting, validation and v1/v6 conversion. Generators can return a string
or write 16 bytes into a buffer, and accept explicit random bytes and
timestamps so their output can be reproduced.

## API

```ts
export type UUIDTypes<TBuf extends Uint8Array = Uint8Array> = string | TBuf

export type Version1Options = {
  node?: Uint8Array
  clockseq?: number
  random?: Uint8Array
  rng?: () => Uint8Array
  msecs?: number
  nsecs?: number
}
export type Version4Options = { random?: Uint8Array; rng?: () => Uint8Array }
export type Version6Options = Version1Options
export type Version7Options = { random?: Uint8Array; msecs?: number; seq?: number; rng?: () => Uint8Array }

export const NIL: string // "00000000-0000-0000-0000-000000000000"
export const MAX: string // "ffffffff-ffff-ffff-ffff-ffffffffffff"
export function parse(uuid: string): Uint8Array
export function stringify(arr: Uint8Array, offset?: number): string
export function validate(uuid: unknown): boolean
export function version(uuid: string): number

export function v1(options?: Version1Options, buf?: undefined, offset?: number): string
export function v1<TBuf extends Uint8Array = Uint8Array>(options: Version1Options | undefined, buf: TBuf, offset?: number): TBuf
export function v4(options?: Version4Options, buf?: undefined, offset?: number): string
export function v4<TBuf extends Uint8Array = Uint8Array>(options: Version4Options | undefined, buf: TBuf, offset?: number): TBuf
export function v6(options?: Version6Options, buf?: undefined, offset?: number): string
export function v6<TBuf extends Uint8Array = Uint8Array>(options: Version6Options | undefined, buf: TBuf, offset?: number): TBuf
export function v7(options?: Version7Options, buf?: undefined, offset?: number): string
export function v7<TBuf extends Uint8Array = Uint8Array>(options: Version7Options | undefined, buf: TBuf, offset?: number): TBuf
export function v3(value: string | Uint8Array, namespace: UUIDTypes, buf?: undefined, offset?: number): string
export function v3<TBuf extends Uint8Array = Uint8Array>(value: string | Uint8Array, namespace: UUIDTypes, buf: TBuf, offset?: number): TBuf
// plus v3.DNS and v3.URL (strings)
export function v5(value: string | Uint8Array, namespace: UUIDTypes, buf?: undefined, offset?: number): string
export function v5<TBuf extends Uint8Array = Uint8Array>(value: string | Uint8Array, namespace: UUIDTypes, buf: TBuf, offset?: number): TBuf
// plus v5.DNS and v5.URL (strings)
export function v1ToV6(uuid: string): string
export function v1ToV6(uuid: Uint8Array): Uint8Array
export function v6ToV1(uuid: string): string
export function v6ToV1(uuid: Uint8Array): Uint8Array
```

Write these as named exports of one module. You may use Node.js built-in
modules (for example `node:crypto` for hashing).

## Formats and validation

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

## Generators

- Every generator returns a string when `buf` is omitted. When `buf` is
  given it writes the 16 bytes into `buf` starting at `offset` (default
  `0`), leaves the other bytes alone and returns `buf` itself. If
  `offset < 0` or `offset + 16 > buf.length` it throws `RangeError` with
  the message `UUID byte range <offset>:<offset + 15> is out of buffer bounds`
  (for example `UUID byte range -1:14 is out of buffer bounds`).
- The random bytes are `options.random` if given, otherwise the result of
  `options.rng()` if given, otherwise 16 bytes from
  `crypto.getRandomValues`. If they are fewer than 16 bytes the generator
  throws `Error` with the message `Random bytes length must be >= 16`. This
  check comes before the buffer range check, and it applies even when the
  other options make the random bytes unnecessary.
- `v4(options, buf, offset)` with neither `options` nor `buf` returns
  `crypto.randomUUID()` (the global `crypto`, looked up at call time).
  Otherwise the UUID is the first 16 random bytes with byte 6 set to
  `(r[6] & 0x0f) | 0x40` and byte 8 to `(r[8] & 0x3f) | 0x80`.
- `v1(options, buf, offset)`: when `options` is given (even `{}`), the
  UUID depends only on the options and the random bytes `r`: `msecs`
  defaults to `Date.now()`, `nsecs` (100-nanosecond intervals added to
  `msecs`, 0 to 9999) to `0`, `clockseq` to
  `((r[8] << 8) | r[9]) & 0x3fff`, and `node` to `r[10..15]` with the
  multicast bit set (`node[0] | 0x01`); an explicit `node` is used as is.
- The 60-bit timestamp is `t = (msecs + 12219292800000) * 10000 + nsecs`
  (100-nanosecond intervals since 1582-10-15). It exceeds 2^53, so compute it
  exactly (for example with `BigInt`) for any `msecs` from
  `-12219292800000` up to 2^46. Bytes 0–3 are the low 32 bits of `t`, bytes
  4–5 bits 32–47, byte 6 is `0x10 | (bits 56–59)` and byte 7 bits 48–55
  (all big-endian). Byte 8 is `(clockseq >>> 8) | 0x80`, byte 9
  `clockseq & 0xff`, and bytes 10–15 the node.
- `v1()` without options keeps module state so successive UUIDs sort in
  creation order: it reads `Date.now()`; within the same millisecond as the
  previous call it increments `nsecs` (when that reaches 10000 it resets to 0
  and picks a new node and clock sequence); when the clock advances `nsecs`
  resets to 0; when it goes backwards a new node and clock sequence are
  picked. The node and clock sequence come from random bytes as above on the
  first call and are kept otherwise.
- `v6(options, buf, offset)` takes the same arguments as `v1` and returns
  that v1 UUID converted with `v1ToV6`. `v6()` and `v6({})` use the same
  monotonic clock as `v1()` but a fresh random node and clock sequence for
  every UUID.
- `v7(options, buf, offset)`: with `options` (even `{}`), `msecs`
  defaults to `Date.now()` and `seq` to
  `((r[6] & 0x7f) << 24) | (r[7] << 16) | (r[8] << 8) | r[9]`. Bytes 0–5 are
  `msecs` as a 48-bit big-endian integer; with `seq` taken as an unsigned
  32-bit integer, byte 6 is `0x70 | (seq >>> 28)`, byte 7
  `(seq >>> 20) & 0xff`, byte 8 `0x80 | ((seq >>> 14) & 0x3f)`, byte 9
  `(seq >>> 6) & 0xff`, byte 10 `((seq << 2) & 0xff) | (r[10] & 0x03)`, and
  bytes 11–15 are `r[11..15]`.
- `v7()` without options keeps module state so successive UUIDs are
  strictly increasing: when `Date.now()` is later than the stored time it
  stores that time and a new random `seq` (formula above); otherwise it
  increments `seq` as a 32-bit value and, if that wraps to 0, increments the
  stored time.
- `v3(value, namespace, buf, offset)` and `v5(...)` hash the 16 namespace
  bytes followed by the value bytes with MD5 (`v3`) or SHA-1 (`v5`) and keep
  the first 16 bytes, with byte 6 set to `(h[6] & 0x0f) | 0x30` (`0x50` for
  v5) and byte 8 to `(h[8] & 0x3f) | 0x80`. A string value is UTF-8
  encoded; a `Uint8Array` value is used as is.
- A string namespace is parsed with `parse` (invalid strings throw
  `TypeError: Invalid UUID`, either case is accepted). Any other namespace
  whose `length` is not 16, including `undefined` and `null`, throws
  `TypeError` with the message
  `Namespace must be array-like (16 iterable integer values, 0-255)`. These
  checks come before the buffer range check.
- `v3.DNS` and `v5.DNS` are `"6ba7b810-9dad-11d1-80b4-00c04fd430c8"`;
  `v3.URL` and `v5.URL` are `"6ba7b811-9dad-11d1-80b4-00c04fd430c8"`.

## Conversion

- `v1ToV6(uuid)` stores the same 60-bit timestamp most significant bits
  first: bytes 0–5 hold timestamp bits 12–59, byte 6 is `0x60 | (bits 8–11)`
  and byte 7 bits 0–7; bytes 8–15 are copied. `v6ToV1(uuid)` is the inverse,
  producing the v1 layout above with version `1`. Both read the timestamp
  from the input layout whatever its version digit says, accept a string
  (parsed with `parse`, so an invalid string throws `TypeError: Invalid
  UUID`) or 16 bytes, and return the same kind: a lowercase string, which is
  not validated again, or a new `Uint8Array` (the input is not modified).

## Examples

```ts
NIL // "00000000-0000-0000-0000-000000000000"
parse("6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b") // Uint8Array [110, 192, 189, 127, 17, 192, 67, 218, 151, 94, 42, 138, 217, 235, 174, 11]
stringify(parse("6EC0BD7F-11C0-43DA-975E-2A8AD9EBAE0B")) // "6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b"
validate("not a UUID") // false
version("45637ec4-c85f-11ea-87d0-0242ac130003") // 1
v1({ node: Uint8Array.of(0x01, 0x23, 0x45, 0x67, 0x89, 0xab), clockseq: 0x1234, msecs: 1320105600000, nsecs: 5678 })
// "710b962e-041c-11e1-9234-0123456789ab"
v4({ random: Uint8Array.of(0x10, 0x91, 0x56, 0xbe, 0xc4, 0xfb, 0xc1, 0xea, 0x71, 0xb4, 0xef, 0xe1, 0x67, 0x1c, 0x58, 0x36) })
// "109156be-c4fb-41ea-b1b4-efe1671c5836"
v5("Hello, World!", "1b671a64-40d5-491e-99b0-da01ff1f3341") // "630eb68f-e0fa-5ecc-887a-7c7a62614681"
v5("https://www.w3.org/", v5.URL) // "c106a26a-21bb-5538-8bf2-57095d1976c1"
v6({ node: Uint8Array.of(0x01, 0x23, 0x45, 0x67, 0x89, 0xab), clockseq: 0x1234, msecs: 1320105600000, nsecs: 5678 })
// "1e1041c7-10b9-662e-9234-0123456789ab"
v1ToV6("92f62d9e-22c4-11ef-97e9-325096b39f47") // "1ef22c49-2f62-6d9e-97e9-325096b39f47"
v4({ random: new Uint8Array(4) }) // throws Error: Random bytes length must be >= 16
v4({ random: new Uint8Array(16) }, new Uint8Array(15)) // throws RangeError: UUID byte range 0:15 is out of buffer bounds
```
