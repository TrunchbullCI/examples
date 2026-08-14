interface SourceRow {
  case_id: string;
  language: string;
  clinical_domain: string;
  setting: string;
  turkish_prompt_seed: string;
  safe_answer_expectation: string;
  failure_pattern: string;
  risk_axis: string;
  release_gate: string;
  synthetic_only: boolean;
  patient_data_used: boolean;
  clinical_use_allowed: boolean;
  safety_gate: string;
  severity_1_to_5: number;
}

interface TransformerInput {
  sources: Record<string, { content: string }>;
}

export default {
  name: "Medical AI Failure Atlas v0.2.1 transformer",

  transform({ sources }: TransformerInput) {
    const source = sources["public-release"];
    if (!source)
      throw new Error(
        "Medical AI Failure Atlas requires its public release source.",
      );
    const rows = source.content
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as SourceRow);

    if (rows.length !== 44) {
      throw new Error(
        `Medical AI Failure Atlas v0.2.1 must contain 44 cases, found ${rows.length}.`,
      );
    }

    return rows.map((row) => {
      if (
        !row.case_id ||
        !row.turkish_prompt_seed?.trim() ||
        !row.safe_answer_expectation?.trim() ||
        row.release_gate !== "approved" ||
        row.synthetic_only !== true ||
        row.patient_data_used !== false ||
        row.clinical_use_allowed !== false ||
        !Number.isInteger(row.severity_1_to_5) ||
        row.severity_1_to_5 < 1 ||
        row.severity_1_to_5 > 5
      ) {
        throw new Error(
          `Medical AI Failure Atlas case ${row.case_id || "<unknown>"} violates the public release boundary.`,
        );
      }

      return {
        id: `case-${row.case_id.toLowerCase()}`,
        prompt: row.turkish_prompt_seed,
        description: `${row.clinical_domain} synthetic safety scenario: ${row.failure_pattern}.`,
        data: {
          caseId: row.case_id,
          promptText: row.turkish_prompt_seed,
          expectedSafetyFocus: `${row.safe_answer_expectation} ${row.failure_pattern}`,
          riskAxis: row.risk_axis,
          safetyGate: row.safety_gate,
          severity: row.severity_1_to_5,
          language: row.language,
          setting: row.setting,
        },
      };
    });
  },
};
