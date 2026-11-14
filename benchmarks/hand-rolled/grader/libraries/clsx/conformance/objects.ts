import clsx, { clsx as named } from "./index.js"

const dictionary: string = clsx({ foo: true, bar: false, "--baz": "yes" })
const mixed: string = named("hello", { world: 1, push: true }, null, 0)
void [dictionary, mixed]
