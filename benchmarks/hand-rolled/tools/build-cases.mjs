// Builds the case files from the library specs and grader metadata, and
// rewrites provenance.json with the hashes of every input and output.
//
//   node tools/build-cases.mjs          write evals/*.jsonl and provenance.json
//   node tools/build-cases.mjs --check  fail if either would change
import { createHash } from "node:crypto"
import { readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const LIBRARIES = join(ROOT, "grader", "libraries")
const TIERS = ["tiny", "medium", "hard"]
const check = process.argv.includes("--check")
const sha256 = (text) => createHash("sha256").update(text).digest("hex")

const RULES = `## Rules

- Answer with the complete module, \`index.ts\`, in a single \`\`\`ts code block. Only the code block is graded.
- Import only Node.js built-in modules (for example \`node:crypto\`). Importing any other package scores 0.
- The module must compile under \`tsc --strict\` (TypeScript 6, target ES2023, NodeNext modules, \`@types/node\` 24) and must not throw while it is imported. Either failure scores 0.
- Export exactly the API above: the same names, the same default export and compatible types.
- Match the library's observable behaviour exactly: return values, mutations, edge cases, and thrown errors (the same error type and message).
- Hidden tests from the library's own test suite and generated inputs compared against the real library decide the score.`

const libraries = []
for (const id of (await readdir(LIBRARIES)).sort()) {
  const library = JSON.parse(await readFile(join(LIBRARIES, id, "library.json"), "utf8"))
  libraries.push(library)
}
libraries.sort((left, right) => TIERS.indexOf(left.tier) - TIERS.indexOf(right.tier) || left.id.localeCompare(right.id))

const spec = (id, name) => readFile(join(ROOT, "specs", id, `${name}.md`), "utf8").then((text) => text.trim())
const create = []
const feature = []
for (const library of libraries) {
  const { id, tier, title } = library
  const { name, version } = library.package
  create.push({
    id: `create-${id}`,
    groups: ["create", tier, id],
    description: `Reimplement ${title} (${name}@${version}).`,
    prompt: `# Create: ${title}\n\nWrite a dependency-free TypeScript implementation of the public API of the npm package \`${name}\` (version ${version}) described below. Code written against the package must behave the same with your module.\n\n## The library\n\n${await spec(id, "create")}\n\n${RULES}\n`,
    data: { setting: "create", library: id },
  })
  for (const [featureId, target] of Object.entries(library.features)) {
    feature.push({
      id: `feature-${id}-${featureId.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      groups: ["feature", tier, id],
      description: `${title}: ${target.title}.`,
      prompt: `# Feature: ${title}, ${target.title.charAt(0).toLowerCase()}${target.title.slice(1)}\n\nImplement exactly this feature of the npm package \`${name}\` (version ${version}), edge cases included, as a dependency-free TypeScript module.\n\n## The feature\n\n${await spec(id, featureId)}\n\n${RULES}\n`,
      data: { setting: "feature", library: id, feature: featureId },
    })
  }
}

const jsonl = (rows) => rows.map((row) => JSON.stringify(row)).join("\n") + "\n"
const outputs = {
  "evals/create.jsonl": jsonl(create),
  "evals/feature.jsonl": jsonl(feature),
}
const provenance = {
  upstreamRepository: "https://github.com/TrunchbullCI/examples/tree/main/benchmarks/hand-rolled",
  upstreamRevision: "hand-rolled 1.0.0",
  license: "MIT AND ISC AND BSD-2-Clause AND BSD-3-Clause",
  sourceFormat: `Upstream test suites of ${libraries.length} npm packages, vendored at pinned commits (grader/libraries/*/library.json)`,
  sources: await Promise.all(
    libraries.map(async (library) => ({
      path: `grader/libraries/${library.id}/library.json`,
      sha256: sha256(await readFile(join(LIBRARIES, library.id, "library.json"), "utf8")),
    }))
  ),
  generatedFiles: [
    { path: "evals/create.jsonl", sha256: sha256(outputs["evals/create.jsonl"]), caseCount: create.length },
    { path: "evals/feature.jsonl", sha256: sha256(outputs["evals/feature.jsonl"]), caseCount: feature.length },
    ...(await Promise.all(
      libraries.map(async (library) => ({
        path: `grader/libraries/${library.id}/expected.json`,
        sha256: sha256(await readFile(join(LIBRARIES, library.id, "expected.json"), "utf8")),
      }))
    )),
  ],
}
outputs["provenance.json"] = `${JSON.stringify(provenance, null, 2)}\n`

let stale = false
for (const [path, text] of Object.entries(outputs)) {
  if (check) {
    const current = await readFile(join(ROOT, path), "utf8").catch(() => "")
    if (current !== text) {
      stale = true
      console.error(`${path} is out of date; run node tools/build-cases.mjs.`)
    }
  } else {
    await writeFile(join(ROOT, path), text)
  }
}
console.log(`${libraries.length} libraries: ${create.length} create cases, ${feature.length} feature cases`)
if (stale) process.exit(1)
