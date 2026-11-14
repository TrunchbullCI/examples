import { parse, v1, v1ToV6, v6, v6ToV1 } from "./index.js"

const options = { msecs: 1_320_105_600_000, nsecs: 5678, clockseq: 0x1234, node: Uint8Array.of(1, 35, 69, 103, 137, 171) }
const random = new Uint8Array(16)
const fromV1: string = v1()
const fromV1Options: string = v1(options)
const fromV1Random: string = v1({ msecs: 0, random })
const intoV1: Uint8Array = v1({ msecs: 0, rng: () => random }, new Uint8Array(32), 16)
const fromV6: string = v6(options)
const intoV6: Uint8Array = v6(undefined, new Uint8Array(16))
const v6Text: string = v1ToV6(fromV1)
const v6Bytes: Uint8Array = v1ToV6(parse(fromV1))
const v1Text: string = v6ToV1(fromV6)
const v1Bytes: Uint8Array = v6ToV1(v6Bytes)
void [fromV1Options, fromV1Random, intoV1, intoV6, v6Text, v1Text, v1Bytes]
