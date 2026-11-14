import { join } from "node:path"
import ts from "typescript"
import { GRADER_ROOT } from "./paths.mjs"

export const COMPILER_OPTIONS = {
  strict: true,
  noEmit: true,
  target: ts.ScriptTarget.ES2023,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  lib: ["lib.es2023.d.ts"],
  types: ["node"],
  typeRoots: [join(GRADER_ROOT, "node_modules", "@types")],
  skipLibCheck: true,
  allowImportingTsExtensions: false,
  forceConsistentCasingInFileNames: true,
}

let previous

// Hard gate: `index.ts` (the submission) and `conformance.ts` (hidden
// usage of the documented API) must compile under strict mode. Errors are
// counted per file so details separate the module's own errors from API
// mismatches.
export function typecheck(directory, extraOptions = {}) {
  const roots = [join(directory, "index.ts"), join(directory, "conformance.ts")]
  const options = { ...COMPILER_OPTIONS, ...extraOptions }
  const program = ts.createProgram({ rootNames: roots, options, oldProgram: previous })
  previous = program
  const diagnostics = ts.getPreEmitDiagnostics(program).filter((item) => item.category === ts.DiagnosticCategory.Error)
  const counts = { module: 0, conformance: 0, other: 0 }
  const errors = diagnostics.map((item) => {
    const file = item.file?.fileName ?? null
    const where = file === roots[0] ? "module" : file === roots[1] ? "conformance" : "other"
    counts[where] += 1
    const position = item.file && item.start !== undefined ? item.file.getLineAndCharacterOfPosition(item.start) : null
    return {
      file: where,
      line: position ? position.line + 1 : null,
      code: item.code,
      message: ts.flattenDiagnosticMessageText(item.messageText, "\n").slice(0, 300),
    }
  })
  return { ok: errors.length === 0, errorCount: errors.length, counts, errors }
}

export function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, sourceMap: false },
    fileName: "index.ts",
  }).outputText
}
