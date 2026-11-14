import { join } from "node:path"
import { HOOKS, HARNESS_ROOT } from "./paths.mjs"
import { mapLimit, runProcess } from "./process.mjs"
import { parseTap } from "./tap.mjs"

const FILE_TIMEOUT_MS = 20_000

function command(library, suite, file) {
  const root = join(library.root, suite.root ?? "suite")
  const path = join(root, file)
  switch (suite.runner) {
    case "mocha":
      return [
        join(library.root, "node_modules", "mocha", "bin", "mocha.js"),
        "--reporter",
        "tap",
        "--no-config",
        "--no-package",
        "--timeout",
        String(suite.timeoutMs ?? 5000),
        path,
      ]
    case "node-test":
      return ["--test-reporter=tap", path]
    case "node":
      return [path]
    default:
      throw new Error(`Unknown runner ${suite.runner}.`)
  }
}

// Runs every file of the selected suites against one subject and returns
// the leaf test points each file reported. A file that crashes or times out
// simply reports fewer points; the expected list decides what is missing.
export async function runSuites(library, suiteIds, subjectPath) {
  const jobs = library.suites
    .filter((suite) => suiteIds.includes(suite.id))
    .flatMap((suite) => suite.files.map((file) => ({ suite, file })))
  const results = await mapLimit(jobs, 4, async ({ suite, file }) => {
    const root = join(library.root, suite.root ?? "suite")
    const aliases = Object.fromEntries(
      Object.entries(library.aliases ?? {}).map(([key, target]) => [
        key,
        target.startsWith("harness:") ? join(HARNESS_ROOT, target.slice(8)) : join(library.root, target),
      ])
    )
    const result = await runProcess(process.execPath, ["--import", HOOKS, ...(suite.nodeArgs ?? []), ...command(library, suite, file)], {
      cwd: root,
      timeoutMs: suite.fileTimeoutMs ?? FILE_TIMEOUT_MS,
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        HOME: process.env.HOME ?? "/tmp",
        NODE_ENV: "test",
        NO_COLOR: "1",
        FORCE_COLOR: "0",
        TZ: "UTC",
        LANG: "C.UTF-8",
        HR_SUBJECT: subjectPath,
        HR_SUITE_ROOT: root,
        HR_ALIASES: JSON.stringify(aliases),
        ...(suite.env ?? {}),
      },
    })
    const points = parseTap(result.stdout).map((point) => ({ ...point, name: `${suite.id}:${file} › ${point.name}` }))
    return {
      suite: suite.id,
      file,
      points,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      stderr: result.stderr.slice(-2000),
    }
  })
  return results
}

export function selectPoints(points, selectors) {
  return points.filter((point) =>
    selectors.some((selector) => {
      if (!point.name.startsWith(`${selector.suite}:`)) return false
      if (selector.exclude && new RegExp(selector.exclude).test(point.name)) return false
      return selector.match ? new RegExp(selector.match).test(point.name) : true
    })
  )
}

// Scores observed points against the expected (reference) list by name, as
// multisets, so a test that runs more often than in the reference earns no
// extra credit and a missing test counts as a failure.
export function scoreTests(expected, observed) {
  const passes = new Map()
  for (const point of observed) {
    if (point.directive) continue
    if (point.ok) passes.set(point.name, (passes.get(point.name) ?? 0) + 1)
  }
  let passed = 0
  const failures = []
  for (const name of expected) {
    const available = passes.get(name) ?? 0
    if (available > 0) {
      passed += 1
      passes.set(name, available - 1)
    } else if (failures.length < 25) {
      failures.push(name)
    }
  }
  return { passed, total: expected.length, failures }
}
