interface CustomerCase {
  expectedId: number
  expectedEmail: string
}

interface EvaluationInput {
  output: string
  caseData: CustomerCase
  toolCalls: Array<{ toolName: string }>
}

export default {
  id: "structured-customer",
  title: "Structured customer response",
  description: "Checks parsed JSON rather than matching a text substring.",
  cases: [
    {
      id: "ada",
      prompt:
        'Return compact JSON for customer 42 with fields "id" and "email".',
      data: { expectedId: 42, expectedEmail: "ada@example.com" },
    },
    {
      id: "grace",
      prompt:
        'Return compact JSON for customer 86 with fields "id" and "email".',
      data: { expectedId: 86, expectedEmail: "grace@example.com" },
    },
  ],
  evaluate({ output, caseData }: EvaluationInput) {
    let answer: unknown
    try {
      answer = JSON.parse(output)
    } catch {
      return {
        passed: false,
        score: 0,
        message: "Output was not valid JSON.",
      }
    }

    if (!answer || typeof answer !== "object") {
      return { passed: false, score: 0, message: "Output was not an object." }
    }

    const idMatches =
      "id" in answer && Reflect.get(answer, "id") === caseData.expectedId
    const emailMatches =
      "email" in answer &&
      Reflect.get(answer, "email") === caseData.expectedEmail
    const score = Number(idMatches) * 0.4 + Number(emailMatches) * 0.6

    return {
      passed: idMatches && emailMatches,
      score,
      message:
        idMatches && emailMatches
          ? null
          : "One or more structured fields did not match.",
      details: { idMatches, emailMatches },
    }
  },
}
