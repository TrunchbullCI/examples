interface Gsm8kSourceRow {
  question: string
  answer: string
}

interface TransformerInput {
  sources: Record<string, { path: string; content: string; sha256: string }>
}

const splits = ["train", "test"] as const
const answerPattern = /#### (-?[0-9.,]+)/

export default {
  name: "GSM8K complete-splits transformer",

  transform({ sources }: TransformerInput) {
    return splits.flatMap((split) => {
      const source = sources[split]
      if (!source) throw new Error(`GSM8K requires the ${split} source.`)

      return source.content
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line, index) => {
          const row = JSON.parse(line) as Gsm8kSourceRow
          const expected = row.answer
            .match(answerPattern)?.[1]
            ?.trim()
            .replaceAll(",", "")
          if (!row.question?.trim() || !expected) {
            throw new Error(`GSM8K ${split} row ${index + 1} is malformed.`)
          }
          return {
            id: `${split}-row-${index + 1}`,
            prompt: row.question,
            description: `GSM8K ${split} split mathematics problem.`,
            evaluate: { kind: "gsm8k" as const, expected },
          }
        })
    })
  },
}
