// Parity proof for every case of every library:
//   reference  the real package behind the documented API     -> 1
//   stub       the API with every body throwing               -> 0
//   empty      a module with no exports (fails conformance)    -> 0
//   forbidden  imports the real package                       -> 0
//   crash      the reference, throwing while it loads          -> 0
// The reference and crash fixtures may import their own package; nothing
// else may. Prints one JSON line per case and exits 1 on any mismatch.
//
//   node tools/parity.mjs [library...]
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { grade, loadLibrary } from "../harness/grade.mjs"
import { LIBRARIES_ROOT } from "../harness/paths.mjs"

const requested = process.argv.slice(2)
const ids = requested.length ? requested : (await readdir(LIBRARIES_ROOT)).sort()
let failures = 0
const fence = (code) => `Here is the module.\n\n\`\`\`ts\n${code}\n\`\`\`\n`

for (const id of ids) {
  const library = await loadLibrary(id)
  const reference = await readFile(join(library.root, library.reference), "utf8")
  const stub = await readFile(join(library.root, "stub.ts"), "utf8")
  const pkg = library.package.name
  const fixtures = {
    reference: { source: reference, allow: [pkg], expect: (result) => result.score === 1 },
    stub: { source: stub, allow: [], expect: (result) => result.score === 0 && result.details.gates.typecheck.ok && result.details.gates.load.ok },
    empty: { source: "export {}\n", allow: [], expect: (result) => result.score === 0 && !result.details.gates.typecheck.ok },
    forbidden: {
      source: `import * as real from "${pkg}"\nexport default real\n`,
      allow: [],
      expect: (result) => result.score === 0 && !result.details.gates.imports.ok,
    },
    crash: {
      source: `throw new Error("parity: crash while loading")\n${reference}`,
      allow: [pkg],
      expect: (result) => result.score === 0 && !result.details.gates.load.ok && /crash while loading/.test(result.details.gates.load.error),
    },
  }
  const targets = [{ setting: "create" }, ...Object.keys(library.features).map((feature) => ({ setting: "feature", feature }))]
  for (const target of targets) {
    for (const [name, fixture] of Object.entries(fixtures)) {
      const result = await grade(
        { protocolVersion: 1, caseId: `${id}-${target.feature ?? "create"}`, output: fence(fixture.source), caseData: { library: id, ...target } },
        { allowImports: fixture.allow }
      )
      const ok = fixture.expect(result)
      if (!ok) failures += 1
      console.log(
        JSON.stringify({
          library: id,
          target: target.feature ?? "create",
          fixture: name,
          ok,
          score: result.score,
          message: result.message,
          ...(ok ? {} : { details: result.details }),
          ms: result.details.timingsMs?.total,
        })
      )
    }
  }
}
if (failures) {
  console.error(`${failures} parity checks failed.`)
  process.exit(1)
}
