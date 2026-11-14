import { parse } from "./index.js"

const defaults: Record<string, unknown> = parse("a[100]=b")
const limited: Record<string, unknown> = parse("a=1&b=2&c=3", { parameterLimit: 2, throwOnLimitExceeded: false })
const arrays: Record<string, unknown> = parse("a[]=1&a[]=2", { arrayLimit: 1, throwOnLimitExceeded: true })
const deep: Record<string, unknown> = parse("a[b][c][d]=e", { depth: 2, strictDepth: true })
const unlimited: Record<string, unknown> = parse("a=1", { parameterLimit: Infinity, depth: false })
const options: Record<string, unknown> = parse("a[1]=b&a[3]", { allowSparse: true, strictNullHandling: true, parseArrays: false })
void [defaults, limited, arrays, deep, unlimited, options]
