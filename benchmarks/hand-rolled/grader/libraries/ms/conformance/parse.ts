import ms from "./index.js"

const parsed: number = ms("2.5 hrs")
const negative: number = ms("-1h")
void [parsed, negative]
