interface ArcSourceRow {
  id: string
  question: {
    stem: string
    choices: {
      label: string[]
      text: string[]
    }
  }
  answerKey: string
}

interface TransformerInput {
  sources: Record<string, { path: string; content: string; sha256: string }>
}

function normalizeId(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
}

export default {
  name: "ARC-Challenge transformer",

  transform({ sources }: TransformerInput) {
    const source = sources.cases
    if (!source) throw new Error("ARC-Challenge requires the cases source.")

    return source.content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => {
        const row = JSON.parse(line) as ArcSourceRow
        const labels = row.question.choices.label
        const choices = row.question.choices.text
        if (
          labels.length !== choices.length ||
          !labels.includes(row.answerKey)
        ) {
          throw new Error(`ARC source row ${index + 1} is malformed.`)
        }
        return {
          id: normalizeId(row.id),
          prompt: [
            row.question.stem,
            "",
            ...choices.map(
              (choice, choiceIndex) => `${labels[choiceIndex]}. ${choice}`
            ),
          ].join("\n"),
          description: "ARC-Challenge science reasoning question.",
          evaluate: {
            kind: "answer_bank" as const,
            answers: [`FINAL ANSWER: ${row.answerKey}`],
            forbiddenAnswers: labels
              .filter((label) => label !== row.answerKey)
              .map((label) => `FINAL ANSWER: ${label}`),
          },
        }
      })
  },
}
