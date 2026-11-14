// Parses TAP from every upstream runner the grader uses (mocha's tap
// reporter, tape, node-tap and node:test) into leaf test points, each named
// by its full path. A subtest's own closing point is a leaf only when the
// subtest reported nothing inside it.
export function parseTap(text) {
  const points = []
  const stack = []
  let group = null
  let yamlIndent = null
  for (const line of text.split(/\r?\n/)) {
    const indent = line.search(/\S/)
    if (indent < 0) continue
    const body = line.slice(indent).trimEnd()
    if (yamlIndent !== null) {
      if (body === "..." && indent === yamlIndent) yamlIndent = null
      continue
    }
    if (body === "---") {
      yamlIndent = indent
      continue
    }
    if (body.startsWith("Bail out!")) break
    if (body.startsWith("# Subtest:")) {
      while (stack.length && stack.at(-1).indent >= indent) stack.pop()
      stack.push({ indent, name: body.slice(10).trim(), children: 0 })
      continue
    }
    if (indent === 0 && body.startsWith("# ")) {
      group = body.slice(2).trim()
      continue
    }
    const point = /^(not )?ok\b\s*(?:\d+)?\s*(?:-\s+)?(.*)$/.exec(body)
    if (!point) continue
    let description = point[2]
    const directive = /\s*#\s*(SKIP|TODO)\b.*$/i.exec(description)
    if (directive) description = description.slice(0, directive.index)
    description = description.replace(/\s+#\s+time=.*$/, "").trim()
    while (stack.length && stack.at(-1).indent > indent) stack.pop()
    const top = stack.at(-1)
    if (top && top.indent === indent && top.name === description) {
      stack.pop()
      if (top.children > 0) continue
    }
    for (const frame of stack) frame.children += 1
    const path = [
      ...(stack.length === 0 && group ? [group] : []),
      ...stack.map((frame) => frame.name),
      description,
    ].filter(Boolean)
    points.push({
      name: path.join(" › "),
      ok: !point[1],
      directive: directive ? directive[1].toUpperCase() : null,
    })
  }
  return points
}
