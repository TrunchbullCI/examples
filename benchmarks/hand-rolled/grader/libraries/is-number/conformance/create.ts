import isNumber from "./index.js"

const fromNumber: boolean = isNumber(0xff)
const fromString: boolean = isNumber("  -1.5e3 ")
const fromOther: boolean = isNumber(null)
const fromUnknown: boolean = isNumber({ value: 1 } as unknown)
void [fromNumber, fromString, fromOther, fromUnknown]
