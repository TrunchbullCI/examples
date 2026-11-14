Implement `uuid`'s Gregorian time-based UUIDs: `v1` (timestamp, clock
sequence and node), `v6` (the same fields reordered so that UUIDs sort by
time), the conversions between them, and `parse` to read UUID bytes.

```ts
export type Version1Options = {
  node?: Uint8Array
  clockseq?: number
  random?: Uint8Array
  rng?: () => Uint8Array
  msecs?: number
  nsecs?: number
}
export type Version6Options = Version1Options

export function v1(options?: Version1Options, buf?: undefined, offset?: number): string
export function v1<TBuf extends Uint8Array = Uint8Array>(options: Version1Options | undefined, buf: TBuf, offset?: number): TBuf
export function v6(options?: Version6Options, buf?: undefined, offset?: number): string
export function v6<TBuf extends Uint8Array = Uint8Array>(options: Version6Options | undefined, buf: TBuf, offset?: number): TBuf
export function v1ToV6(uuid: string): string
export function v1ToV6(uuid: Uint8Array): Uint8Array
export function v6ToV1(uuid: string): string
export function v6ToV1(uuid: Uint8Array): Uint8Array
export function parse(uuid: string): Uint8Array
```

Write these as named exports of one module. You may use Node.js built-in
modules.

UUID strings are lowercase on output and have the form
`xxxxxxxx-xxxx-Vxxx-Rxxx-xxxxxxxxxxxx`, where byte `i` of the 16-byte form is
the `i`-th pair of hex digits from the left, `V` is the version and `R` the
variant (`8`, `9`, `a` or `b`).

- `parse(uuid)` returns a new 16-byte `Uint8Array` and throws `TypeError`
  with the message `Invalid UUID` unless `uuid` is a string of 32 hex
  digits (either case) grouped 8-4-4-4-12 by hyphens with version digit `1`
  to `8` and variant digit `8`, `9`, `a` or `b`, or the all-zero or
  all-`f` UUID.
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
- `v1ToV6(uuid)` stores the same 60-bit timestamp most significant bits
  first: bytes 0–5 hold timestamp bits 12–59, byte 6 is `0x60 | (bits 8–11)`
  and byte 7 bits 0–7; bytes 8–15 are copied. `v6ToV1(uuid)` is the inverse,
  producing the v1 layout above with version `1`. Both read the timestamp
  from the input layout whatever its version digit says, accept a string
  (parsed with `parse`, so an invalid string throws `TypeError: Invalid
  UUID`) or 16 bytes, and return the same kind: a lowercase string, which is
  not validated again, or a new `Uint8Array` (the input is not modified).

```ts
v1({ node: Uint8Array.of(0x01, 0x23, 0x45, 0x67, 0x89, 0xab), clockseq: 0x1234, msecs: 1320105600000, nsecs: 5678 })
// "710b962e-041c-11e1-9234-0123456789ab"
v6({ node: Uint8Array.of(0x01, 0x23, 0x45, 0x67, 0x89, 0xab), clockseq: 0x1234, msecs: 1320105600000, nsecs: 5678 })
// "1e1041c7-10b9-662e-9234-0123456789ab"
v1ToV6("92f62d9e-22c4-11ef-97e9-325096b39f47") // "1ef22c49-2f62-6d9e-97e9-325096b39f47"
v6ToV1("1ef22c49-2f62-6d9e-97e9-325096b39f47") // "92f62d9e-22c4-11ef-97e9-325096b39f47"
v1({ msecs: 0, random: new Uint8Array(8) }) // throws Error: Random bytes length must be >= 16
```
