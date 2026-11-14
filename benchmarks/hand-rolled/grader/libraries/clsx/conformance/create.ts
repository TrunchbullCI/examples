import clsx, { clsx as named } from "./index.js"
import type { ClassArray, ClassDictionary, ClassValue } from "./index.js"

const dictionary: ClassDictionary = { foo: true, bar: 0, "--baz": "yes" }
const array: ClassArray = ["a", ["b", { c: 1 }], null, undefined, false, 0, 1n]
const value: ClassValue = array
const joined: string = clsx("foo", true && "bar", dictionary, array, value, 12)
const empty: string = named()
const same: typeof clsx = named
void [joined, empty, same]
