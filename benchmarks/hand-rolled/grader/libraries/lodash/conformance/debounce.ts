import { debounce } from "./index.js"

const save = (id: number, label: string): string => `${id}:${label}`

const debounced = debounce(save, 250, { leading: true, maxWait: 1000, trailing: false })
const result: string | undefined = debounced(1, "a")
debounced.cancel()
const flushed: string | undefined = debounced.flush()
const quiet = debounce(() => 1)
const quietResult: number | undefined = quiet()
const withWait = debounce((value: boolean) => !value, 10)

void [result, flushed, quietResult, withWait(true)]
