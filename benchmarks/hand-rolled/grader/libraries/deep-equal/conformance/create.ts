import deepEqual from "./index.js"

const loose: boolean = deepEqual({ a: [2, 3], b: [4] }, { a: [2, 3], b: [4] })
const strict: boolean = deepEqual({ a: 2 }, { a: "2" }, { strict: true })
const notStrict: boolean = deepEqual(new Date(0), new Date(0), { strict: false })
const collections: boolean = deepEqual(new Map([[1, new Set(["a"])]]), new Map([[1, new Set(["a"])]]))
void [loose, strict, notStrict, collections]
