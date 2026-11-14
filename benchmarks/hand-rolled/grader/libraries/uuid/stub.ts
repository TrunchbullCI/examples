export type UUIDTypes<TBuf extends Uint8Array = Uint8Array> = string | TBuf

export type Version1Options = {
  node?: Uint8Array
  clockseq?: number
  random?: Uint8Array
  rng?: () => Uint8Array
  msecs?: number
  nsecs?: number
}

export type Version4Options = {
  random?: Uint8Array
  rng?: () => Uint8Array
}

export type Version6Options = Version1Options

export type Version7Options = {
  random?: Uint8Array
  msecs?: number
  seq?: number
  rng?: () => Uint8Array
}

export const NIL = "00000000-0000-0000-0000-000000000000"
export const MAX = "ffffffff-ffff-ffff-ffff-ffffffffffff"

function notImplemented(...args: unknown[]): never {
  void args
  throw new Error("not implemented")
}

export function parse(uuid: string): Uint8Array {
  return notImplemented(uuid)
}

export function stringify(arr: Uint8Array, offset?: number): string {
  return notImplemented(arr, offset)
}

export function validate(uuid: unknown): boolean {
  return notImplemented(uuid)
}

export function version(uuid: string): number {
  return notImplemented(uuid)
}

export function v1(options?: Version1Options, buf?: undefined, offset?: number): string
export function v1<TBuf extends Uint8Array = Uint8Array>(options: Version1Options | undefined, buf: TBuf, offset?: number): TBuf
export function v1(options?: Version1Options, buf?: Uint8Array, offset?: number): UUIDTypes {
  return notImplemented(options, buf, offset)
}

export function v4(options?: Version4Options, buf?: undefined, offset?: number): string
export function v4<TBuf extends Uint8Array = Uint8Array>(options: Version4Options | undefined, buf: TBuf, offset?: number): TBuf
export function v4(options?: Version4Options, buf?: Uint8Array, offset?: number): UUIDTypes {
  return notImplemented(options, buf, offset)
}

export function v6(options?: Version6Options, buf?: undefined, offset?: number): string
export function v6<TBuf extends Uint8Array = Uint8Array>(options: Version6Options | undefined, buf: TBuf, offset?: number): TBuf
export function v6(options?: Version6Options, buf?: Uint8Array, offset?: number): UUIDTypes {
  return notImplemented(options, buf, offset)
}

export function v7(options?: Version7Options, buf?: undefined, offset?: number): string
export function v7<TBuf extends Uint8Array = Uint8Array>(options: Version7Options | undefined, buf: TBuf, offset?: number): TBuf
export function v7(options?: Version7Options, buf?: Uint8Array, offset?: number): UUIDTypes {
  return notImplemented(options, buf, offset)
}

export function v3(value: string | Uint8Array, namespace: UUIDTypes, buf?: undefined, offset?: number): string
export function v3<TBuf extends Uint8Array = Uint8Array>(value: string | Uint8Array, namespace: UUIDTypes, buf: TBuf, offset?: number): TBuf
export function v3(value: string | Uint8Array, namespace: UUIDTypes, buf?: Uint8Array, offset?: number): UUIDTypes {
  return notImplemented(value, namespace, buf, offset)
}
v3.DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
v3.URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"

export function v5(value: string | Uint8Array, namespace: UUIDTypes, buf?: undefined, offset?: number): string
export function v5<TBuf extends Uint8Array = Uint8Array>(value: string | Uint8Array, namespace: UUIDTypes, buf: TBuf, offset?: number): TBuf
export function v5(value: string | Uint8Array, namespace: UUIDTypes, buf?: Uint8Array, offset?: number): UUIDTypes {
  return notImplemented(value, namespace, buf, offset)
}
v5.DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
v5.URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"

export function v1ToV6(uuid: string): string
export function v1ToV6(uuid: Uint8Array): Uint8Array
export function v1ToV6(uuid: string | Uint8Array): string | Uint8Array {
  return notImplemented(uuid)
}

export function v6ToV1(uuid: string): string
export function v6ToV1(uuid: Uint8Array): Uint8Array
export function v6ToV1(uuid: string | Uint8Array): string | Uint8Array {
  return notImplemented(uuid)
}
