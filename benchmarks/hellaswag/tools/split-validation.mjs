// Regenerates data/validation-{1,2,3}.jsonl from the pinned upstream
// hellaswag_val.jsonl. Each part stays under the 5 MB limit for dataset files
// committed to a Trunchbull Repository; the transformer reads them in order.
//
//   node tools/split-validation.mjs path/to/hellaswag_val.jsonl
//
// The input must be the upstream file at the pinned revision; its sha256 is
// checked before anything is written.
import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const upstreamSha256 =
  "0aa3b88843990f3f10a97b9575c94d7b71fb2205240ba04ae4884d9e9c992588"
const partEnds = [4500, 7300, 10042]
const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const input = process.argv[2]
if (!input) throw new Error("Pass the path to the upstream hellaswag_val.jsonl.")
const bytes = await readFile(input)
const digest = createHash("sha256").update(bytes).digest("hex")
if (digest !== upstreamSha256) {
  throw new Error(
    `Upstream validation split has sha256 ${digest}, expected ${upstreamSha256}.`
  )
}
const lines = bytes.toString("utf8").split("\n").filter(Boolean)
if (lines.length !== partEnds.at(-1)) {
  throw new Error(`Expected ${partEnds.at(-1)} rows, found ${lines.length}.`)
}
let start = 0
for (const [index, end] of partEnds.entries()) {
  const path = resolve(packageDirectory, `data/validation-${index + 1}.jsonl`)
  await writeFile(path, lines.slice(start, end).map((row) => `${row}\n`).join(""))
  console.log(`${path}: rows ${start + 1}-${end}`)
  start = end
}
