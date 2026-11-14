// Hard gate: importing the module must not throw.
import { writeSync } from "node:fs"
import { pathToFileURL } from "node:url"

const report = (value) => writeSync(3, `${JSON.stringify(value)}\n`)
try {
  const module = await import(pathToFileURL(process.argv[2]).href)
  report({ ok: true, exports: Object.keys(module).sort() })
} catch (error) {
  report({
    ok: false,
    error: error instanceof Error ? `${error.constructor?.name ?? "Error"}: ${error.message}` : String(error),
  })
}
