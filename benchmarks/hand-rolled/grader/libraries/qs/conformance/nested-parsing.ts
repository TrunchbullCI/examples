import { parse } from "./index.js"

const simple: Record<string, unknown> = parse("a[b][c]=d&e[]=f")
const shallow: Record<string, unknown> = parse("a[b][c]=d", { depth: 1 })
const flat: Record<string, unknown> = parse("a[b]=c", { depth: false })
const dotted: Record<string, unknown> = parse("a.b=c", { allowDots: true })
const decodedDots: Record<string, unknown> = parse("name%252Eobj.first=John", { decodeDotInKeys: true })
const options: Record<string, unknown> = parse("a[hasOwnProperty]=b&c[1]=d&e[]", {
  allowPrototypes: true,
  plainObjects: false,
  parseArrays: true,
  allowSparse: true,
  allowEmptyArrays: true,
  strictNullHandling: true,
  strictMerge: false,
})
void [simple, shallow, flat, dotted, decodedDots, options]
