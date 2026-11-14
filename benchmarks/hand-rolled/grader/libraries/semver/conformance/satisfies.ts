import { maxSatisfying, minSatisfying, satisfies, validRange } from "./index.js"

const ok: boolean = satisfies("1.2.3", "^1.0.0")
const withOptions: boolean = satisfies("1.2.3-beta", ">=1.2.3-alpha <2", { includePrerelease: true, loose: false })
const looseFlag: boolean = satisfies("1.2.3", "~1.2", true)
const highest: string | null = maxSatisfying(["1.2.3", "1.2.4"], "~1.2.0")
const lowest: string | null = minSatisfying(["1.2.3", "1.2.4"], "1.x || >=2.5.0", { loose: true })
const canonical: string | null = validRange("~1.2")
const strictRange: string | null = validRange(">=1.2.3 <2", { includePrerelease: true })
void [ok, withOptions, looseFlag, highest, lowest, canonical, strictRange]
