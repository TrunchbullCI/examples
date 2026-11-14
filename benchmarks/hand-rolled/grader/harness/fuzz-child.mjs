// Runs a library's fuzz targets against one module (the reference or a
// submission) and streams each canonical outcome on fd 3, one per line, so a
// hang or crash loses only the remaining inputs.
import { writeSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { canonical, thrownName } from "./canonical.mjs"
import { createRandom } from "./random.mjs"

const [libraryDirectory, libraryId, subjectPath, targetList] = process.argv.slice(2)
const emit = (value) => writeSync(3, `${JSON.stringify(value)}\n`)
const fuzz = (await import(pathToFileURL(join(libraryDirectory, "fuzz.mjs")).href)).default
await fuzz.setup?.()
let api
try {
  api = await import(pathToFileURL(subjectPath).href)
} catch (error) {
  emit({ loadError: thrownName(error) })
  process.exit(0)
}
for (const name of targetList.split(",")) {
  const target = fuzz.targets[name]
  if (!target) throw new Error(`Unknown fuzz target ${name}.`)
  const random = createRandom(`${libraryId}:${name}`)
  const count = target.count ?? 200
  for (let index = 0; index < count; index += 1) {
    const input = target.input(random, index)
    const inputText = canonical(input).slice(0, 300)
    let outcome
    try {
      outcome = { value: canonical(await target.run(api, input)) }
    } catch (error) {
      outcome = { thrown: thrownName(error) }
    }
    emit({ target: name, index, input: inputText, ...outcome })
  }
}
