import ms from "./index.js"

const formatted: string = ms(60000)
const long: string = ms(2 * 60000, { long: true })
const short: string = ms(-3 * 60000, { long: false })
void [formatted, long, short]
