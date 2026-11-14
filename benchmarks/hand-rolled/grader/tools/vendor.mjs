// Copies a library's upstream test files byte for byte from the pinned
// upstream commit and records their SHA-256 in library.json `vendor`.
//
//   node tools/vendor.mjs <library> [--from <local checkout at the commit>]
//   node tools/vendor.mjs --check [library...]   verify every vendored hash
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { LIBRARIES_ROOT, libraryRoot } from "../harness/paths.mjs"

const args = process.argv.slice(2)
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")

if (args.includes("--check")) {
  const requested = args.filter((arg) => !arg.startsWith("--"))
  const ids = requested.length ? requested : (await readdir(LIBRARIES_ROOT)).sort()
  let failed = false
  for (const id of ids) {
    const library = JSON.parse(await readFile(join(libraryRoot(id), "library.json"), "utf8"))
    for (const file of library.vendor) {
      const actual = sha256(await readFile(join(libraryRoot(id), file.to)))
      if (actual !== file.sha256) {
        failed = true
        console.error(`${id}: ${file.to} does not match its recorded upstream hash.`)
      }
    }
    console.log(`${id}: ${library.vendor.length} vendored files verified`)
  }
  process.exit(failed ? 1 : 0)
}

const [id] = args
const fromIndex = args.indexOf("--from")
const from = fromIndex >= 0 ? args[fromIndex + 1] : null
const root = libraryRoot(id)
const path = join(root, "library.json")
const library = JSON.parse(await readFile(path, "utf8"))
const { repository, commit } = library.upstream
if (from) {
  const head = execFileSync("git", ["-C", from, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  if (head !== commit) throw new Error(`${from} is at ${head}, not the pinned ${commit}.`)
}
const slug = new URL(repository).pathname.replace(/^\/|\.git$|\/$/g, "")
for (const file of library.vendor) {
  const bytes = from
    ? await readFile(join(from, file.from))
    : Buffer.from(
        await fetch(`https://raw.githubusercontent.com/${slug}/${commit}/${file.from}`).then((response) => {
          if (!response.ok) throw new Error(`${file.from}: HTTP ${response.status}`)
          return response.arrayBuffer()
        })
      )
  await mkdir(dirname(join(root, file.to)), { recursive: true })
  await writeFile(join(root, file.to), bytes)
  file.sha256 = sha256(bytes)
}
await writeFile(path, `${JSON.stringify(library, null, 2)}\n`)
console.log(`${id}: vendored ${library.vendor.length} files from ${slug}@${commit}`)
