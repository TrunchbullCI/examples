import deepEqual from "./index.js"

const maps: boolean = deepEqual(new Map([["a", 1]]), new Map([["a", 1]]))
const sets: boolean = deepEqual(new Set([{ a: 1 }]), new Set([{ a: 1 }]), { strict: true })
const loose: boolean = deepEqual(new Set([1]), new Set(["1"]), { strict: false })
void [maps, sets, loose]
