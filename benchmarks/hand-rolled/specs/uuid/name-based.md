Implement `uuid`'s name-based generators: `v3` (MD5) and `v5` (SHA-1)
derive a deterministic UUID from a name and a namespace UUID.

```ts
export type UUIDTypes<TBuf extends Uint8Array = Uint8Array> = string | TBuf

export function v3(value: string | Uint8Array, namespace: UUIDTypes, buf?: undefined, offset?: number): string
export function v3<TBuf extends Uint8Array = Uint8Array>(value: string | Uint8Array, namespace: UUIDTypes, buf: TBuf, offset?: number): TBuf
// plus v3.DNS and v3.URL (strings)
export function v5(value: string | Uint8Array, namespace: UUIDTypes, buf?: undefined, offset?: number): string
export function v5<TBuf extends Uint8Array = Uint8Array>(value: string | Uint8Array, namespace: UUIDTypes, buf: TBuf, offset?: number): TBuf
// plus v5.DNS and v5.URL (strings)
```

Write these as named exports of one module. You may use Node.js built-in
modules (for example `node:crypto` for hashing).

UUID strings are lowercase on output and have the form
`xxxxxxxx-xxxx-Vxxx-Rxxx-xxxxxxxxxxxx`, where byte `i` of the 16-byte form is
the `i`-th pair of hex digits from the left, `V` is the version and `R` the
variant (`8`, `9`, `a` or `b`).

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
- When `buf` is omitted the result is the lowercase UUID string. When
  `buf` is given the 16 bytes are written into it starting at `offset`
  (default `0`), the other bytes are left alone and `buf` itself is
  returned. If `offset < 0` or `offset + 16 > buf.length` it throws
  `RangeError` with the message
  `UUID byte range <offset>:<offset + 15> is out of buffer bounds`.

```ts
v5("Hello, World!", "1b671a64-40d5-491e-99b0-da01ff1f3341") // "630eb68f-e0fa-5ecc-887a-7c7a62614681"
v5("https://www.w3.org/", v5.URL) // "c106a26a-21bb-5538-8bf2-57095d1976c1"
v3("hello", "0F5ABCD1-C194-47F3-905B-2DF7263A084B") // "a981a0c2-68b1-35dc-bcfc-296e52ab01ec"
v3("hello", "invalid") // throws TypeError: Invalid UUID
v5("hello", new Uint8Array(15)) // throws TypeError: Namespace must be array-like (16 iterable integer values, 0-255)
```
