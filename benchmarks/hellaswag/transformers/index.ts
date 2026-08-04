interface HellaSwagSourceRow {
  ind: number
  ctx: string
  endings: string[]
  label: number
}

interface TransformerInput {
  sources: Record<string, { path: string; content: string; sha256: string }>
}

const choiceLabels = ["A", "B", "C", "D"] as const

export default {
  name: "HellaSwag validation transformer",

  transform({ sources }: TransformerInput) {
    const source = sources.validation
    if (!source) throw new Error("HellaSwag requires the validation source.")

    return source.content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => {
        const row = JSON.parse(line) as HellaSwagSourceRow
        if (
          !Number.isInteger(row.ind) ||
          !row.ctx?.trim() ||
          !Array.isArray(row.endings) ||
          row.endings.length !== choiceLabels.length ||
          row.endings.some((ending) => !ending?.trim()) ||
          !Number.isInteger(row.label) ||
          row.label < 0 ||
          row.label >= choiceLabels.length
        ) {
          throw new Error(`HellaSwag validation row ${index + 1} is malformed.`)
        }
        const answer = choiceLabels[row.label]!
        return {
          id: `validation-row-${index + 1}`,
          prompt: [
            row.ctx,
            "",
            ...row.endings.map(
              (ending, endingIndex) => `${choiceLabels[endingIndex]}. ${ending}`
            ),
          ].join("\n"),
          description: "HellaSwag validation commonsense continuation.",
          evaluate: {
            kind: "answer_bank" as const,
            answers: [`FINAL ANSWER: ${answer}`],
            forbiddenAnswers: choiceLabels
              .filter((label) => label !== answer)
              .map((label) => `FINAL ANSWER: ${label}`),
          },
        }
      })
  },
}
