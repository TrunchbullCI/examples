interface PiqaSourceRow {
  id: string
  goal: string
  sol1: string
  sol2: string
}

interface TransformerInput {
  sources: Record<string, { path: string; content: string; sha256: string }>
}

export default {
  name: "PIQA validation transformer",

  transform({ sources }: TransformerInput) {
    const validation = sources.validation
    const labelsSource = sources.labels
    if (!validation || !labelsSource) {
      throw new Error("PIQA requires validation cases and their labels.")
    }

    const rows = validation.content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as PiqaSourceRow)
    const labels = labelsSource.content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (rows.length !== labels.length) {
      throw new Error(
        `PIQA validation cases (${rows.length}) and labels (${labels.length}) differ.`
      )
    }

    return rows.map((row, index) => {
      const label = labels[index]
      if (
        !row.id ||
        !row.goal?.trim() ||
        !row.sol1?.trim() ||
        !row.sol2?.trim() ||
        (label !== "0" && label !== "1")
      ) {
        throw new Error(`PIQA validation row ${index + 1} is malformed.`)
      }
      const answer = label === "0" ? "A" : "B"
      return {
        id: `validation-${row.id}`,
        prompt: [row.goal, "", `A. ${row.sol1}`, `B. ${row.sol2}`].join("\n"),
        description: "PIQA validation physical commonsense problem.",
        evaluate: {
          kind: "answer_bank" as const,
          answers: [`FINAL ANSWER: ${answer}`],
          forbiddenAnswers: [`FINAL ANSWER: ${answer === "A" ? "B" : "A"}`],
        },
      }
    })
  },
}
