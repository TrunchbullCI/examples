import { stringify } from "./index.js"

const plain: string = stringify({ a: ["b", "c"], d: { e: "f" } })
const brackets: string = stringify({ a: ["b", "c"] }, { arrayFormat: "brackets" })
const comma: string = stringify({ a: ["b"] }, { arrayFormat: "comma", commaRoundTrip: true, encodeValuesOnly: true })
const repeat: string = stringify({ a: ["b", "c"] }, { indices: false })
const options: string = stringify(
  { a: { b: [] }, c: null, d: [null, "x"] },
  { allowDots: true, allowEmptyArrays: true, encode: false, skipNulls: false, strictNullHandling: true }
)
const skip: string = stringify({ a: null, b: "c" }, { skipNulls: true, arrayFormat: "indices", indices: true })
void [plain, brackets, comma, repeat, options, skip]
