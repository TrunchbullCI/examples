import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

export const GRADER_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
export const HARNESS_ROOT = join(GRADER_ROOT, "harness")
export const LIBRARIES_ROOT = join(GRADER_ROOT, "libraries")
export const HOOKS = join(HARNESS_ROOT, "hooks.mjs")

export function libraryRoot(id) {
  return join(LIBRARIES_ROOT, id)
}
