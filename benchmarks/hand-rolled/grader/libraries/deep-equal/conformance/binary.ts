import deepEqual from "./index.js"

const typed: boolean = deepEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))
const buffers: boolean = deepEqual(new ArrayBuffer(4), new ArrayBuffer(4), { strict: true })
const mixed: boolean = deepEqual(new Int8Array(2), new Uint8Array(2), { strict: false })
void [typed, buffers, mixed]
