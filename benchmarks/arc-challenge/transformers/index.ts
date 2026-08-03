interface ArcSourceRow {
  id: string
  question: string | { stem: string }
  choices: {
    label: string[]
    text: string[]
  }
  answerKey: string
}

interface TransformerInput {
  sources: Record<string, { path: string; content: string; sha256: string }>
}

const splits = ["train", "validation", "test"] as const

function normalizeId(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
}

export default {
  name: "ARC-Challenge complete-splits transformer",

  transform({ sources }: TransformerInput) {
    return splits.flatMap((split) => {
      const source = sources[split]
      if (!source)
        throw new Error(`ARC-Challenge requires the ${split} source.`)

      return source.content
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line, index) => {
          const row = JSON.parse(line) as ArcSourceRow
          const labels = row.choices.label
          const choices = row.choices.text
          const stem =
            typeof row.question === "string" ? row.question : row.question.stem
          if (
            !row.id ||
            !stem ||
            labels.length !== choices.length ||
            labels.length < 2 ||
            !labels.includes(row.answerKey)
          ) {
            throw new Error(`ARC ${split} row ${index + 1} is malformed.`)
          }
          return {
            id: `${split}-${normalizeId(row.id)}`,
            prompt: [
              stem,
              "",
              ...choices.map(
                (choice, choiceIndex) => `${labels[choiceIndex]}. ${choice}`
              ),
            ].join("\n"),
            description: `ARC-Challenge ${split} split science reasoning question.`,
            evaluate: {
              kind: "answer_bank" as const,
              answers: [`FINAL ANSWER: ${row.answerKey}`],
              forbiddenAnswers: labels
                .filter((label) => label !== row.answerKey)
                .map((label) => `FINAL ANSWER: ${label}`),
            },
          }
        })
    })
  },
}
