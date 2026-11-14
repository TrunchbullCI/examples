import { isBuiltin } from "node:module"
import ts from "typescript"

// Hard gate: the module may import only the Node.js standard library. Every
// static import or export-from, import(), require() and import-equals must
// name a built-in module with a literal specifier.
export function checkImports(source, allowed = []) {
  const file = ts.createSourceFile("index.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const violations = []
  const allow = (specifier) =>
    isBuiltin(specifier) || allowed.some((name) => specifier === name || specifier.startsWith(`${name}/`))
  const record = (node, specifier, reason) => {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file))
    violations.push({ line: line + 1, specifier, reason })
  }
  const checkSpecifier = (node, expression, kind) => {
    if (!expression || !ts.isStringLiteralLike(expression)) {
      record(node, null, `${kind} with a non-literal specifier`)
      return
    }
    if (!allow(expression.text)) record(node, expression.text, `${kind} outside the Node.js standard library`)
  }
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) checkSpecifier(node, node.moduleSpecifier, "import")
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      checkSpecifier(node, node.moduleReference.expression, "import")
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) checkSpecifier(node, node.arguments[0], "dynamic import")
      else if (ts.isIdentifier(node.expression) && node.expression.text === "require") checkSpecifier(node, node.arguments[0], "require")
    } else if (ts.isImportTypeNode(node)) {
      const literal = ts.isLiteralTypeNode(node.argument) ? node.argument.literal : null
      checkSpecifier(node, literal, "type import")
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return { ok: violations.length === 0, violations }
}
