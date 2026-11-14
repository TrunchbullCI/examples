import { randomUUID } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { performance } from "node:perf_hooks"
import { extractModule } from "./extract.mjs"
import { checkImports } from "./imports.mjs"
import { HARNESS_ROOT, HOOKS, libraryRoot } from "./paths.mjs"
import { runProcess } from "./process.mjs"
import { runSuites, scoreTests, selectPoints } from "./suites.mjs"
import { transpile, typecheck } from "./typecheck.mjs"

const LOAD_TIMEOUT_MS = 10_000
const FUZZ_TIMEOUT_MS = 20_000
const MAX_DETAILS_BYTES = 30_000

export class GradeError extends Error {}

const libraries = new Map()
const referenceModules = new Map()
const referenceOutcomes = new Map()

export async function loadLibrary(id) {
  if (typeof id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new GradeError("caseData.library is invalid.")
  if (!libraries.has(id)) {
    const root = libraryRoot(id)
    libraries.set(
      id,
      Promise.all([readFile(join(root, "library.json"), "utf8"), readFile(join(root, "expected.json"), "utf8")]).then(
        ([library, expected]) => ({ ...JSON.parse(library), root, expected: JSON.parse(expected) }),
        () => {
          libraries.delete(id)
          throw new GradeError(`Unknown library ${id}.`)
        }
      )
    )
  }
  return libraries.get(id)
}

export function resolveTarget(library, caseData) {
  if (caseData.setting === "create") {
    return { key: "create", spec: library.create, expected: library.expected.create }
  }
  if (caseData.setting === "feature") {
    const spec = library.features?.[caseData.feature]
    const expected = library.expected.features?.[caseData.feature]
    if (!spec || !expected) throw new GradeError(`Unknown feature ${caseData.feature} of ${library.id}.`)
    return { key: `feature:${caseData.feature}`, spec, expected }
  }
  throw new GradeError("caseData.setting must be create or feature.")
}

async function prepare(library, spec, source) {
  const directory = join(library.root, ".work", randomUUID())
  await mkdir(directory, { recursive: true })
  await Promise.all([
    writeFile(join(directory, "package.json"), '{ "type": "module" }\n'),
    writeFile(join(directory, "index.ts"), source),
    readFile(join(library.root, spec.conformance), "utf8").then((text) => writeFile(join(directory, "conformance.ts"), text)),
  ])
  return directory
}

async function checkLoad(modulePath) {
  const result = await runProcess(process.execPath, [join(HARNESS_ROOT, "load-child.mjs"), modulePath], {
    cwd: join(modulePath, ".."),
    env: { PATH: process.env.PATH ?? "/usr/bin:/bin", TZ: "UTC", NO_COLOR: "1" },
    timeoutMs: LOAD_TIMEOUT_MS,
    channel: true,
  })
  const line = result.channel.split("\n").find(Boolean)
  if (line) return JSON.parse(line)
  return {
    ok: false,
    error: result.timedOut
      ? "Loading the module did not finish within 10 s."
      : `The process exited while loading (code ${result.exitCode}, signal ${result.signal}): ${result.stderr.slice(-500)}`,
  }
}

async function runFuzz(library, subjectPath, targets) {
  if (targets.length === 0) return new Map()
  const result = await runProcess(
    process.execPath,
    ["--import", HOOKS, join(HARNESS_ROOT, "fuzz-child.mjs"), library.root, library.id, subjectPath, targets.join(",")],
    {
      cwd: library.root,
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin", TZ: "UTC", NO_COLOR: "1", LANG: "C.UTF-8" },
      timeoutMs: FUZZ_TIMEOUT_MS,
      channel: true,
    }
  )
  const outcomes = new Map()
  for (const line of result.channel.split("\n")) {
    if (!line) continue
    const entry = JSON.parse(line)
    if (entry.loadError) {
      outcomes.set("load", entry)
      continue
    }
    outcomes.set(`${entry.target}#${entry.index}`, entry)
  }
  if (result.timedOut) outcomes.set("timeout", true)
  return outcomes
}

export async function referenceModule(library) {
  if (!referenceModules.has(library.id)) {
    referenceModules.set(
      library.id,
      (async () => {
        const directory = join(library.root, ".work", "reference")
        await mkdir(directory, { recursive: true })
        const source = await readFile(join(library.root, library.reference), "utf8")
        const path = join(directory, "index.mjs")
        await writeFile(join(directory, "package.json"), '{ "type": "module" }\n')
        await writeFile(path, transpile(source))
        return path
      })()
    )
  }
  return referenceModules.get(library.id)
}

async function referenceFuzz(library, targets) {
  const key = `${library.id}:${targets.join(",")}`
  if (!referenceOutcomes.has(key)) {
    referenceOutcomes.set(
      key,
      referenceModule(library).then(async (path) => {
        const outcomes = await runFuzz(library, path, targets)
        if (outcomes.has("load") || outcomes.has("timeout")) {
          referenceOutcomes.delete(key)
          throw new Error(`The ${library.id} reference failed its own fuzz run.`)
        }
        return outcomes
      })
    )
  }
  return referenceOutcomes.get(key)
}

function compareFuzz(expected, observed) {
  let agreed = 0
  const mismatches = []
  for (const [key, reference] of expected) {
    const received = observed.get(key)
    const same =
      received &&
      (reference.thrown !== undefined ? received.thrown === reference.thrown : received.thrown === undefined && received.value === reference.value)
    if (same) {
      agreed += 1
      continue
    }
    if (mismatches.length < 10) {
      mismatches.push({
        case: key,
        input: reference.input,
        expected: (reference.thrown !== undefined ? `throws ${reference.thrown}` : reference.value).slice(0, 200),
        received: received
          ? (received.thrown !== undefined ? `throws ${received.thrown}` : received.value).slice(0, 200)
          : observed.has("load")
            ? `module failed to load: ${observed.get("load").loadError}`.slice(0, 200)
            : "no result (the fuzz process crashed or timed out)",
      })
    }
  }
  return { agreed, total: expected.size, mismatches }
}

function fraction(passed, total) {
  return total === 0 ? 1 : passed / total
}

function bounded(details) {
  const trim = (list, size) => (Array.isArray(list) ? list.slice(0, size) : list)
  for (const size of [25, 10, 5, 2, 0]) {
    const copy = structuredClone(details)
    if (copy.gates?.typecheck) copy.gates.typecheck.errors = trim(copy.gates.typecheck.errors, size)
    if (copy.tests) copy.tests.failures = trim(copy.tests.failures, size)
    if (copy.fuzz) copy.fuzz.mismatches = trim(copy.fuzz.mismatches, size)
    if (copy.tests?.crashedFiles) copy.tests.crashedFiles = trim(copy.tests.crashedFiles, size)
    if (Buffer.byteLength(JSON.stringify(copy)) <= MAX_DETAILS_BYTES) return copy
  }
  return { library: details.library, setting: details.setting, truncated: true }
}

// Grades one answer. Hard gates (imports, strict typecheck, load) score 0
// and are all reported; otherwise the score is the fraction of the hidden
// upstream tests that pass times the fraction of fuzz inputs on which the
// module matches the real library.
export async function grade(request, options = {}) {
  const started = performance.now()
  const caseData = request?.caseData
  if (!caseData || typeof caseData !== "object") throw new GradeError("caseData must be an object.")
  const library = await loadLibrary(caseData.library)
  const target = resolveTarget(library, caseData)
  const source = extractModule(request.output)
  const timings = {}
  const details = {
    library: library.id,
    setting: caseData.setting,
    ...(caseData.feature ? { feature: caseData.feature } : {}),
    moduleBytes: Buffer.byteLength(source),
  }
  const directory = await prepare(library, target.spec, source)
  try {
    let mark = performance.now()
    const imports = checkImports(source, options.allowImports ?? [])
    const types = typecheck(directory)
    timings.typecheck = Math.round(performance.now() - mark)
    let load = { ok: false, skipped: "The import gate failed, so the module was not executed." }
    const modulePath = join(directory, "index.mjs")
    if (imports.ok) {
      mark = performance.now()
      await writeFile(modulePath, transpile(source))
      load = await checkLoad(modulePath)
      timings.load = Math.round(performance.now() - mark)
    }
    details.gates = {
      imports: { ok: imports.ok, errorCount: imports.violations.length, violations: imports.violations.slice(0, 20) },
      typecheck: { ok: types.ok, errorCount: types.errorCount, counts: types.counts, errors: types.errors.slice(0, 25) },
      load: load.ok ? { ok: true, errorCount: 0 } : { ok: false, errorCount: 1, error: String(load.error ?? load.skipped).slice(0, 1000) },
    }
    const failed = Object.entries(details.gates)
      .filter(([, gate]) => !gate.ok)
      .map(([name]) => name)
    if (source.trim() === "") failed.unshift("empty")
    if (failed.length > 0) {
      timings.total = Math.round(performance.now() - started)
      details.timingsMs = timings
      return {
        score: 0,
        passed: false,
        message: `Hard gate failed: ${failed.join(", ")}.`,
        details: bounded(details),
      }
    }
    mark = performance.now()
    const suiteIds = [...new Set(target.spec.tests.map((selector) => selector.suite))]
    const [suiteResults, expectedFuzz, observedFuzz] = await Promise.all([
      runSuites(library, suiteIds, modulePath),
      referenceFuzz(library, target.spec.fuzz),
      runFuzz(library, modulePath, target.spec.fuzz),
    ])
    timings.testsAndFuzz = Math.round(performance.now() - mark)
    const observed = selectPoints(
      suiteResults.flatMap((result) => result.points),
      target.spec.tests
    )
    const tests = scoreTests(target.expected, observed)
    const fuzz = compareFuzz(expectedFuzz, observedFuzz)
    const testFraction = fraction(tests.passed, tests.total)
    const fuzzFraction = fraction(fuzz.agreed, fuzz.total)
    const score = testFraction * fuzzFraction
    details.tests = {
      passed: tests.passed,
      total: tests.total,
      fraction: testFraction,
      failures: tests.failures,
      crashedFiles: suiteResults
        .filter((result) => result.timedOut || (result.exitCode !== 0 && result.points.length === 0))
        .map((result) => ({ file: `${result.suite}:${result.file}`, timedOut: result.timedOut, stderr: result.stderr.slice(-300) })),
    }
    details.fuzz = { agreed: fuzz.agreed, total: fuzz.total, fraction: fuzzFraction, mismatches: fuzz.mismatches }
    timings.total = Math.round(performance.now() - started)
    details.timingsMs = timings
    return {
      score,
      passed: score === 1,
      message: `Upstream tests ${tests.passed}/${tests.total}; fuzz agreement ${fuzz.agreed}/${fuzz.total}.`,
      details: bounded(details),
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
