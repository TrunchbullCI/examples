// ParseBench case transformer. This file is byte-identical in parsebench-pdf
// and parsebench-image; each package's data/documents.jsonl decides which
// attachment a case carries.
//
// Upstream (run-llama/ParseBench c38085d, test_cases/loader.py) builds one
// test case per (category, document). Text documents are graded twice, once
// with text_content rules and once with text_formatting rules, so they yield
// two cases here as well. The prompts are upstream's Core11
// parse-with-layout prompts (inference/providers/parse/_layout_utils.py,
// SYSTEM_PROMPT_LAYOUT and USER_PROMPT_LAYOUT), copied verbatim.

const SYSTEM_PROMPT_LAYOUT =
  "You are a document parser. Your task is to convert document images to clean, well-structured markdown.\n" +
  "\n" +
  "Guidelines:\n" +
  "- Preserve the document structure (headings, paragraphs, lists, tables)\n" +
  "- Convert tables to HTML format (<table>, <tr>, <th>, <td>)\n" +
  "- For existing tables in the document: use colspan and rowspan attributes to preserve merged cells and hierarchical headers\n" +
  '- For charts/graphs being converted to tables: use flat combined column headers (e.g., "Primary 2015" not separate rows) so each data cell\'s row contains all its labels\n' +
  "- Describe images/figures briefly in square brackets like [Figure: description]\n" +
  "- Preserve any code blocks with appropriate syntax highlighting\n" +
  "- Maintain reading order (left-to-right, top-to-bottom for Western documents)\n" +
  "- Do not add commentary or explanations - only output the parsed content\n" +
  "\n" +
  "Additionally, wrap each layout element in a <div> tag with:\n" +
  '- data-bbox="[x1, y1, x2, y2]" — bounding box in normalized 0-1000 coordinates where x is horizontal (left edge = 0, right edge = 1000) and y is vertical (top = 0, bottom = 1000). x1,y1 is the top-left corner and x2,y2 is the bottom-right corner.\n' +
  '- data-label="<category>" — one of: Caption, Footnote, Formula, List-item, Page-footer, Page-header, Picture, Section-header, Table, Text, Title\n' +
  "\n" +
  "Place elements in reading order. Every piece of content must be inside exactly one <div> wrapper."

const USER_PROMPT_LAYOUT =
  "Parse this document page and output its content as clean markdown, with each layout element wrapped in a " +
  '<div data-bbox="[x1,y1,x2,y2]" data-label="Category"> tag. Use HTML tables for any tabular data. ' +
  "For charts/graphs, use flat combined column headers. Output ONLY the parsed content with div wrappers, no explanations."

// Upstream category -> Trunchbull case kind (also the case group key).
const KINDS: Record<string, string> = {
  chart: "chart",
  layout: "layout",
  table: "table",
  text_content: "text-content",
  text_formatting: "text-formatting",
}

const DIMENSIONS: Record<string, string> = {
  chart: "Charts",
  layout: "Visual Grounding",
  table: "Tables",
  text_content: "Content Faithfulness",
  text_formatting: "Semantic Formatting",
}

type AttachmentMediaType = "application/pdf" | "image/png" | "image/jpeg"

interface DocumentRow {
  document: string
  case: string
  categories: string[]
  attachments: Array<{ path: string; mediaType: AttachmentMediaType }>
  sha256: string[]
}

interface TransformerInput {
  sources: Record<string, { path: string; content: string; sha256: string }>
}

export default {
  name: "ParseBench parse-with-layout transformer",

  transform({ sources }: TransformerInput) {
    const source = sources.documents
    if (!source) throw new Error("ParseBench requires the documents source.")

    const rows = source.content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as DocumentRow)

    const cases = rows.flatMap((row) => {
      const stem = row.case
      if (!/^[a-z0-9][a-z0-9-]*$/.test(stem)) {
        throw new Error(`Document ${row.document} has no stable case stem.`)
      }
      if (row.attachments.length === 0) {
        throw new Error(`Document ${row.document} has no attachment.`)
      }
      return row.categories.map((category) => {
        const kind = KINDS[category]
        if (!kind) throw new Error(`Unknown ParseBench category ${category}.`)
        return {
          id: `${kind}.${stem}`,
          groups: [kind],
          systemPrompt: SYSTEM_PROMPT_LAYOUT,
          prompt: USER_PROMPT_LAYOUT,
          description: `ParseBench ${DIMENSIONS[category]} case for ${row.document}.`,
          attachments: row.attachments.map(({ path, mediaType }) => ({ path, mediaType })),
          data: { document: row.document, kind },
        }
      })
    })

    const ids = new Set(cases.map((benchmarkCase) => benchmarkCase.id))
    if (ids.size !== cases.length) throw new Error("ParseBench case IDs must be unique.")
    return cases.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
  },
}
