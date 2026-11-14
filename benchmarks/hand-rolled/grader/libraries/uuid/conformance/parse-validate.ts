import { MAX, NIL, parse, stringify, validate, version } from "./index.js"

const nil: string = NIL
const max: string = MAX
const bytes: Uint8Array = parse("6ec0bd7f-11c0-43da-975e-2a8ad9ebae0b")
const text: string = stringify(bytes)
const offsetText: string = stringify(new Uint8Array(19), 3)
const valid: boolean = validate(null)
const versionNumber: number = version(max)
void [nil, text, offsetText, valid, versionNumber]
