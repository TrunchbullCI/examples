// The model answers with one TypeScript module. Take the last fenced block
// tagged ts/typescript (or the last fenced block of any kind); an answer with
// no fence is used as is.
export function extractModule(output) {
  const text = typeof output === "string" ? output : ""
  const blocks = [...text.matchAll(/```([A-Za-z0-9_+-]*)[^\n]*\n([\s\S]*?)```/g)]
  const typed = blocks.filter((block) => /^(ts|typescript|tsx|mts)$/i.test(block[1]))
  const chosen = typed.at(-1) ?? blocks.at(-1)
  return chosen ? chosen[2] : text
}
