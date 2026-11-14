import { throttle } from "./index.js"

const save = (id: number, label: string): string => `${id}:${label}`

const throttled = throttle(save, 100, { leading: false, trailing: true })
const first: string | undefined = throttled(2, "b")
throttled.cancel()
const flushed: string | undefined = throttled.flush()
const everyTick = throttle((event: { x: number }) => event.x)
const tick: number | undefined = everyTick({ x: 1 })

void [first, flushed, tick]
