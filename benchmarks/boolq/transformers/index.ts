interface BoolqSourceRow {
  question: string
  passage: string
  answer: boolean
}

interface TransformerInput {
  sources: Record<string, { path: string; content: string; sha256: string }>
}

export default {
  name: "BoolQ validation transformer",

  transform({ sources }: TransformerInput) {
    const source = sources.validation
    if (!source) throw new Error("BoolQ requires the validation source.")

    return source.content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => {
        const row = JSON.parse(line) as BoolqSourceRow
        if (
          !row.question?.trim() ||
          !row.passage?.trim() ||
          typeof row.answer !== "boolean"
        ) {
          throw new Error(`BoolQ validation row ${index + 1} is malformed.`)
        }
        const answer = row.answer ? "YES" : "NO"
        return {
          id: `validation-row-${index + 1}`,
          prompt: [
            `Passage:\n${row.passage}`,
            `Question:\n${row.question}`,
            'Answer YES or NO. End your response with "FINAL ANSWER: <answer>".',
          ].join("\n\n"),
          description: "BoolQ validation passage-based yes-or-no question.",
          evaluate: {
            kind: "answer_bank" as const,
            answers: [`FINAL ANSWER: ${answer}`],
            forbiddenAnswers: [
              `FINAL ANSWER: ${answer === "YES" ? "NO" : "YES"}`,
            ],
          },
        }
      })
  },
}
