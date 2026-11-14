// Runs each library's reference (the real package behind the documented
// API) through its upstream suites and records, per target, the test points
// that the grader expects a correct module to pass.
//
//   node tools/expectations.mjs [library...]          write expected.json
//   node tools/expectations.mjs --check [library...]  fail if it would change
import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { referenceModule } from "../harness/grade.mjs"
import { LIBRARIES_ROOT, libraryRoot } from "../harness/paths.mjs"
import { runSuites, selectPoints } from "../harness/suites.mjs"

const args = process.argv.slice(2)
const check = args.includes("--check")
const requested = args.filter((arg) => !arg.startsWith("--"))
const ids = requested.length ? requested : (await readdir(LIBRARIES_ROOT)).sort()
let failed = false

for (const id of ids) {
  const root = libraryRoot(id)
  const library = { ...JSON.parse(await readFile(join(root, "library.json"), "utf8")), root }
  const subject = await referenceModule(library)
  const results = await runSuites(library, library.suites.map((suite) => suite.id), subject)
  const points = results.flatMap((result) => result.points).filter((point) => !point.directive)
  for (const result of results) {
    if (result.timedOut || result.points.length === 0) {
      console.error(`${id}: ${result.suite}:${result.file} reported no tests (exit ${result.exitCode}).\n${result.stderr}`)
      failed = true
    }
  }
  const expectedFor = (name, spec) => {
    const selected = selectPoints(points, spec.tests)
    const failing = selected.filter((point) => !point.ok)
    if (failing.length) {
      failed = true
      console.error(`${id} ${name}: the reference fails ${failing.length} selected tests:\n  ${failing.map((point) => point.name).join("\n  ")}`)
    }
    if (selected.length === 0) {
      failed = true
      console.error(`${id} ${name}: no tests selected.`)
    }
    return selected.map((point) => point.name)
  }
  const expected = {
    create: expectedFor("create", library.create),
    features: Object.fromEntries(Object.entries(library.features).map(([feature, spec]) => [feature, expectedFor(feature, spec)])),
  }
  const text = `${JSON.stringify(expected, null, 2)}\n`
  const path = join(root, "expected.json")
  if (check) {
    const current = await readFile(path, "utf8").catch(() => "")
    if (current !== text) {
      failed = true
      console.error(`${id}: expected.json does not match the reference run.`)
    }
  } else {
    await writeFile(path, text)
  }
  const summary = [`create ${expected.create.length}`, ...Object.entries(expected.features).map(([feature, names]) => `${feature} ${names.length}`)]
  console.log(`${id}: ${summary.join(", ")}`)
}
if (failed) process.exit(1)
