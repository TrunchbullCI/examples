// Loaded with --import into every process that runs upstream tests or fuzz
// targets. It redirects the paths where upstream tests import their library
// to the shims that load the subject (a submission or the reference).
import { registerHooks } from "node:module"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const suiteRoot = process.env.HR_SUITE_ROOT
const aliases = JSON.parse(process.env.HR_ALIASES ?? "{}")

function aliasKey(parentURL, specifier) {
  if (!suiteRoot || !parentURL?.startsWith("file:")) return null
  if (specifier !== "." && specifier !== ".." && !specifier.startsWith("./") && !specifier.startsWith("../")) return null
  const target = resolve(dirname(fileURLToPath(parentURL)), specifier)
  const key = relative(suiteRoot, target)
    .split("\\")
    .join("/")
    .replace(/\.(c|m)?js$/, "")
    .replace(/(^|\/)index$/, "")
  return key === "" ? "." : key
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const bare = aliases[`bare:${specifier}`]
    if (bare) return { url: pathToFileURL(bare).href, shortCircuit: true }
    const key = aliasKey(context.parentURL, specifier)
    if (key !== null && aliases[key]) {
      return { url: pathToFileURL(aliases[key]).href, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})
