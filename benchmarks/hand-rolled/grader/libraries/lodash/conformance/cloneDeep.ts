import { cloneDeep } from "./index.js"

const source = { list: [1, 2, 3], when: new Date(0), byName: new Map<string, Set<number>>([["a", new Set([1])]]) }
const copy: { list: number[]; when: Date; byName: Map<string, Set<number>> } = cloneDeep(source)
const numbers: number[] = cloneDeep([1, 2, 3])
const text: string = cloneDeep("text")
const nothing: undefined = cloneDeep(undefined)

void [copy, numbers, text, nothing]
