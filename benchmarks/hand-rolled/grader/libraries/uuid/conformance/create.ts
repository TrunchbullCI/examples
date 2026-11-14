import { MAX, NIL, parse, stringify, v1, v1ToV6, v3, v4, v5, v6, v6ToV1, v7, validate, version } from "./index.js"
import type { UUIDTypes, Version1Options, Version4Options, Version6Options, Version7Options } from "./index.js"

const random = new Uint8Array(16)
const v1Options: Version1Options = { msecs: 1_700_000_000_000, nsecs: 5678, clockseq: 0x1234, node: Uint8Array.of(1, 2, 3, 4, 5, 6) }
const v4Options: Version4Options = { random }
const v6Options: Version6Options = { msecs: 0, rng: () => random }
const v7Options: Version7Options = { msecs: 0, seq: 0, random }

const fromV1: string = v1()
const fromV1Options: string = v1(v1Options)
const intoV1: Uint8Array = v1(v1Options, new Uint8Array(32), 16)
const fromV3: string = v3("hello.example.com", v3.DNS)
const intoV3: Uint8Array = v3(Uint8Array.of(1, 2), v3.URL, new Uint8Array(16))
const fromV4: string = v4()
const fromV4Options: string = v4(v4Options)
const intoV4: Uint8Array = v4(undefined, new Uint8Array(16))
const fromV5: string = v5("hello", parse(NIL))
const intoV5: Uint8Array = v5("hello", v5.DNS, new Uint8Array(19), 3)
const fromV6: string = v6(v6Options)
const intoV6: Uint8Array = v6(v6Options, new Uint8Array(16), 0)
const fromV7: string = v7(v7Options)
const intoV7: Uint8Array = v7({}, new Uint8Array(16))
const bytes: Uint8Array = parse(MAX)
const text: string = stringify(bytes, 0)
const valid: boolean = validate(text as unknown)
const versionNumber: number = version(fromV4)
const v6Text: string = v1ToV6(fromV1)
const v6Bytes: Uint8Array = v1ToV6(bytes)
const v1Text: string = v6ToV1(v6Text)
const v1Bytes: Uint8Array = v6ToV1(v6Bytes)
const namespace: UUIDTypes = v5.URL
const nil: string = NIL
void [fromV1, fromV1Options, intoV1, fromV3, intoV3, fromV4, fromV4Options, intoV4, fromV5, intoV5, fromV6, intoV6, fromV7, intoV7]
void [text, valid, versionNumber, v6Text, v6Bytes, v1Text, v1Bytes, namespace, nil]
