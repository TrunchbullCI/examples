import isNumber from "./index.js"

const decimal: boolean = isNumber("10.10")
const padded: boolean = isNumber("   56\r\n  ")
const blank: boolean = isNumber("   ")
void [decimal, padded, blank]
