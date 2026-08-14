interface MihenkSourceRow {
  id: string
  language: "tr" | "en"
  discipline: string
  format: "multiple_choice" | "short_answer"
  difficulty: "L1" | "L2" | "L3" | "L4"
  question: string
  choices: Record<string, string> | null
  answer: string | null
  answer_short: string | null
  answer_aliases?: string[]
  split: "public"
}

interface TransformerInput {
  sources: Record<string, { path: string; content: string; sha256: string }>
}

const multipleChoiceSystemPrompt =
  "You are taking a multiple-choice exam. Read the question and the options, then reply with ONLY the single letter (A, B, C, D or E) of the correct option. Do not explain, do not add punctuation — output just the letter."

const shortAnswerSystemPrompt =
  "You are taking a short-answer exam. Read the question and reply with ONLY the answer, in at most 7 words. Do not explain and do not add a full sentence — output just the answer."

function promptFor(row: MihenkSourceRow) {
  if (row.format === "short_answer") return row.question
  return [
    row.question,
    "",
    ...Object.entries(row.choices ?? {}).map(
      ([label, choice]) => `${label}) ${choice}`
    ),
  ].join("\n")
}

export default {
  name: "MIHENK complete public-split transformer",

  transform({ sources }: TransformerInput) {
    const source = sources.public
    if (!source) throw new Error("MIHENK requires the public source split.")

    return source.content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => {
        const row = JSON.parse(line) as MihenkSourceRow
        const choices = Object.entries(row.choices ?? {})
        const multipleChoiceValid =
          row.format === "multiple_choice" &&
          choices.length >= 2 &&
          choices.length <= 5 &&
          row.answer !== null &&
          choices.some(([label]) => label === row.answer)
        const shortAnswerValid =
          row.format === "short_answer" &&
          row.choices === null &&
          row.answer === null &&
          Boolean(row.answer_short?.trim())

        if (
          !row.id ||
          !row.question?.trim() ||
          row.split !== "public" ||
          !["tr", "en"].includes(row.language) ||
          !["L1", "L2", "L3", "L4"].includes(row.difficulty) ||
          (!multipleChoiceValid && !shortAnswerValid)
        ) {
          throw new Error(`MIHENK public row ${index + 1} is malformed.`)
        }

        return {
          id: row.id.toLowerCase(),
          prompt: promptFor(row),
          description: `${row.language.toUpperCase()} ${row.difficulty} ${row.discipline} ${row.format.replace("_", " ")} question from the MIHENK public split.`,
          systemPrompt:
            row.format === "multiple_choice"
              ? multipleChoiceSystemPrompt
              : shortAnswerSystemPrompt,
          data: {
            format: row.format,
            language: row.language,
            difficulty: row.difficulty,
            discipline: row.discipline,
            answer: row.answer,
            answerShort: row.answer_short,
            answerAliases: row.answer_aliases ?? [],
          },
        }
      })
  },
}
