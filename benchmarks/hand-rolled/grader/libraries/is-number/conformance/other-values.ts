import isNumber from "./index.js"

const finite: boolean = isNumber(3.14)
const infinite: boolean = isNumber(Infinity)
const array: boolean = isNumber([1])
const missing: boolean = isNumber(undefined)
void [finite, infinite, array, missing]
