import clsx, { clsx as named } from "./index.js"

const strings: string = clsx("foo", false && "bar", "baz", "")
const numbers: string = named(0, 1, 2.5, Infinity)
const arrays: string = clsx(["foo", 0, null], [["bar", [undefined, "baz"]]], true)
void [strings, numbers, arrays]
