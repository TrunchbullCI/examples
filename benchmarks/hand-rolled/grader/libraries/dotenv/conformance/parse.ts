import { parse } from "./index.js"

const parsed: Record<string, string> = parse("BASIC=basic")
const fromBuffer: Record<string, string> = parse(Buffer.from("A=1\nB=2"))
const fast: Record<string, string> = parse("A=1", { fast: true })
const value: string | undefined = parsed.BASIC
void [fromBuffer, fast, value]
