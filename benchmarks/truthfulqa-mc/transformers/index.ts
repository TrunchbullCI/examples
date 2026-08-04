import { createHash } from "node:crypto"

interface TruthfulQaSourceRow {
  question: string
  mc1_targets: Record<string, 0 | 1>
}

interface TransformerInput {
  sources: Record<string, { path: string; content: string; sha256: string }>
}

const choiceLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

function stableChoiceOrder(question: string, choices: string[]) {
  const seed = createHash("sha256").update(question).digest()
  return choices
    .map((choice, index) => ({
      choice,
      // The upstream JSON stores the true choice first. Give every choice a
      // stable derived rank so the answer label cannot leak that ordering.
      rank: seed.readUInt32BE((index * 4) % 28),
    }))
    .sort((left, right) => left.rank - right.rank || left.choice.localeCompare(right.choice))
    .map(({ choice }) => choice)
}

export default {
  name: "TruthfulQA MC1 transformer",

  transform({ sources }: TransformerInput) {
    const source = sources.mc1
    if (!source) throw new Error("TruthfulQA MC1 requires the mc1 source.")

    const rows = JSON.parse(source.content) as TruthfulQaSourceRow[]
    if (!Array.isArray(rows)) throw new Error("TruthfulQA MC1 source must be an array.")

    return rows.map((row, index) => {
      const choices = Object.entries(row.mc1_targets)
      const correctAnswers = choices.filter(([, value]) => value === 1)
      const incorrectAnswers = choices.filter(([, value]) => value === 0)

      if (
        !row.question?.trim() ||
        correctAnswers.length !== 1 ||
        incorrectAnswers.length < 1 ||
        choices.length > choiceLabels.length
      ) {
        throw new Error(`TruthfulQA MC1 row ${index + 1} is malformed.`)
      }

      const correctAnswer = correctAnswers[0]?.[0]
      const orderedChoices = stableChoiceOrder(
        row.question,
        choices.map(([choice]) => choice)
      )
      const correctIndex = orderedChoices.indexOf(correctAnswer)
      if (correctIndex < 0) {
        throw new Error(`TruthfulQA MC1 row ${index + 1} lost its correct answer.`)
      }

      const labels = orderedChoices.map((_, choiceIndex) => choiceLabels[choiceIndex]!)
      const correctLabel = labels[correctIndex]!

      return {
        id: `mc1-${String(index + 1).padStart(4, "0")}`,
        prompt: [
          row.question,
          "",
          ...orderedChoices.map(
            (choice, choiceIndex) => `${labels[choiceIndex]}. ${choice}`
          ),
        ].join("\n"),
        description: "TruthfulQA MC1 single-true multiple-choice question.",
        evaluate: {
          kind: "answer_bank" as const,
          answers: [`FINAL ANSWER: ${correctLabel}`],
          forbiddenAnswers: labels
            .filter((label) => label !== correctLabel)
            .map((label) => `FINAL ANSWER: ${label}`),
        },
      }
    })
  },
}
