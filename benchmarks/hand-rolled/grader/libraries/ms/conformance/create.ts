import ms from "./index.js"

const parsed: number = ms("2 days")
const formatted: string = ms(60000)
const long: string = ms(60000, { long: true })
const short: string = ms(-3 * 60000, { long: false })
void [parsed, formatted, long, short]
