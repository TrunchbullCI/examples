interface MihenkCaseData {
  format: "multiple_choice" | "short_answer"
  answer: string | null
  answerShort: string | null
  answerAliases: string[]
}

interface EvaluationInput {
  output: string
  caseData: MihenkCaseData
}

const maxShortAnswerWords = 7
const turkishLowercase = new Map([
  ["I", "ı"],
  ["İ", "i"],
  ["Ş", "ş"],
  ["Ğ", "ğ"],
  ["Ü", "ü"],
  ["Ö", "ö"],
  ["Ç", "ç"],
])

function lowerTurkish(value: string) {
  return [...value]
    .map((character) => turkishLowercase.get(character) ?? character)
    .join("")
    .toLowerCase()
}

function normalizeText(value: string) {
  return lowerTurkish(String(value ?? ""))
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}_\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function wordCount(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function parseNumber(value: string) {
  let candidate = value.trim()
  if (!candidate) return null
  if (!/^[-+]?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?$|^[-+]?\d+(?:[.,]\d+)?$/.test(candidate)) {
    candidate = candidate.replace(/[^\d.,+-]/g, "")
    if (!candidate || !/\d/.test(candidate)) return null
  }
  if (candidate.includes(",") && candidate.includes(".")) {
    candidate =
      candidate.lastIndexOf(",") > candidate.lastIndexOf(".")
        ? candidate.replaceAll(".", "").replace(",", ".")
        : candidate.replaceAll(",", "")
  } else if (candidate.includes(",")) {
    candidate = candidate.replace(",", ".")
  }
  const parsed = Number(candidate)
  return Number.isFinite(parsed) ? parsed : null
}

function numbersMatch(left: string, right: string) {
  const leftNumber = parseNumber(left)
  const rightNumber = parseNumber(right)
  if (leftNumber === null || rightNumber === null) return false
  return (
    Math.abs(leftNumber - rightNumber) <=
    Math.max(
      1e-6,
      1e-3 * Math.max(Math.abs(leftNumber), Math.abs(rightNumber))
    )
  )
}

function extractMultipleChoiceLetter(output: string) {
  const preferred = output.match(
    /(?:cevap|answer|yanıt)\s*[:-]?\s*\(?([A-E])\)?/i
  )
  if (preferred?.[1]) return preferred[1].toUpperCase()
  const letters = [...output.toUpperCase().matchAll(/\b([A-E])\b/g)]
  return letters.at(-1)?.[1] ?? null
}

function matchesShortAnswer(caseData: MihenkCaseData, output: string) {
  if (wordCount(output) > maxShortAnswerWords) return false
  const normalizedOutput = normalizeText(output)
  return [caseData.answerShort, ...caseData.answerAliases].some(
    (candidate) =>
      Boolean(candidate) &&
      (normalizeText(candidate ?? "") === normalizedOutput ||
        numbersMatch(candidate ?? "", output))
  )
}

export default {
  evaluate({ output, caseData }: EvaluationInput) {
    const passed =
      caseData.format === "multiple_choice"
        ? extractMultipleChoiceLetter(output.trim()) === caseData.answer
        : matchesShortAnswer(caseData, output.trim())

    return {
      passed,
      score: passed ? 1 : 0,
      message: passed ? null : "The response did not match the MIHENK reference scorer.",
      details: { format: caseData.format },
    }
  },
}
