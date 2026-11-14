import { cloneDeep, debounce, throttle } from "./index.js"

const save = (id: number, label: string): string => `${id}:${label}`

const debounced = debounce(save, 250, { leading: false, maxWait: 1000, trailing: true })
const pending: string | undefined = debounced(1, "a")
debounced.cancel()
const flushed: string | undefined = debounced.flush()
const quiet = debounce(() => 1)
const quietResult: number | undefined = quiet()

const throttled = throttle(save, 100, { trailing: false })
const first: string | undefined = throttled(2, "b")
throttled.cancel()
const flushedThrottle: string | undefined = throttled.flush()
const everyTick = throttle((event: { x: number }) => event.x)
const tick: number | undefined = everyTick({ x: 1 })

const source = { list: [1, 2, 3], when: new Date(0), byName: new Map<string, Set<number>>([["a", new Set([1])]]) }
const copy: { list: number[]; when: Date; byName: Map<string, Set<number>> } = cloneDeep(source)
const numbers: number[] = cloneDeep([1, 2, 3])
const text: string = cloneDeep("text")

void [pending, flushed, quietResult, first, flushedThrottle, tick, copy, numbers, text]
