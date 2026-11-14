import deepEqual from "./index.js"

const loose: boolean = deepEqual({ a: [2, 3], b: [4] }, { b: [4], a: [2, 3] })
const strict: boolean = deepEqual([null], [undefined], { strict: true })
const explicitLoose: boolean = deepEqual("3", 3, { strict: false })
void [loose, strict, explicitLoose]
